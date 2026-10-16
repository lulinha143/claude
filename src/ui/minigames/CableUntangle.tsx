import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  cableConflictMap,
  cableKnottedEdges,
  cableNodeCount,
  cableObstructingPlugs,
  cableParSeconds,
  cablePositions,
  cablePuzzle,
  cableSolveScore,
  cableSpeedBonus,
  type CablePuzzle,
} from '../../sim/minigames';
import { useStore } from '../../state/store';
import { usePausableTimeout } from '../usePausableTimeout';
import type { SubGameProps } from './MicroGame';

type Pos = { x: number; y: number };

type Stage = 'solving' | 'cleared';

// How long the celebratory "all clear" overlay lingers before the next desk
// loads. Reduced-motion players get a much shorter, calmer beat.
const TRANSITION_MS = 1450;
const TRANSITION_MS_REDUCED = 400;

interface CableStyle {
  color: string;
  highlight: string;
}

interface ActiveDrag {
  id: number;
  pointerId: number;
  origin: Pos;
  last: Pos;
  offsetX: number;
  offsetY: number;
  target: HTMLButtonElement;
}

const CABLES: readonly CableStyle[] = [
  { color: '#6ba9c6', highlight: '#d7f4fa' },
  { color: '#e49b45', highlight: '#ffe5b5' },
  { color: '#dfc447', highlight: '#fff3aa' },
  { color: '#8e7aca', highlight: '#e2d9ff' },
  { color: '#65a978', highlight: '#d1f5d8' },
  { color: '#ca715d', highlight: '#ffdbca' },
  { color: '#bd8557', highlight: '#f8dcba' },
  { color: '#cf6f94', highlight: '#ffd6e5' },
  { color: '#4fa4a2', highlight: '#c9f4ef' },
];

/** Arrow-key nudge; with Shift a stride for crossing the desk. */
const NUDGE = 0.035;
const STRIDE = 0.1;
const BOARD_MIN_X = 0.085;
const BOARD_MAX_X = 0.915;
const BOARD_MIN_Y = 0.12;
const BOARD_MAX_Y = 0.88;

