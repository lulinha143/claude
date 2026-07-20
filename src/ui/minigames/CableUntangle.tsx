import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  cablePuzzle,
  cablePositions,
  countCrossings,
  cableNodeCount,
  cableSolveScore,
  type CablePuzzle,
} from '../../sim/minigames';
import { useStore } from '../../state/store';
import type { SubGameProps } from './MicroGame';

type Pos = { x: number; y: number };

type CableKind = 'monitor' | 'network' | 'lamp' | 'phone' | 'usb' | 'repair' | 'employee';

interface CablePersonality {
  key: CableKind;
  color: string;
  highlight: string;
  symbol: string;
  pattern: 'solid' | 'dash' | 'coil' | 'tape';
}

const CABLES: readonly CablePersonality[] = [
  { key: 'monitor', color: '#5d8da6', highlight: '#bfe5ed', symbol: '▣', pattern: 'solid' },
  { key: 'network', color: '#d98c39', highlight: '#ffe1a6', symbol: '↔', pattern: 'dash' },
  { key: 'lamp', color: '#d3b63c', highlight: '#fff1a3', symbol: '✦', pattern: 'coil' },
  { key: 'phone', color: '#7d6cb8', highlight: '#d9cdf8', symbol: '⌁', pattern: 'coil' },
  { key: 'usb', color: '#57976c', highlight: '#c8efce', symbol: 'Y', pattern: 'solid' },
  { key: 'repair', color: '#b65f4b', highlight: '#ffd0b9', symbol: '+', pattern: 'tape' },
  { key: 'employee', color: '#a66d43', highlight: '#f3d4a7', symbol: '★', pattern: 'dash' },
];

const NUDGE = 0.035;
const SNAP_RADIUS = 0.135;
const WRONG_PORT_RADIUS = 0.11;

