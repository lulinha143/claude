// A tappable piece of room equipment.
//
// This is the component that has to feel good, so it is built around one rule:
// a tap must produce sound, motion and a number on the very next frame, no matter
// how fast the previous tap was.
//
// How that is achieved:
//  - `onPointerDown` drives the tap, not `onClick`. Click fires after pointerup,
//    which adds perceptible latency to a held-and-mashed button.
//  - Payout numbers and the button's compression are done imperatively (see
//    ui/tapFeedback.ts), so a tap costs no React render.
//  - The only React state here is the combo readout, and it is throttled to
//    animation frames rather than updated per tap.
//  - There is no cooldown, no debounce, and no disabled window. The engine pays
//    out on every single call.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StationArt } from './StationArt';
import { Tip } from '../ui/Tooltip';
import { flyToCounter, markTapBurst, tapPop, tapPunch, type TapTone } from '../ui/tapFeedback';
import { stationDepth } from '../sim/depth';
import { CLICK, comboWindowMs } from '../sim/clickStations';
import type { StationTapResult } from '../sim/engine';
import type { ClickStationDef } from '../content/clickStations';
import type { SfxName } from '../audio/audio';
import type { RoutineStatus } from '../sim/roomPlay';

/** The founder's crate, as the crate station shows it. */
export interface CrateView {
  /** 0..1 */
  fill: number;
  full: boolean;
  /** formatted amounts / time, ready to show. */
  stored: string;
  capacity: string;
  eta: string | null;
}

export interface ClickStationProps {
  def: ClickStationDef;
  /** Resolve a tap. Returns null when the station is unavailable. */
  onTap: (stationId: string) => StationTapResult | null;
  /** the crate's contents (crate station only). */
  crate?: CrateView;
  /** taps of combo that set this room rushing. */
  rushAt: number;
  /** epoch ms this station's room stops rushing (0 when it is not). */
  rushEndsAt: number;
  /** nobody works in this room, so a rush would speed up no one. */
  roomEmpty?: boolean;
  /** the first-run coach is pointing at this station. */
  coached?: boolean;
  /** Formatted payout preview for the tooltip. */
  previewText: string;
  /** Names of teammates in the room boosting this station (already localized). */
  synergyNames: string[];
  play: (name: SfxName, opts?: { pitch?: number }) => void;
  formatAmount: (value: number) => string;
  /** the room's routine, so the machine itself shows it: brewing, ready, stuck, a blip. */
  playStatus?: RoutineStatus;
}

