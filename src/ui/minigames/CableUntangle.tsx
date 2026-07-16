import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  cablePuzzle,
  cablePositions,
  countCrossings,
  cableSolved,
  cableNodeCount,
  cableSolveScore,
  type CablePuzzle,
} from '../../sim/minigames';
import type { SubGameProps } from './MicroGame';

type Pos = { x: number; y: number };

const NUDGE = 0.04; // keyboard move step (normalised units)

// Cable Untangle Desk (IT / Maintenance department micro-game).
// The workstation cables start crossed; DRAG each computer until no two cables
// cross. The graph is always a single loop, so every board is guaranteed
// solvable and can never soft-lock. When a board is cleared the score grows and
// a bigger, messier board loads until the shared timer runs out.
//
// Controls: drag a computer with the mouse/touch, or Tab to a computer and use
// the arrow keys to nudge it. Crossing count is shown as text (non-colour
// feedback). Reduced Motion removes the cable/positioning transitions.
export function CableUntangle({ seed, reducedMotion, onScore }: SubGameProps) {
  const { t } = useTranslation();

  const [solvedCount, setSolvedCount] = useState(0);
  const [puzzle, setPuzzle] = useState<CablePuzzle>(() => cablePuzzle(`${seed}-0`, cableNodeCount(0)));
  const [pos, setPos] = useState<Record<number, Pos>>(() => cablePositions(puzzle.points));
  const [active, setActive] = useState<number | null>(null);
  const [justSolved, setJustSolved] = useState(false);

  const scoreRef = useRef(0);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const advancing = useRef(false);
  const solvedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const crossings = useMemo(() => countCrossings(puzzle.edges, pos), [puzzle, pos]);

  useEffect(
    () => () => {
      if (solvedTimer.current) clearTimeout(solvedTimer.current);
    },
    [],
  );

  const loadNext = useCallback(
    (nextSolved: number) => {
      const p = cablePuzzle(`${seed}-${nextSolved}`, cableNodeCount(nextSolved));
      setPuzzle(p);
      setPos(cablePositions(p.points));
      setActive(null);
      advancing.current = false;
      setJustSolved(false);
    },
    [seed],
  );

  // When the current board becomes crossing-free, award and queue the next one.
  useEffect(() => {
    if (advancing.current) return;
    if (!cableSolved(puzzle.edges, pos)) return;
    advancing.current = true;
    scoreRef.current += cableSolveScore(puzzle.points.length);
    onScore(scoreRef.current);
    const next = solvedCount + 1;
    setSolvedCount(next);
    setJustSolved(true);
    solvedTimer.current = setTimeout(() => loadNext(next), reducedMotion ? 250 : 700);
  }, [pos, puzzle, solvedCount, onScore, reducedMotion, loadNext]);

  const clampToBoard = (clientX: number, clientY: number): Pos | null => {
    const board = boardRef.current;
    if (!board) return null;
    const r = board.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    return {
      x: Math.max(0.04, Math.min(0.96, (clientX - r.left) / r.width)),
      y: Math.max(0.04, Math.min(0.96, (clientY - r.top) / r.height)),
    };
  };

  const onPointerDownNode = useCallback(
    (e: React.PointerEvent, id: number) => {
      if (advancing.current) return;
      e.preventDefault();
      setActive(id);
      const move = (ev: PointerEvent) => {
        const np = clampToBoard(ev.clientX, ev.clientY);
        if (np) setPos((prev) => ({ ...prev, [id]: np }));
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [],
  );

  const onKeyNode = useCallback((e: React.KeyboardEvent, id: number) => {
    const deltas: Record<string, Pos> = {
      ArrowUp: { x: 0, y: -NUDGE },
      ArrowDown: { x: 0, y: NUDGE },
      ArrowLeft: { x: -NUDGE, y: 0 },
      ArrowRight: { x: NUDGE, y: 0 },
    };
    const d = deltas[e.key];
    if (!d) return;
    e.preventDefault();
    setActive(id);
    setPos((prev) => ({
      ...prev,
      [id]: {
        x: Math.max(0.04, Math.min(0.96, prev[id].x + d.x)),
        y: Math.max(0.04, Math.min(0.96, prev[id].y + d.y)),
      },
    }));
  }, []);

  return (
    <div className={`cable ${reducedMotion ? 'is-reduced' : ''}`}>
      <div className="cable__hud">
        <span>{t('microgame.score', { value: scoreRef.current })}</span>
        <span className={crossings === 0 ? 'cable__crossings is-clear' : 'cable__crossings'}>
          {t('microgame.cableUntangle.crossings', { value: crossings })}
        </span>
        <span>{t('microgame.cableUntangle.board', { value: solvedCount + 1 })}</span>
      </div>

      <div
        ref={boardRef}
        className={`cable__board ${justSolved ? 'is-solved' : ''}`}
        role="group"
        aria-label={t('microgame.cableUntangle.name')}
      >
        <svg className="cable__wires" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {puzzle.edges.map((e, i) => {
            const a = pos[e.a];
            const b = pos[e.b];
            return (
              <line
                key={i}
                x1={a.x * 100}
                y1={a.y * 100}
                x2={b.x * 100}
                y2={b.y * 100}
                className="cable__wire"
              />
            );
          })}
        </svg>
        {puzzle.points.map((p) => {
          const cur = pos[p.id];
          return (
            <button
              key={p.id}
              type="button"
              className={`cable__node ${active === p.id ? 'is-active' : ''}`}
              style={{ left: `${cur.x * 100}%`, top: `${cur.y * 100}%` }}
              onPointerDown={(e) => onPointerDownNode(e, p.id)}
              onKeyDown={(e) => onKeyNode(e, p.id)}
              aria-label={t('microgame.cableUntangle.computer', { value: p.id + 1 })}
            >
              <ComputerGlyph />
            </button>
          );
        })}
        {justSolved ? <div className="cable__cleared">{t('microgame.cableUntangle.cleared')}</div> : null}
      </div>

      <p className="cable__hint muted small">
        {crossings === 0 ? t('microgame.cableUntangle.doneHint') : t('microgame.cableUntangle.hint')}
      </p>
    </div>
  );
}

function ComputerGlyph() {
  return (
    <svg width={30} height={30} viewBox="0 0 32 32" aria-hidden>
      <rect x="5" y="6" width="22" height="15" rx="2" fill="#f0e4c6" stroke="#2a2016" strokeWidth="2" />
      <rect x="8" y="9" width="16" height="9" rx="1" fill="#6f7fb0" stroke="#2a2016" strokeWidth="1" />
      <path d="M12 21 h8 l2 4 h-12 Z" fill="#c9954e" stroke="#2a2016" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