function distance(a: Pos, b: Pos): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function cablePath(a: Pos, b: Pos, index: number, lifted: boolean): string {
  const x1 = a.x * 100;
  const y1 = a.y * 100;
  const x2 = b.x * 100;
  const y2 = b.y * 100;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / length;
  const ny = dx / length;
  const direction = index % 2 === 0 ? 1 : -1;
  const personality = CABLES[index % CABLES.length];
  const personalitySag = personality.pattern === 'coil' ? 1.35 : personality.pattern === 'tape' ? 0.72 : 1;
  const bend = direction * (6 + (index % 3) * 2.7) * personalitySag * (lifted ? 1.35 : 1);
  const c1x = x1 + dx * 0.3 + nx * bend;
  const c1y = y1 + dy * 0.3 + ny * bend;
  const c2x = x1 + dx * 0.7 + nx * bend;
  const c2y = y1 + dy * 0.7 + ny * bend;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function midpoint(a: Pos, b: Pos): Pos {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// A tactile miniature cable desk. The original crossing-free loop rule and
// keyboard nudging remain intact, but every authored board now exposes labelled
// matching ports. Plugs can still be freely untangled; bringing one near its
// own port snaps it into the guaranteed solution, while a wrong port rejects it.
export function CableUntangle({ seed, reducedMotion, paused, onScore, onCombo, onEnd }: SubGameProps) {
  const { t } = useTranslation();
  const audio = useStore((state) => state.audio);
  const [solvedCount, setSolvedCount] = useState(0);
  const [puzzle, setPuzzle] = useState<CablePuzzle>(() => cablePuzzle(`${seed}-0`, cableNodeCount(0)));
  const [pos, setPos] = useState<Record<number, Pos>>(() => cablePositions(puzzle.points));
  const [snapped, setSnapped] = useState<Set<number>>(() => new Set());
  const [active, setActive] = useState<number | null>(null);
  const [rejected, setRejected] = useState<number | null>(null);
  const [justSolved, setJustSolved] = useState(false);
  const scoreRef = useRef(0);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const advancing = useRef(false);
  const solvedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rewardTimer = useRef<number | null>(null);
  const rejectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragOrigin = useRef<{ position: Pos; wasSnapped: boolean } | null>(null);
  void onEnd;

  const solution = useMemo(() => cablePositions(puzzle.solution), [puzzle.solution]);
  const crossings = useMemo(() => countCrossings(puzzle.edges, pos), [puzzle.edges, pos]);
  const connected = snapped.size;

  useEffect(
    () => () => {
      if (solvedTimer.current) clearTimeout(solvedTimer.current);
      if (rewardTimer.current) clearTimeout(rewardTimer.current);
      if (rejectTimer.current) clearTimeout(rejectTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!paused) return;
    if (rewardTimer.current) clearTimeout(rewardTimer.current);
    rewardTimer.current = null;
    if (rejectTimer.current) clearTimeout(rejectTimer.current);
    rejectTimer.current = null;
    setRejected(null);
  }, [paused]);

  const loadNext = useCallback(
    (nextSolved: number) => {
      const next = cablePuzzle(`${seed}-${nextSolved}`, cableNodeCount(nextSolved));
      setPuzzle(next);
      setPos(cablePositions(next.points));
      setSnapped(new Set());
      setActive(null);
      setRejected(null);
      advancing.current = false;
      setJustSolved(false);
    },
    [seed],
  );

  useEffect(() => {
    if (paused || advancing.current || snapped.size !== puzzle.points.length) return;
    advancing.current = true;
    scoreRef.current += cableSolveScore(puzzle.points.length);
    onScore(scoreRef.current);
    onCombo(Math.min(3, 1 + Math.floor((solvedCount + 1) / 2)));
    const next = solvedCount + 1;
    setSolvedCount(next);
    setJustSolved(true);
    audio.play('cableSnap');
    rewardTimer.current = window.setTimeout(() => {
      rewardTimer.current = null;
      audio.play('reward');
    }, reducedMotion ? 0 : 130);
  }, [audio, onCombo, onScore, paused, puzzle.points.length, reducedMotion, snapped, solvedCount]);

  useEffect(() => {
    if (!justSolved || paused) return;
    solvedTimer.current = setTimeout(
      () => loadNext(solvedCount),
      reducedMotion ? 400 : 1450,
    );
    return () => {
      if (solvedTimer.current) clearTimeout(solvedTimer.current);
      solvedTimer.current = null;
    };
  }, [justSolved, loadNext, paused, reducedMotion, solvedCount]);

  const clampToBoard = useCallback((clientX: number, clientY: number): Pos | null => {
    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: Math.max(0.055, Math.min(0.945, (clientX - rect.left) / rect.width)),
      y: Math.max(0.07, Math.min(0.93, (clientY - rect.top) / rect.height)),
    };
  }, []);

  function beginDrag(event: React.PointerEvent<HTMLButtonElement>, id: number) {
    if (paused || advancing.current || justSolved) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragOrigin.current = { position: pos[id], wasSnapped: snapped.has(id) };
    setActive(id);
    setRejected(null);
    setSnapped((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    audio.play('cableMove');
  }

  function moveDrag(event: React.PointerEvent<HTMLButtonElement>, id: number) {
    if (paused || active !== id) return;
    const next = clampToBoard(event.clientX, event.clientY);
    if (next) setPos((current) => ({ ...current, [id]: next }));
  }

  function finishDrag(event: React.PointerEvent<HTMLButtonElement>, id: number) {
    if (paused || active !== id) return;
    const released = clampToBoard(event.clientX, event.clientY) ?? pos[id];
    const ownPort = solution[id];
    const wrongPort = puzzle.solution.find(
      (port) => port.id !== id && distance(released, port) <= WRONG_PORT_RADIUS,
    );
    if (distance(released, ownPort) <= SNAP_RADIUS) {
      setPos((current) => ({ ...current, [id]: ownPort }));
      setSnapped((current) => new Set(current).add(id));
      audio.play('cableSnap');
    } else if (wrongPort) {
      const origin = dragOrigin.current;
      setPos((current) => ({ ...current, [id]: origin?.position ?? current[id] }));
      if (origin?.wasSnapped) setSnapped((current) => new Set(current).add(id));
      setRejected(id);
      audio.play('cableReject');
      if (rejectTimer.current) clearTimeout(rejectTimer.current);
      rejectTimer.current = setTimeout(() => setRejected(null), reducedMotion ? 0 : 360);
    } else {
      setPos((current) => ({ ...current, [id]: released }));
      audio.play('cableMove');
    }
    setActive(null);
    dragOrigin.current = null;
  }

  function cancelDrag(id: number) {
    if (active !== id) return;
    const origin = dragOrigin.current;
    setPos((current) => ({ ...current, [id]: origin?.position ?? current[id] }));
    if (origin?.wasSnapped) setSnapped((current) => new Set(current).add(id));
    setActive(null);
    dragOrigin.current = null;
  }

  useEffect(() => {
    if (!paused || active == null) return;
    const origin = dragOrigin.current;
    setPos((current) => ({ ...current, [active]: origin?.position ?? current[active] }));
    if (origin?.wasSnapped) setSnapped((current) => new Set(current).add(active));
    setActive(null);
    dragOrigin.current = null;
  }, [active, paused]);

  function onKeyNode(event: React.KeyboardEvent, id: number) {
    if (paused || advancing.current || justSolved) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setPos((current) => ({ ...current, [id]: solution[id] }));
      setSnapped((current) => new Set(current).add(id));
      setActive(null);
      audio.play('cableSnap');
      return;
    }
    const deltas: Record<string, Pos> = {
      ArrowUp: { x: 0, y: -NUDGE },
      ArrowDown: { x: 0, y: NUDGE },
      ArrowLeft: { x: -NUDGE, y: 0 },
      ArrowRight: { x: NUDGE, y: 0 },
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    setActive(null);
    setSnapped((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setPos((current) => ({
      ...current,
      [id]: {
        x: Math.max(0.055, Math.min(0.945, current[id].x + delta.x)),
        y: Math.max(0.07, Math.min(0.93, current[id].y + delta.y)),
      },
    }));
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
      <div className="cable__hud">
        <span className="cable__difficulty">
          {t(`microgame.cableUntangle.difficulty.${puzzle.difficulty}`)}
        </span>
        <span className={crossings === 0 ? 'cable__crossings is-clear' : 'cable__crossings'}>
          {t('microgame.cableUntangle.crossings', { value: crossings })}
        </span>
        <span>{t('microgame.cableUntangle.connected', { value: connected, total: puzzle.points.length })}</span>
      </div>

      <div
        ref={boardRef}
        className={`cable__board cable__board--${puzzle.difficulty} ${justSolved ? 'is-solved' : ''}`}
        role="group"
        aria-label={t('microgame.cableUntangle.name')}
      >
        <DeskIllustration solved={justSolved} />

        <div className="cable__ports" aria-label={t('microgame.cableUntangle.hint')}>
          {puzzle.solution.map((port) => {
            const personality = CABLES[port.id % CABLES.length];
            const label = t(`microgame.cableUntangle.cableLabels.${personality.key}`);
            return (
              <span
                key={port.id}
                className={`cable__port cable__port--${personality.key} ${snapped.has(port.id) ? 'is-connected' : ''}`}
                style={{ left: `${port.x * 100}%`, top: `${port.y * 100}%`, ['--cable-color' as string]: personality.color }}
                aria-label={t('microgame.cableUntangle.port', { label })}
              >
                <span className="cable__port-light" />
                <b>{personality.symbol}</b>
              </span>
            );
          })}
        </div>

        <svg className="cable__wires" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <filter id="cable-shadow" x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow dx="0.8" dy="2" stdDeviation="1.1" floodColor="#160f09" floodOpacity=".58" />
            </filter>
          </defs>
          {orderedEdges.map(({ edge, index }) => {
            const personality = CABLES[index % CABLES.length];
            const lifted = edge.a === active || edge.b === active;
            const path = cablePath(pos[edge.a], pos[edge.b], index, lifted);
            const mid = midpoint(pos[edge.a], pos[edge.b]);
            return (
              <g
                key={`${edge.a}-${edge.b}`}
                className={`cable__strand cable__strand--${personality.pattern} ${lifted ? 'is-lifted' : ''}`}
                style={{
                  ['--cable-color' as string]: personality.color,
                  ['--cable-highlight' as string]: personality.highlight,
                }}
              >
                <path d={path} className="cable__strand-shadow" />
                <path d={path} className="cable__strand-body" />
                <path d={path} className="cable__strand-highlight" />
                {personality.pattern === 'tape' ? (
                  <g className="cable__repair-tape" transform={`translate(${mid.x * 100} ${mid.y * 100}) rotate(${index % 2 ? -18 : 18})`}>
                    <rect x="-4" y="-2.2" width="8" height="4.4" rx="1" />
                    <path d="M-3-1h6M-3 1h6" />
                  </g>
                ) : null}
                <g className="cable__tag" transform={`translate(${mid.x * 100} ${mid.y * 100})`}>
                  <rect x="-4" y="-2.4" width="8" height="4.8" rx="1.2" />
                  <text x="0" y="1.2" textAnchor="middle">{personality.symbol}</text>
                </g>
              </g>
            );
          })}
        </svg>

        {puzzle.points.map((point) => {
          const current = pos[point.id];
          const personality = CABLES[point.id % CABLES.length];
          const label = t(`microgame.cableUntangle.cableLabels.${personality.key}`);
          return (
            <button
              key={point.id}
              type="button"
              className={`cable__node cable__node--${personality.key} ${active === point.id ? 'is-active' : ''} ${snapped.has(point.id) ? 'is-snapped' : ''} ${rejected === point.id ? 'is-rejected' : ''}`}
              style={{
                left: `${current.x * 100}%`,
                top: `${current.y * 100}%`,
                ['--cable-color' as string]: personality.color,
                ['--cable-highlight' as string]: personality.highlight,
              }}
              onPointerDown={(event) => beginDrag(event, point.id)}
              onPointerMove={(event) => moveDrag(event, point.id)}
              onPointerUp={(event) => finishDrag(event, point.id)}
              onPointerCancel={() => cancelDrag(point.id)}
              onKeyDown={(event) => onKeyNode(event, point.id)}
              disabled={paused}
              aria-label={t('microgame.cableUntangle.plug', { label })}
              aria-pressed={snapped.has(point.id)}
            >
              <ConnectorGlyph personality={personality} id={point.id} />
              <span className="cable__node-label" aria-hidden="true">{label}</span>
            </button>
          );
        })}

        {justSolved ? (
          <div className="cable__cleared" role="status">
            <div className="cable__confetti" aria-hidden="true">
              {Array.from({ length: 14 }, (_, index) => <i key={index} style={{ ['--i' as string]: index }} />)}
            </div>
            <span className="cable__cleared-light" aria-hidden="true" />
            <strong>{t('microgame.cableUntangle.cleared')}</strong>
            <small>{t('microgame.cableUntangle.doneHint')}</small>
          </div>
        ) : null}
      </div>

      <p className="cable__hint">
        <span aria-hidden="true">⌁</span>
        {justSolved ? t('microgame.cableUntangle.doneHint') : t('microgame.cableUntangle.hint')}
      </p>
    </div>
  );
}

function ConnectorGlyph({ personality, id }: { personality: CablePersonality; id: number }) {
  const shape = id % 4;
  return (
    <svg className="cable-connector" width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
      <ellipse cx="24" cy="41" rx="15" ry="4" fill="rgba(20,12,7,.26)" />
      {shape === 0 ? <path d="M12 11h24v24q0 6-6 6H18q-6 0-6-6Z" fill="#f3ddb1" stroke="#332619" strokeWidth="2.6" /> : null}
      {shape === 1 ? <path d="M9 16q0-7 7-7h16q7 0 7 7v19q0 6-6 6H15q-6 0-6-6Z" fill="#e9ddc7" stroke="#332619" strokeWidth="2.6" /> : null}
      {shape === 2 ? <path d="M12 8h24l5 10v17q0 6-6 6H13q-6 0-6-6V18Z" fill="#ead6aa" stroke="#332619" strokeWidth="2.6" /> : null}
      {shape === 3 ? <path d="M15 8h18l7 9-3 23H11L8 17Z" fill="#efe2c4" stroke="#332619" strokeWidth="2.6" /> : null}
      <rect x="16" y="16" width="16" height="14" rx="4" fill={personality.color} stroke="#332619" strokeWidth="1.8" />
      <path d="M18 18h12" stroke={personality.highlight} strokeWidth="2" strokeLinecap="round" opacity=".8" />
      <text x="24" y="27" textAnchor="middle" fill="#23170e" fontSize="11" fontWeight="900">{personality.symbol}</text>
      <path d="M18 8V3M30 8V3" stroke="#d7cab2" strokeWidth="4" strokeLinecap="round" />
      <path d="M18 8V3M30 8V3" stroke="#332619" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function DeskIllustration({ solved }: { solved: boolean }) {
  return (
    <div className={`cable__desk-art ${solved ? 'is-powered' : ''}`} aria-hidden="true">
      <div className="cable__monitor">
        <span className="cable__monitor-screen"><i /><i /><i /></span>
        <span className="cable__monitor-stand" />
      </div>
      <div className="cable__keyboard">
        {Array.from({ length: 18 }, (_, index) => <i key={index} />)}
      </div>
      <div className="cable__sticky">PLUG<br />WITH<br />LOVE ♥</div>
      <div className="cable__mug"><span /></div>
      <div className="cable__plant"><i /><i /><i /><b /></div>
      <div className="cable__power-strip">
        {Array.from({ length: 5 }, (_, index) => <i key={index} />)}
      </div>
      <div className="cable__buddy">
        <svg viewBox="0 0 90 105">
          <ellipse cx="45" cy="98" rx="25" ry="5" fill="rgba(0,0,0,.2)" />
          <path d="M67 82c24-7 22-42 5-50 11 16 6 29-4 36Z" fill="#d17b42" stroke="#332619" strokeWidth="3" />
          <ellipse cx="45" cy="73" rx="23" ry="26" fill="#d17b42" stroke="#332619" strokeWidth="3" />
          <circle cx="45" cy="41" r="25" fill="#dc8750" stroke="#332619" strokeWidth="3" />
          <path d="M23 29 29 9l13 12M67 29 61 9 48 21" fill="#dc8750" stroke="#332619" strokeWidth="3" strokeLinejoin="round" />
          <ellipse cx="45" cy="50" rx="15" ry="12" fill="#f1c99a" />
          <g className="cable__buddy-eyes"><circle cx="36" cy="40" r="3" /><circle cx="54" cy="40" r="3" /></g>
          <path className="cable__buddy-mouth" d="M38 53q7 5 14 0" fill="none" stroke="#332619" strokeWidth="3" strokeLinecap="round" />
          <path className="cable__buddy-arm cable__buddy-arm--left" d="M27 68q-13 7-14 19" fill="none" stroke="#d17b42" strokeWidth="9" strokeLinecap="round" />
          <path className="cable__buddy-arm cable__buddy-arm--right" d="M63 68q13 7 14 19" fill="none" stroke="#d17b42" strokeWidth="9" strokeLinecap="round" />
          <path d="M38 60h14l-7 15Z" fill="#5d8da6" stroke="#332619" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
}
