import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BUG_HOLES,
  BUG_SPECIES_BY_ID,
  advanceBugBoard,
  bugShiftAt,
  createBugBoard,
  microComboMultiplier,
  microComboNext,
  whackBugBoard,
  type BugBoard,
  type BugBoardEvent,
  type BugShiftId,
  type BugWhackOutcome,
} from '../../sim/minigames';
import { useStore } from '../../state/store';
import { BugArt } from './MinigameArt';
import type { SubGameProps } from './MicroGame';

type Mark =
  | { id: number; hole: number; type: 'hit'; species: string; points: number; multiplier: number }
  | { id: number; hole: number; type: 'miss'; lost: number }
  | { id: number; hole: number; type: 'feature'; lost: number }
  | { id: number; hole: number; type: 'escape' }
  | { id: number; hole: number; type: 'hop' };

/** Omit applied to each member of a union separately (a plain Omit merges them). */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** A mark before it has an id. */
type NewMark = DistributiveOmit<Mark, 'id'>;

const TICK_MS = 50;

// Bug Squash — a reaction and judgement game. Pests pop from a 3x3 grid of drawers
// for a shrinking window; up to three at once in the round's last shift. Runners
// hop, armoured pests take two taps, the golden bug is worth five, and the feature
// is not a bug at all. The desk's rules are one pure value (sim/minigames.ts); this
// component drives its clock, renders it and feeds it taps.
//
// Input resolves on PRESS (pointer down), where a whack-a-mole player commits — a
// click's release can come after a pest has ducked. Keyboard: Tab and the arrow
// keys move between drawers, Enter/Space taps, and 1-9 tap a drawer directly (the
// number on its tab).
export function BugSquash({ seed, reducedMotion, paused, onScore, onCombo }: SubGameProps) {
  const { t } = useTranslation();
  const audio = useStore((state) => state.audio);
  const initial = useMemo(() => createBugBoard(seed), [seed]);
  const boardRef = useRef<BugBoard>(initial);
  const [board, setBoard] = useState<BugBoard>(initial);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [banner, setBanner] = useState<{ id: number; shift: BugShiftId } | null>(null);
  const [feedback, setFeedback] = useState('');
  const clockRef = useRef(0);
  const markId = useRef(0);
  const pointerPressed = useRef<{ hole: number; at: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer);
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    },
    [],
  );

  function addMark(mark: NewMark, ms: number) {
    const id = (markId.current += 1);
    const next = { ...mark, id } as Mark;
    setMarks((current) => [
      ...current.filter((m) => m.hole !== next.hole || m.type === 'hop'),
      next,
    ]);
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setMarks((current) => current.filter((m) => m.id !== id));
    }, ms);
    timers.current.add(timer);
  }

  function commit(next: BugBoard) {
    boardRef.current = next;
    setBoard(next);
  }

  function reportBoard(events: BugBoardEvent[]) {
    for (const event of events) {
      if (event.type === 'escape') {
        addMark({ hole: event.pest.hole, type: 'escape' }, reducedMotion ? 700 : 520);
        if (event.chainLost > 0) {
          onCombo(1, 0);
          setFeedback(t('microgame.bugSquash.escaped', { count: event.chainLost }));
        }
      } else if (event.type === 'hop') {
        addMark({ hole: event.from, type: 'hop' }, reducedMotion ? 520 : 420);
      } else if (event.type === 'shift') {
        setBanner({ id: performance.now(), shift: event.shift.id });
        setFeedback(t(`microgame.bugSquash.shift.${event.shift.id}.title`));
        if (bannerTimer.current) clearTimeout(bannerTimer.current);
        bannerTimer.current = setTimeout(() => setBanner(null), 1900);
        if (event.shift.index > 0) audio.play('chime');
      } else if (event.type === 'spawn' && event.pest.species === 'rare') {
        setFeedback(t('microgame.bugSquash.golden'));
      }
    }
  }

  // One driver owns the desk's clock (active time only: a pause stops it, and the
  // time spent paused is never counted).
  useEffect(() => {
    if (paused) {
      pointerPressed.current = null;
      return;
    }
    let lastTick = performance.now();
    const id = setInterval(() => {
      const tick = performance.now();
      clockRef.current += Math.min(250, tick - lastTick);
      lastTick = tick;
      const { board: next, events } = advanceBugBoard(boardRef.current, clockRef.current);
      if (next !== boardRef.current) commit(next);
      if (events.length > 0) reportBoard(events);
    }, TICK_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  function report(outcome: BugWhackOutcome, score: number) {
    switch (outcome.type) {
      case 'grace':
        return;
      case 'empty':
        onScore(score);
        onCombo(1, 0);
        audio.play('error');
        addMark(
          { hole: outcome.hole, type: 'miss', lost: outcome.lost },
          reducedMotion ? 520 : 420,
        );
        setFeedback(
          outcome.lost > 0
            ? t('microgame.bugSquash.penalty', { value: outcome.lost })
            : t('microgame.bugSquash.empty'),
        );
        return;
      case 'feature':
        onScore(score);
        onCombo(1, 0);
        audio.play('error');
        addMark(
          { hole: outcome.pest.hole, type: 'feature', lost: outcome.lost },
          reducedMotion ? 900 : 700,
        );
        setFeedback(t('microgame.bugSquash.feature', { value: outcome.lost }));
        return;
      case 'crack':
        audio.play('click');
        setFeedback(t('microgame.bugSquash.cracked'));
        return;
      case 'hit': {
        onScore(score);
        onCombo(outcome.multiplier, outcome.chain);
        audio.play('bugHit', { pitch: 1 + (outcome.multiplier - 1) * 0.12 });
        addMark(
          {
            hole: outcome.pest.hole,
            type: 'hit',
            species: outcome.pest.species,
            points: outcome.points,
            multiplier: outcome.multiplier,
          },
          reducedMotion ? 480 : 460,
        );
        setFeedback(
          outcome.pest.species === 'rare'
            ? t('microgame.bugSquash.goldenHit', { value: outcome.points })
            : t('microgame.bugSquash.hit', { value: outcome.points }),
        );
      }
    }
  }

  function whack(hole: number) {
    if (paused) return;
    const { board: next, outcome } = whackBugBoard(boardRef.current, hole, clockRef.current);
    if (next !== boardRef.current) commit(next);
    report(outcome, next.score);
  }

  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>, hole: number) {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pointerPressed.current = { hole, at: performance.now() };
    whack(hole);
  }

  function onClick(event: React.MouseEvent<HTMLButtonElement>, hole: number) {
    // A pointer press already resolved this tap; its click is the same gesture.
    const pressed = pointerPressed.current;
    if (
      event.detail > 0 &&
      pressed &&
      pressed.hole === hole &&
      performance.now() - pressed.at < 1500
    ) {
      pointerPressed.current = null;
      return;
    }
    pointerPressed.current = null;
    whack(hole);
  }

  function focusHole(hole: number) {
    gridRef.current
      ?.querySelectorAll<HTMLButtonElement>('.burrow')
      [hole]?.focus({ preventScroll: true });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (paused || event.altKey || event.ctrlKey || event.metaKey) return;
    const digit = Number(event.key);
    if (/^[1-9]$/.test(event.key) && digit >= 1 && digit <= BUG_HOLES) {
      event.preventDefault();
      if (!event.repeat) whack(digit - 1);
      return;
    }
    const current = gridRef.current
      ? [...gridRef.current.querySelectorAll('.burrow')].indexOf(document.activeElement as Element)
      : -1;
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -3,
      ArrowDown: 3,
    };
    if (event.key in moves) {
      event.preventDefault();
      // From the desk itself, the first arrow lands in the middle drawer.
      if (current < 0) {
        focusHole(4);
        return;
      }
      const from = current;
      const delta = moves[event.key];
      const column = from % 3;
      if ((delta === -1 && column === 0) || (delta === 1 && column === 2)) return;
      const target = from + delta;
      if (target >= 0 && target < BUG_HOLES) focusHole(target);
    }
  }

  const chain = board.chain;
  const mult = microComboMultiplier('bugSquash', chain);
  const next = microComboNext('bugSquash', chain);
  const shift = bugShiftAt(board.clock / 1000);
  const pestAt = new Map(board.pests.map((pest) => [pest.hole, pest]));
  const featureUp = board.pests.some((pest) => BUG_SPECIES_BY_ID[pest.species].hazard);

  return (
    <div
      className={`bugsquash bugsquash--shift-${shift.id} ${marks.some((m) => m.type === 'miss' || m.type === 'feature') ? 'is-wrong' : ''}`}
    >
      {/* Over the status row, never over the board: a banner must not hide targets. */}
      {banner ? (
        <span
          className={`micro-banner micro-banner--${banner.shift}`}
          key={banner.id}
          aria-hidden="true"
        >
          <b>{t(`microgame.bugSquash.shift.${banner.shift}.title`)}</b>
          <small>{t(`microgame.bugSquash.shift.${banner.shift}.body`)}</small>
        </span>
      ) : null}
      <span className="micro-feedback" role="status" aria-live="polite">
        {feedback}
      </span>
      <div className="bugsquash__status">
        <span className="bugsquash__ticket">
          <b>{t(`microgame.bugSquash.shift.${shift.id}.title`)}</b>
          <small>{t('microgame.bugSquash.shiftCount', { value: shift.index + 1, total: 3 })}</small>
        </span>
        <span className={`bugsquash__streak ${mult > 1 ? 'is-hot' : ''}`}>
          <b>
            {chain > 0 ? t('microgame.chain', { count: chain }) : t('microgame.bugSquash.scanning')}
          </b>
          <small>
            {next === null
              ? t('microgame.comboMax')
              : t('microgame.comboNext', { value: mult + 1, count: next - chain })}
          </small>
        </span>
        <span className="bugsquash__threat" aria-hidden="true">
          {Array.from({ length: 3 }, (_, index) => (
            <i key={index} className={index < board.pests.length ? 'is-alert' : ''} />
          ))}
        </span>
      </div>
      <div className={`bugsquash__desk ${featureUp ? 'has-feature' : ''}`}>
        <div className="bugsquash__props" aria-hidden="true">
          <span className="bugsquash__monitor">
            <b>BUG</b>
            <b>TRACKER</b>
            <i />
          </span>
          <span className="bugsquash__papers">
            <b>URGENT</b>
          </span>
          <span className="bugsquash__lamp" />
        </div>
        <div
          ref={gridRef}
          className="bugsquash__grid"
          data-game-control
          tabIndex={-1}
          role="group"
          aria-label={t('microgame.bugSquash.grid')}
          onKeyDown={onKeyDown}
        >
          {Array.from({ length: BUG_HOLES }, (_, index) => {
            const pest = pestAt.get(index);
            const species = pest ? BUG_SPECIES_BY_ID[pest.species] : null;
            const hit = marks.find((mark) => mark.hole === index && mark.type === 'hit');
            const miss = marks.find(
              (mark) => mark.hole === index && (mark.type === 'miss' || mark.type === 'feature'),
            );
            const escaped = marks.some((mark) => mark.hole === index && mark.type === 'escape');
            const hopped = marks.some((mark) => mark.hole === index && mark.type === 'hop');
            const urgent = pest
              ? board.clock > pest.endsAt - Math.min(380, (pest.endsAt - pest.bornAt) * 0.32)
              : false;
            return (
              <button
                key={index}
                type="button"
                className={[
                  'burrow',
                  pest ? `is-up burrow--${pest.species}` : '',
                  urgent ? 'is-urgent' : '',
                  hit ? 'is-hit' : '',
                  miss ? 'is-wrong' : '',
                  escaped ? 'is-escaped' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                data-hole={index}
                onPointerDown={(event) => onPointerDown(event, index)}
                onClick={(event) => onClick(event, index)}
                disabled={paused}
                aria-label={t(
                  species
                    ? species.hazard
                      ? 'microgame.bugSquash.featureLabel'
                      : `microgame.bugSquash.pest.${species.id}`
                    : 'microgame.burrow',
                  { value: index + 1 },
                )}
              >
                <span className="burrow__folder-tab" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="burrow__hole" aria-hidden="true" />
                {pest && species ? (
                  <span
                    className={`burrow__pest ${pest.hoppedFrom !== null ? 'has-hopped' : ''}`}
                    key={`${pest.token}-${pest.hole}`}
                  >
                    <BugArt species={species} cracked={pest.tapsLeft < species.taps} />
                    {species.taps > 1 ? (
                      <span className="burrow__taps" aria-hidden="true">
                        {Array.from({ length: species.taps }, (_, tap) => (
                          <i
                            key={tap}
                            className={tap < species.taps - pest.tapsLeft ? 'is-spent' : ''}
                          />
                        ))}
                      </span>
                    ) : null}
                  </span>
                ) : null}
                {hit && hit.type === 'hit' ? (
                  <>
                    <span className="burrow__squashed" aria-hidden="true">
                      <BugArt
                        species={BUG_SPECIES_BY_ID[hit.species as keyof typeof BUG_SPECIES_BY_ID]}
                        squashed
                      />
                    </span>
                    <span
                      className={`burrow__impact ${hit.species === 'rare' ? 'is-golden' : ''}`}
                      aria-hidden="true"
                    >
                      <b>+{hit.points}</b>
                      {Array.from({ length: 6 }, (_, piece) => (
                        <i key={piece} style={{ ['--i' as string]: piece }} />
                      ))}
                    </span>
                  </>
                ) : null}
                {miss && (miss.type === 'miss' || miss.type === 'feature') ? (
                  <span
                    className={`burrow__miss ${miss.type === 'feature' ? 'is-feature' : ''}`}
                    aria-hidden="true"
                  >
                    <b>{miss.lost > 0 ? `-${miss.lost}` : '0'}</b>
                    {miss.type === 'feature' ? (
                      <small>{t('microgame.bugSquash.featureMark')}</small>
                    ) : null}
                  </span>
                ) : null}
                {escaped && !pest ? (
                  <span className="burrow__escape" aria-hidden="true">
                    {t('microgame.bugSquash.escapeMark')}
                  </span>
                ) : null}
                {hopped && !pest ? <span className="burrow__dust" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
