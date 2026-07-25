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
  cablePuzzle,
  cablePositions,
  countCableConflicts,
  cableNodeCount,
  cableSolveScore,
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
];

const NUDGE = 0.035;
const BOARD_MIN_X = 0.065;
const BOARD_MAX_X = 0.935;
const BOARD_MIN_Y = 0.09;
const BOARD_MAX_Y = 0.91;

// One rule, represented the same way everywhere: move the plugs until the
// straight cables no longer cross or overlap. Pointer ownership lives in a ref so even a
// very fast press/release cannot race React state, and window-level fallbacks
// guarantee that an interrupted capture never leaves a plug stuck in mid-drag.
export function CableUntangle({ seed, reducedMotion, paused, onScore, onCombo }: SubGameProps) {
  const { t } = useTranslation();
  const audio = useStore((state) => state.audio);
  const [solvedCount, setSolvedCount] = useState(0);
  const [puzzle, setPuzzle] = useState<CablePuzzle>(() =>
    cablePuzzle(`${seed}-0`, cableNodeCount(0)),
  );
  const [pos, setPos] = useState<Record<number, Pos>>(() => cablePositions(puzzle.points));
  const [active, setActive] = useState<number | null>(null);
  // A single explicit round phase drives the whole solve → celebrate → next
  // lifecycle. `settled` mirrors it synchronously so a burst of pointer/render
  // events can never award the same board twice before React commits.
  const [stage, setStage] = useState<Stage>('solving');
  const settled = useRef(false);
  const scoreRef = useRef(0);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<ActiveDrag | null>(null);
  const rewardTimer = useRef<number | null>(null);
  const cleared = stage === 'cleared';

  const tangles = useMemo(() => countCableConflicts(puzzle.edges, pos), [puzzle.edges, pos]);

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
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', finish, true);
    window.addEventListener('pointercancel', cancel, true);
    window.addEventListener('blur', cancelOnBlur);
    return () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', finish, true);
      window.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('blur', cancelOnBlur);
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
      const next = cablePuzzle(`${seed}-${nextSolved}`, cableNodeCount(nextSolved));
      settled.current = false;
      setPuzzle(next);
      setPos(cablePositions(next.points));
      setActive(null);
      setStage('solving');
    },
    [seed],
  );

  // Detect a solved board. `settled` guards against a double award before the
  // stage state commits; the stage itself then blocks any further detection
  // until the next desk loads.
  useEffect(() => {
    if (paused || settled.current || stage !== 'solving' || active !== null || tangles !== 0)
      return;
    settled.current = true;
    scoreRef.current += cableSolveScore(puzzle.points.length);
    onScore(scoreRef.current);
    onCombo(Math.min(3, 1 + Math.floor((solvedCount + 1) / 2)));
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
  }, [
    active,
    audio,
    onCombo,
    onScore,
    paused,
    puzzle.points.length,
    reducedMotion,
    solvedCount,
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
    const deltas: Record<string, Pos> = {
      ArrowUp: { x: 0, y: -NUDGE },
      ArrowDown: { x: 0, y: NUDGE },
      ArrowLeft: { x: -NUDGE, y: 0 },
      ArrowRight: { x: NUDGE, y: 0 },
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

  return (
    <div className={`cable ${reducedMotion ? 'is-reduced' : ''}`}>
      <div className="cable__status" aria-live="polite">
        <span className={`cable__crossings ${tangles === 0 ? 'is-clear' : ''}`}>
          {t('microgame.cableUntangle.crossings', { value: tangles })}
        </span>
        <span className="cable__status-copy">
          {tangles === 0
            ? t('microgame.cableUntangle.clearStatus')
            : t('microgame.cableUntangle.goal')}
        </span>
      </div>

      <div
        ref={boardRef}
        className={`cable__board cable__board--${puzzle.difficulty} ${cleared ? 'is-solved' : ''}`}
        role="group"
        data-stage={stage}
        data-round={solvedCount}
        data-level={puzzle.levelId}
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
                className={`cable__strand ${lifted ? 'is-lifted' : ''}`}
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

        {puzzle.points.map((point) => {
          const current = pos[point.id];
          const style = CABLES[point.id % CABLES.length];
          return (
            <button
              key={point.id}
              type="button"
              data-node-id={point.id}
              className={`cable__node ${active === point.id ? 'is-active' : ''}`}
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
              aria-label={t('microgame.cableUntangle.computer', { value: point.id + 1 })}
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
