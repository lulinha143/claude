// The Department Network panel.
//
// The synergy system is only fun if the player can SEE it. This panel is the
// explain-layer for `sim/companyModifiers.ts`: for every department it shows what
// it is currently contributing, what it is costing, and — most importantly — what
import { ROOM_ROUTINES } from '../content/roomPlay';
// it *would* contribute but cannot yet, with the reason.
//
// That last part is the whole design intent. A dormant effect labelled
// "needs Construction running" is a lead the player can act on, which is what
// turns the network from a hidden formula into something to discover and build
// toward. Rooms with nobody in them are called out plainly for the same reason:
// an idle department is the most common reason a company has stalled.
//
// Presented as an internal department report rather than a dashboard: a stamped
// header strip per department, a ruled body, and the section marker used across
// the rest of the Nutshell Inc. interface.

import { useTranslation } from 'react-i18next';
import { useGame } from '../state/hooks';
import {
  roomContributions,
  type DormantEffect,
  type ResolvedEffect,
} from '../sim/companyModifiers';
import { ROOM_PROFILES_BY_ID, type RoomEffectKind } from '../content/roomProfiles';
import { ROOMS_BY_ID } from '../content/rooms';
import { EMPLOYEES_BY_ID } from '../content/employees';
import { Tip, TipContent } from './Tooltip';

/**
 * Effect kinds whose value is a fraction of something (so they read as a
 * percentage) rather than a flat amount added to a resource.
 */
const FRACTIONAL: ReadonlySet<RoomEffectKind> = new Set<RoomEffectKind>([
  'production',
  'clickPower',
  'moraleRegen',
  'comboWindow',
  'costReduction',
  'goldenChance',
  'critChance',
  'eventLuck',
  'automation',
]);