export function ClickStation({
  def,
  onTap,
  crate,
  rushAt,
  rushEndsAt,
  roomEmpty = false,
  coached = false,
  previewText,
  synergyNames,
  play,
  formatAmount,
  playStatus,
}: ClickStationProps) {
  const { t } = useTranslation();
  const [streak, setStreak] = useState(0);
  // The combo readout is derived from the last tap, but repainting it on every
  // tap would defeat the point of the imperative feedback path. A single pending
  // frame coalesces however many taps land in between.
  const pendingStreakRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const lapseRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    if (lapseRef.current !== null) window.clearTimeout(lapseRef.current);
    frameRef.current = null;
    lapseRef.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const flushStreak = useCallback(() => {
    frameRef.current = null;
    const next = pendingStreakRef.current;
    pendingStreakRef.current = null;
    if (next === null) return;
    setStreak(next);
  }, []);

  const handleTap = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      // Only the primary button taps; let other buttons fall through.
      if (event.button !== 0) return;
      const element = event.currentTarget;
      const result = onTap(def.id);
      if (!result) return;

      const tone: TapTone = result.golden ? 'golden' : result.critical ? 'critical' : 'normal';
      const box = element.getBoundingClientRect();

      // Sound: pitch climbs with the streak so a combo audibly builds.
      const sfx: SfxName = result.golden
        ? 'stationGolden'
        : result.critical
          ? 'stationCrit'
          : 'stationTap';
      play(sfx, { pitch: 1 + Math.min(0.6, (result.streak - 1) * 0.03) });

      // Number + punch, both imperative.
      // Golden payouts are distinguished by the popup's tone class, not by a glyph:
      // decorative symbols outside the bundled Latin subset render as tofu boxes.
      const prefix = '+';
      tapPop({
        x: event.clientX,
        y: event.clientY,
        text: `${prefix}${formatAmount(result.amount)}`,
        tone,
        streak: result.streak,
      });
      tapPunch(element, tone);
      // Get the station's own tooltip out from over the machine for the burst.
      markTapBurst();

      // The crate pays out what the team packed into it: the big moment of a visit.
      if (result.crate && result.crate > 0) {
        const worth = result.crate >= 1 ? result.crate : 0;
        if (worth > 0) {
          tapPop({
            x: box.left + box.width / 2,
            y: box.top - 6,
            text: `+${formatAmount(worth)}`,
            tone: 'collect',
          });
          // A crate worth noticing gets the full flight to the counter.
          if (result.crate >= Math.max(5, result.amount * 3)) {
            flyToCounter(box.left + box.width / 2, box.top + box.height / 3, 6);
            play('collect');
          }
        }
      }
      // Keeping the rhythm sets the whole room rushing.
      if (result.rush === 'started') {
        tapPop({
          x: box.left + box.width / 2,
          y: box.top - 24,
          text: t('rush.started'),
          tone: 'rush',
        });
        play('celebrate');
      }

      // Coalesced combo readout.
      pendingStreakRef.current = result.streak;
      if (frameRef.current === null) {
        frameRef.current = requestAnimationFrame(flushStreak);
      }

      // Let the readout fade once the combo window has actually lapsed.
      if (lapseRef.current !== null) window.clearTimeout(lapseRef.current);
      lapseRef.current = window.setTimeout(() => {
        lapseRef.current = null;
        pendingStreakRef.current = null;
        setStreak(0);
      }, comboWindowMs(def.cadence));
    },
    [def.cadence, def.id, flushStreak, formatAmount, onTap, play, t],
  );

  const cadenceLabel = t(`station.cadence.${def.cadence}`);
  const tip = (
    <span className="station-tip">
      <strong className="station-tip__name">{t(def.nameKey)}</strong>
      <span className="station-tip__hint">{t(def.hintKey)}</span>
      <span className="station-tip__row">
        <span className="station-tip__label">{t('station.tip.perTap')}</span>
        <span className="station-tip__value">{previewText}</span>
      </span>
      <span className="station-tip__row">
        <span className="station-tip__label">{t('station.tip.cadence')}</span>
        <span className="station-tip__value">{cadenceLabel}</span>
      </span>
      {crate ? (
        <>
          <span className="station-tip__row">
            <span className="station-tip__label">{t('crate.inside')}</span>
            <span className="station-tip__value">
              {crate.stored} / {crate.capacity}
            </span>
          </span>
          <span className="station-tip__synergy">
            {crate.full
              ? t('crate.full')
              : crate.eta
                ? t('crate.fullIn', { time: crate.eta })
                : null}
          </span>
          <span className="station-tip__hint">{t('crate.why')}</span>
        </>
      ) : null}
      {synergyNames.length > 0 ? (
        <span className="station-tip__synergy">
          {t('station.tip.synergy', { names: synergyNames.join(', ') })}
        </span>
      ) : null}
      <span className="station-tip__hint">
        {roomEmpty ? t('rush.empty') : t('rush.tip', { taps: rushAt, seconds: CLICK.rushSeconds })}
      </span>
    </span>
  );
  const rushing = rushEndsAt > Date.now();
  const rushLeft = Math.max(0, (rushEndsAt - Date.now()) / 1000);
  const meter = rushing ? 1 : Math.min(1, streak / rushAt);

  return (
    <Tip content={tip}>
      <button
        type="button"
        className={`station-btn station-btn--${def.kind} station-btn--${def.cadence} ${
          rushing ? 'is-rushing' : ''
        } ${crate?.full ? 'is-full' : ''} ${coached ? 'is-coached' : ''} ${
          playStatus ? `is-play-${playStatus}` : ''
        }`}
        data-fill={crate ? Math.round(crate.fill * 4) : undefined}
        style={{
          ['--rush-meter' as string]: meter.toFixed(3),
          ['--crate-fill' as string]: crate ? crate.fill.toFixed(3) : undefined,
          left: `${def.x * 100}%`,
          // Authored in scene pixels, so it tracks the scene scale exactly like a
          // character's slot depth does; a station is furniture in the same room.
          bottom: `calc(${def.bottom}px * var(--asset-scale))`,
          zIndex: stationDepth(1 - def.bottom / 40),
        }}
        // Pointer-down for immediate response; the browser's synthetic click is
        // suppressed for the same gesture by handling it here only.
        onPointerDown={handleTap}
        onKeyDown={(e) => {
          // Keyboard players get the same station without the pointer path.
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          handleTap({
            button: 0,
            currentTarget: e.currentTarget,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top,
          } as unknown as React.PointerEvent<HTMLButtonElement>);
        }}
        aria-label={t(def.nameKey)}
        data-station={def.id}
      >
        <span className="station-btn__hit" aria-hidden />
        {/* Combo meter: fills toward the room's rush, glows while it rushes. */}
        {streak >= 2 || rushing ? (
          <span className="station-btn__meter" aria-hidden>
            {rushing ? (
              <span
                key={rushEndsAt}
                className="station-btn__meter-drain"
                style={{ animationDuration: `${rushLeft.toFixed(2)}s` }}
              />
            ) : null}
          </span>
        ) : null}
        <StationArt kind={def.kind} />
        {/* The first-run coach says it in words too, on a tag over the machine. */}
        {coached ? (
          <span className="station-btn__coach" aria-hidden>
            {t('crate.coach')}
          </span>
        ) : null}
        {crate ? (
          <span className="station-btn__heap" aria-hidden>
            <span className="station-btn__heap-nuts" />
          </span>
        ) : null}
        {crate && (crate.fill >= 0.15 || crate.full) ? (
          <span className="station-btn__stash" aria-hidden>
            {crate.full ? t('crate.fullShort') : crate.stored}
          </span>
        ) : null}
        {streak >= 3 ? (
          <span className="station-btn__combo" aria-hidden>
            {`\u00d7${streak}`}
          </span>
        ) : null}
      </button>
    </Tip>
  );
}
