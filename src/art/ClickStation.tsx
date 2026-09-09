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
import { tapPop, tapPunch, type TapTone } from '../ui/tapFeedback';
import { stationDepth } from '../sim/depth';
import { comboWindowMs, type ClickResolution } from '../sim/clickStations';
import type { ClickStationDef } from '../content/clickStations';
import type { SfxName } from '../audio/audio';

export interface ClickStationProps {
  def: ClickStationDef;
  /** Resolve a tap. Returns null when the station is unavailable. */
  onTap: (stationId: string) => ClickResolution | null;
  /** Formatted payout preview for the tooltip. */
  previewText: string;
  /** Names of teammates in the room boosting this station (already localized). */
  synergyNames: string[];
  play: (name: SfxName, opts?: { pitch?: number }) => void;
  formatAmount: (value: number) => string;
}

export function ClickStation({
  def,
  onTap,
  previewText,
  synergyNames,
  play,
  formatAmount,
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

      // Sound: pitch climbs with the streak so a combo audibly builds.
      const sfx: SfxName = result.golden
        ? 'stationGolden'
        : result.critical
          ? 'stationCrit'
          : 'stationTap';
      play(sfx, { pitch: 1 + Math.min(0.6, (result.streak - 1) * 0.03) });

      // Number + punch, both imperative.
      const prefix = result.resource === 'goldenNuts' ? '\u2726' : '+';
      tapPop({
        x: event.clientX,
        y: event.clientY,
        text: `${prefix}${formatAmount(result.amount)}`,
        tone,
        streak: result.streak,
      });
      tapPunch(element, tone);

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
    [def.cadence, def.id, flushStreak, formatAmount, onTap, play],
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
      {synergyNames.length > 0 ? (
        <span className="station-tip__synergy">
          {t('station.tip.synergy', { names: synergyNames.join(', ') })}
        </span>
      ) : null}
    </span>
  );

  return (
    <Tip content={tip}>
      <button
        type="button"
        className={`station-btn station-btn--${def.kind} station-btn--${def.cadence}`}
        style={{
          left: `${def.x * 100}%`,
          bottom: `${def.bottom}px`,
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
        <StationArt kind={def.kind} />
        {streak >= 3 ? (
          <span className="station-btn__combo" aria-hidden>
            {`\u00d7${streak}`}
          </span>
        ) : null}
      </button>
    </Tip>
  );
}