function formatEffect(kind: RoomEffectKind, value: number): string {
  // A discount is stored as a positive number but has to READ as costs going
  // down, otherwise "Costs +18%" looks like the room made everything pricier.
  if (kind === 'costReduction') {
    const pct = Math.abs(value) * 100;
    return `${value > 0 ? '-' : '+'}${pct.toFixed(pct < 10 ? 1 : 0)}%`;
  }
  if (kind === 'reputationRate') {
    // Per-second rates are tiny; per-minute is the readable unit.
    const perMinute = value * 60;
    const sign = perMinute > 0 ? '+' : '';
    return `${sign}${perMinute.toFixed(1)}/min`;
  }
  if (kind === 'moraleTarget') {
    const sign = value > 0 ? '+' : '';
    return `${sign}${Math.round(value)}`;
  }
  if (FRACTIONAL.has(kind)) {
    // Sub-percent levers (golden nut chance) need a decimal to be meaningful.
    const pct = value * 100;
    const sign = pct > 0 ? '+' : '';
    const digits = Math.abs(pct) < 1 ? 2 : Math.abs(pct) < 10 ? 1 : 0;
    return `${sign}${pct.toFixed(digits)}%`;
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}`;
}

/**
 * Semantic tone. Every lever is authored so that "more is better" — including
 * `costReduction`, where a bigger discount is a bigger positive — so a single
 * sign test is correct for all of them. Only the DISPLAY of costs is flipped.
 */
function tone(_kind: RoomEffectKind, value: number): 'good' | 'bad' {
  return value > 0 ? 'good' : 'bad';
}

function EffectRow({ entry }: { entry: ResolvedEffect }) {
  const { t } = useTranslation();
  return (
    <li className={`dept-effect dept-effect--${tone(entry.kind, entry.value)}`}>
      <span className="dept-effect__label">{t(`effect.${entry.kind}`)}</span>
      <span className="dept-effect__value">{formatEffect(entry.kind, entry.value)}</span>
    </li>
  );
}

function DormantRow({ entry }: { entry: DormantEffect }) {
  const { t } = useTranslation();
  const reason =
    entry.reason === 'missing-room'
      ? t('synergy.dormantMissingRoom', {
          room: t(ROOMS_BY_ID[entry.requiresRoom ?? '']?.nameKey ?? entry.requiresRoom ?? ''),
        })
      : entry.reason === 'low-morale'
        ? t('synergy.dormantLowMorale')
        : t('synergy.dormantUnstaffed');
  return (
    <li className="dept-effect dept-effect--dormant">
      <span className="dept-effect__label">{t(`effect.${entry.kind}`)}</span>
      <span className="dept-effect__value">{formatEffect(entry.kind, entry.potential)}</span>
      <span className="dept-effect__reason">{reason}</span>
    </li>
  );
}

export function DepartmentNetwork() {
  const { t } = useTranslation();
  const { state } = useGame();
  const contributions = roomContributions(state).filter((c) => c.unlocked);

  if (contributions.length === 0) {
    return <p className="muted small">{t('synergy.noRooms')}</p>;
  }

  return (
    <div className="dept-network">
      {contributions.map((c) => {
        const profile = ROOM_PROFILES_BY_ID[c.roomId];
        const room = ROOMS_BY_ID[c.roomId];
        if (!profile || !room) return null;
        const idle = c.staffed === 0;
        const specialistNames = c.specialists.map((id) => t(EMPLOYEES_BY_ID[id]?.nameKey ?? id));
        const feeds = (profile.feeds ?? [])
          .map((id) => t(ROOMS_BY_ID[id]?.nameKey ?? id))
          .join(', ');

        return (
          <article
            key={c.roomId}
            data-room={c.roomId}
            data-temper={profile.temper}
            className={`dept-card dept-card--${profile.temper} ${idle ? 'is-idle' : ''}`}
          >
            <header className="dept-card__head">
              <span className="dept-card__marker" aria-hidden />
              <h4 className="dept-card__name">{t(room.nameKey)}</h4>
              <span className="dept-card__temper">{t(`synergy.temper.${profile.temper}`)}</span>
            </header>

            <p className="dept-card__summary">{t(profile.summaryKey)}</p>

            {/* What the player does in the room itself, and the mode it is in. */}
            {ROOM_ROUTINES[c.roomId] ? (
              <p className="dept-card__play">
                <strong>{t('synergy.inRoom', { name: t(`play.${c.roomId}.name`) })}</strong>{' '}
                {(() => {
                  const mode = state.office?.rooms?.[c.roomId]?.mode;
                  return ROOM_ROUTINES[c.roomId].kind === 'tune' && mode
                    ? `${t(`play.${c.roomId}.mode.${mode}.name`)}: ${t(
                        `play.${c.roomId}.mode.${mode}.effect`,
                      )}`
                    : t(`play.${c.roomId}.tip`);
                })()}
              </p>
            ) : null}

            <div className="dept-card__staff">
              {idle ? (
                <Tip
                  content={<TipContent title={t('synergy.idle')} lines={[t('synergy.idleHint')]} />}
                >
                  <span className="dept-card__idle" tabIndex={0}>
                    {t('synergy.idle')}
                  </span>
                </Tip>
              ) : (
                <span className="dept-card__count">
                  {t('synergy.staffed', { count: c.staffed })}
                </span>
              )}
              {specialistNames.length > 0 ? (
                <span className="dept-card__specialists">
                  {t('synergy.specialists', { names: specialistNames.join(', ') })}
                </span>
              ) : null}
            </div>

            {c.effects.length > 0 ? (
              <>
                <h5 className="dept-card__section">{t('synergy.contributes')}</h5>
                <ul className="dept-effects">
                  {c.effects.map((e, i) => (
                    <EffectRow key={`${e.kind}-${i}`} entry={e} />
                  ))}
                </ul>
              </>
            ) : null}

            {c.tradeoffs.length > 0 ? (
              <>
                <h5 className="dept-card__section dept-card__section--cost">
                  {t('synergy.costs')}
                </h5>
                <ul className="dept-effects">
                  {c.tradeoffs.map((e, i) => (
                    <EffectRow key={`${e.kind}-${i}`} entry={e} />
                  ))}
                </ul>
              </>
            ) : null}

            {/* The actionable part: what this room could still give you. */}
            {c.dormant.length > 0 ? (
              <>
                <h5 className="dept-card__section dept-card__section--dormant">
                  {t('synergy.dormant')}
                </h5>
                <ul className="dept-effects">
                  {c.dormant.map((e, i) => (
                    <DormantRow key={`${e.kind}-${i}`} entry={e} />
                  ))}
                </ul>
              </>
            ) : null}

            {feeds ? (
              <p className="dept-card__feeds">{t('synergy.feeds', { rooms: feeds })}</p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