// One rule, represented the same way everywhere: move the plugs until the
// straight cables no longer cross or overlap. Every conflict the counter counts is
// drawn where it is (a knot on a crossing, a ring on a plug that is in the way),
// from the same list. Pointer ownership lives in a ref so even a very fast
// press/release cannot race React state, and window-level fallbacks guarantee that
// an interrupted capture never leaves a plug stuck in mid-drag.
export function CableUntangle({ seed, reducedMotion, paused, onScore }: SubGameProps) {
  const { t } = useTranslation();
  const audio = useStore((state) => state.audio);
  const [solvedCount, setSolvedCount] = useState(0);
  const [puzzle, setPuzzle] = useState<CablePuzzle>(() =>
    cablePuzzle(`${seed}-0`, cableNodeCount(0)),
  );
  const [pos, setPos] = useState<Record<number, Pos>>(() => cablePositions(puzzle.points));
  const recentLayouts = useRef<string[]>([puzzle.levelId]);
  const [active, setActive] = useState<number | null>(null);
  // A single explicit round phase drives the whole solve → celebrate → next
  // lifecycle. `settled` mirrors it synchronously so a burst of pointer/render
  // events can never award the same board twice before React commits.
  const [stage, setStage] = useState<Stage>('solving');
  const [lastClear, setLastClear] = useState<{
    points: number;
    bonus: number;
    seconds: number;
  } | null>(null);
  const settled = useRef(false);
  const scoreRef = useRef(0);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<ActiveDrag | null>(null);
  const rewardTimer = useRef<number | null>(null);
  // The desk's own clock, in active milliseconds: pauses never count against its par.
  const pausedAtRef = useRef<number | null>(paused ? performance.now() : null);
  const pausedTotalRef = useRef(0);
  const deskStartRef = useRef(performance.now());
  const cleared = stage === 'cleared';

  const activeNow = () => {
    const now = performance.now();
    const current = pausedAtRef.current == null ? 0 : now - pausedAtRef.current;
    return now - pausedTotalRef.current - current;
  };

  useEffect(() => {
    if (paused) {
      if (pausedAtRef.current == null) pausedAtRef.current = performance.now();
    } else if (pausedAtRef.current != null) {
      pausedTotalRef.current += performance.now() - pausedAtRef.current;
      pausedAtRef.current = null;
    }
  }, [paused]);

  const conflicts = useMemo(() => cableConflictMap(puzzle.edges, pos), [puzzle.edges, pos]);
  const tangles = conflicts.length;
  const knotted = useMemo(() => cableKnottedEdges(conflicts), [conflicts]);
  const blocking = useMemo(() => cableObstructingPlugs(conflicts), [conflicts]);
  const markers = useMemo(() => {
    const perPlug = new Map<number, number>();
    return conflicts.map((conflict, index) => {
      const onPlug = conflict.kind === 'touch' || conflict.kind === 'crowded';
      const anchor = onPlug ? conflict.plugs[0] : -1;
      const stack = onPlug ? (perPlug.get(anchor) ?? 0) : 0;
      if (onPlug) perPlug.set(anchor, stack + 1);
      const at = onPlug ? pos[anchor] : conflict;
      return {
        key: `${conflict.kind}-${index}`,
        kind: conflict.kind,
        x: at.x,
        y: at.y,
        onPlug,
        stack,
      };
    });
  }, [conflicts, pos]);

  const releaseCapture = useCallback((drag: ActiveDrag) => {
    try {
      if (drag.target.hasPointerCapture?.(drag.pointerId)) {
        drag.target.releasePointerCapture?.(drag.pointerId);
      }
    } catch {
      // The browser may already have released capture after a native cancel.
    }
  }, []);

  const positionFromPointer = useCallback(
    (clientX: number, clientY: number, offsetX = 0, offsetY = 0): Pos | null => {
      const board = boardRef.current;
      if (!board) return null;
      const rect = board.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      return {
        x: Math.max(
          BOARD_MIN_X,
          Math.min(BOARD_MAX_X, (clientX - offsetX - rect.left) / rect.width),
        ),
        y: Math.max(
          BOARD_MIN_Y,
          Math.min(BOARD_MAX_Y, (clientY - offsetY - rect.top) / rect.height),
        ),
      };
    },
    [],
  );

  const moveActiveDrag = useCallback(
    (pointerId: number, clientX: number, clientY: number) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== pointerId) return;
      const next = positionFromPointer(clientX, clientY, drag.offsetX, drag.offsetY);
      if (!next) return;
      drag.last = next;
      setPos((current) => ({ ...current, [drag.id]: next }));
    },
    [positionFromPointer],
  );

  const cancelActiveDrag = useCallback(
    (pointerId?: number) => {
      const drag = dragRef.current;
      if (!drag || (pointerId != null && drag.pointerId !== pointerId)) return;
      dragRef.current = null;
      releaseCapture(drag);
      setPos((current) => ({ ...current, [drag.id]: drag.origin }));
      setActive(null);
    },
    [releaseCapture],
  );

  const finishActiveDrag = useCallback(
    (pointerId: number, clientX: number, clientY: number) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== pointerId) return;
      const released =
        positionFromPointer(clientX, clientY, drag.offsetX, drag.offsetY) ?? drag.last;
      dragRef.current = null;
      releaseCapture(drag);
      setPos((current) => ({ ...current, [drag.id]: released }));
      setActive(null);
      audio.play('cableMove');
    },
    [audio, positionFromPointer, releaseCapture],
  );

  useEffect(() => {
    const move = (event: PointerEvent) =>
      moveActiveDrag(event.pointerId, event.clientX, event.clientY);
    const finish = (event: PointerEvent) =>
      finishActiveDrag(event.pointerId, event.clientX, event.clientY);
    const cancel = (event: PointerEvent) => cancelActiveDrag(event.pointerId);
    const cancelOnBlur = () => cancelActiveDrag();
    // Escape puts a plug back where it was picked up. Registered before the shell's
    // own Escape (which pauses), and it swallows the key only while a plug is held.
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !dragRef.current) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      cancelActiveDrag();
    };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', finish, true);
    window.addEventListener('pointercancel', cancel, true);
    window.addEventListener('blur', cancelOnBlur);
    window.addEventListener('keydown', escape, true);
    return () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', finish, true);
      window.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('blur', cancelOnBlur);
      window.removeEventListener('keydown', escape, true);
      const drag = dragRef.current;
      if (drag) releaseCapture(drag);
      dragRef.current = null;
    };
  }, [cancelActiveDrag, finishActiveDrag, moveActiveDrag, releaseCapture]);

  useEffect(
    () => () => {
      if (rewardTimer.current) clearTimeout(rewardTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!paused) return;
    cancelActiveDrag();
    // Don't let a queued reward chirp fire while the game is paused/hidden.
    if (rewardTimer.current) {
      clearTimeout(rewardTimer.current);
      rewardTimer.current = null;
    }
  }, [cancelActiveDrag, paused]);

  const loadNext = useCallback(
    (nextSolved: number) => {
      const next = cablePuzzle(
        `${seed}-${nextSolved}`,
        cableNodeCount(nextSolved),
        recentLayouts.current,
      );
      recentLayouts.current = [next.levelId, ...recentLayouts.current].slice(0, 3);
      settled.current = false;
      deskStartRef.current = activeNow();
      setPuzzle(next);
      setPos(cablePositions(next.points));
      setActive(null);
      setStage('solving');
      setLastClear(null);
    },
    // activeNow reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed],
  );

  // Detect a solved board. `settled` guards against a double award before the
  // stage state commits; the stage itself then blocks any further detection
  // until the next desk loads.
  useEffect(() => {
    if (paused || settled.current || stage !== 'solving' || active !== null || tangles !== 0)
      return;
    settled.current = true;
    const nodes = puzzle.points.length;
    const seconds = Math.max(0, (activeNow() - deskStartRef.current) / 1000);
    const base = cableSolveScore(nodes, puzzle.topology);
    const bonus = cableSpeedBonus(nodes, seconds);
    scoreRef.current += base + bonus;
    onScore(scoreRef.current);
    setLastClear({ points: base, bonus, seconds });
    setSolvedCount((count) => count + 1);
    setStage('cleared');
    audio.play('cableSnap');
    if (rewardTimer.current) clearTimeout(rewardTimer.current);
    rewardTimer.current = window.setTimeout(
      () => {
        rewardTimer.current = null;
        audio.play('reward');
      },
      reducedMotion ? 0 : 130,
    );
    // activeNow reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    active,
    audio,
    onScore,
    paused,
    puzzle.points.length,
    puzzle.topology,
    reducedMotion,
    stage,
    tangles,
  ]);

  // Advance to the next desk once the celebration has played. The countdown is
  // pausable and self-healing: pausing (or the window blurring) freezes it, and
  // any amount of pause/resume churn still resolves to loading the next board,
  // so the game can never get permanently stuck between rounds.
  usePausableTimeout(cleared, paused, reducedMotion ? TRANSITION_MS_REDUCED : TRANSITION_MS, () =>
    loadNext(solvedCount),
  );

  function beginDrag(event: ReactPointerEvent<HTMLButtonElement>, id: number) {
    if (
      paused ||
      settled.current ||
      dragRef.current ||
      !event.isPrimary ||
      (event.pointerType === 'mouse' && event.button !== 0)
    )
      return;

    event.preventDefault();
    const board = boardRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const current = pos[id];
    const drag: ActiveDrag = {
      id,
      pointerId: event.pointerId,
      origin: current,
      last: current,
      offsetX: event.clientX - (rect.left + current.x * rect.width),
      offsetY: event.clientY - (rect.top + current.y * rect.height),
      target: event.currentTarget,
    };
    dragRef.current = drag;
    setActive(id);
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Window-level pointer listeners still complete or cancel the drag.
    }
    audio.play('cableMove');
  }

  function onKeyNode(event: ReactKeyboardEvent<HTMLButtonElement>, id: number) {
    if (paused || settled.current) return;
    const step = event.shiftKey ? STRIDE : NUDGE;
    const deltas: Record<string, Pos> = {
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    cancelActiveDrag();
    setPos((current) => ({
      ...current,
      [id]: {
        x: Math.max(BOARD_MIN_X, Math.min(BOARD_MAX_X, current[id].x + delta.x)),
        y: Math.max(BOARD_MIN_Y, Math.min(BOARD_MAX_Y, current[id].y + delta.y)),
      },
    }));
    audio.play('cableMove');
  }

  const orderedEdges = useMemo(
    () =>
      puzzle.edges
        .map((edge, index) => ({ edge, index }))
        .sort((left, right) => {
          const leftActive = left.edge.a === active || left.edge.b === active ? 1 : 0;
          const rightActive = right.edge.a === active || right.edge.b === active ? 1 : 0;
          return leftActive - rightActive;
        }),
    [active, puzzle.edges],
  );

  const par = cableParSeconds(puzzle.points.length);

  return (
    <div className={`cable ${reducedMotion ? 'is-reduced' : ''}`}>
      <div className="cable__status">
        <span className={`cable__crossings ${tangles === 0 ? 'is-clear' : ''}`} aria-live="polite">
          {t('microgame.cableUntangle.crossings', { value: tangles })}
        </span>
        <span className="cable__desk-count">
          {t('microgame.cableUntangle.board', { value: solvedCount + (cleared ? 0 : 1) })}
          <small>{t('microgame.cableUntangle.par', { value: Math.round(par) })}</small>
        </span>
        <span className="cable__status-copy">
          {/* The goal line names THIS desk's wiring. A hub-and-spokes board with a
              generic "move any plug" hint reads as broken rather than as a different
              puzzle, so each shape states the insight it wants. */}
          {tangles === 0
            ? t('microgame.cableUntangle.clearStatus')
            : t(`microgame.cableUntangle.goalBy.${puzzle.topology}`)}
        </span>
      </div>

      <div
        ref={boardRef}
        className={`cable__board cable__board--${puzzle.difficulty} ${cleared ? 'is-solved' : ''}`}
        role="group"
        data-stage={stage}
        data-round={solvedCount}
        data-level={puzzle.levelId}
        data-topology={puzzle.topology}
        data-mirrored={puzzle.mirrored ? 'true' : 'false'}
        data-nodes={puzzle.points.length}
        data-conflicts={tangles}
        aria-label={t('microgame.cableUntangle.name')}
        aria-describedby="cable-instructions"
      >
        <svg
          className="cable__wires"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {orderedEdges.map(({ edge, index }) => {
            const style = CABLES[index % CABLES.length];
            const lifted = edge.a === active || edge.b === active;
            return (
              <g
                key={`${edge.a}-${edge.b}`}
                className={`cable__strand ${lifted ? 'is-lifted' : ''} ${knotted.has(index) ? 'is-knotted' : ''}`}
                style={{
                  ['--cable-color' as string]: style.color,
                  ['--cable-highlight' as string]: style.highlight,
                }}
              >
                <line
                  x1={pos[edge.a].x * 100}
                  y1={pos[edge.a].y * 100}
                  x2={pos[edge.b].x * 100}
                  y2={pos[edge.b].y * 100}
                  className="cable__strand-shadow"
                />
                <line
                  x1={pos[edge.a].x * 100}
                  y1={pos[edge.a].y * 100}
                  x2={pos[edge.b].x * 100}
                  y2={pos[edge.b].y * 100}
                  className="cable__strand-body"
                />
              </g>
            );
          })}
        </svg>

        {/* One mark per counted conflict, drawn where it is. A plug in the way is
            itself the spot, so its mark rides on the plug's shoulder instead of
            hiding underneath it, one per cable it is in the way of. */}
        {cleared
          ? null
          : markers.map((marker) => (
              <span
                key={marker.key}
                className={`cable__knot cable__knot--${marker.kind} ${marker.onPlug ? 'is-on-plug' : ''}`}
                style={{
                  left: `${marker.x * 100}%`,
                  top: `${marker.y * 100}%`,
                  ['--stack' as string]: marker.stack,
                }}
                aria-hidden="true"
              />
            ))}

        {puzzle.points.map((point) => {
          const current = pos[point.id];
          const style = CABLES[point.id % CABLES.length];
          const inTheWay = !cleared && blocking.has(point.id);
          return (
            <button
              key={point.id}
              type="button"
              data-node-id={point.id}
              className={`cable__node ${active === point.id ? 'is-active' : ''} ${inTheWay ? 'is-blocking' : ''}`}
              style={{
                left: `${current.x * 100}%`,
                top: `${current.y * 100}%`,
                ['--cable-color' as string]: style.color,
                ['--cable-highlight' as string]: style.highlight,
              }}
              onPointerDown={(event) => beginDrag(event, point.id)}
              onPointerUp={(event) =>
                finishActiveDrag(event.pointerId, event.clientX, event.clientY)
              }
              onPointerCancel={(event) => cancelActiveDrag(event.pointerId)}
              onLostPointerCapture={(event) => cancelActiveDrag(event.pointerId)}
              onKeyDown={(event) => onKeyNode(event, point.id)}
              disabled={paused}
              aria-label={t(
                inTheWay
                  ? 'microgame.cableUntangle.computerBlocking'
                  : 'microgame.cableUntangle.computer',
                { value: point.id + 1 },
              )}
            >
              <span className="cable__handle" aria-hidden="true">
                <b>{point.id + 1}</b>
              </span>
            </button>
          );
        })}

        {cleared ? (
          <div className="cable__cleared" role="status">
            <div className="cable__confetti" aria-hidden="true">
              {Array.from({ length: 10 }, (_, index) => (
                <i key={index} style={{ ['--i' as string]: index }} />
              ))}
            </div>
            <span className="cable__cleared-mark" aria-hidden="true">
              <svg viewBox="0 0 48 48">
                <path d="M11 25 20 34 38 14" />
              </svg>
            </span>
            <strong>{t('microgame.cableUntangle.cleared')}</strong>
            {lastClear ? (
              <span className="cable__cleared-points">
                <b>{t('microgame.cableUntangle.deskPoints', { value: lastClear.points })}</b>
                {lastClear.bonus > 0 ? (
                  <b className="is-bonus">
                    {t('microgame.cableUntangle.speedBonus', { value: lastClear.bonus })}
                  </b>
                ) : null}
              </span>
            ) : null}
            <small>{t('microgame.cableUntangle.doneHint')}</small>
          </div>
        ) : null}
      </div>

      <p id="cable-instructions" className="cable__hint">
        {cleared ? t('microgame.cableUntangle.doneHint') : t('microgame.cableUntangle.hint')}
      </p>
    </div>
  );
}
