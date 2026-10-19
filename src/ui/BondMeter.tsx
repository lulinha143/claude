import { useTranslation } from 'react-i18next';
import { BOND_TIERS, bondProgress } from '../sim/bonds';

// How well you know someone, at a glance: the stage of the relationship as a
// word and three hearts, with a thin bar toward the next stage. The number is
// there for anyone who wants it, but small. When the friendship has just reached
// a new stage the meter itself celebrates ("Now: Trusted"), right where the
// player is already looking.
export function BondMeter({
  friendship,
  compact = false,
  celebrate = false,
}: {
  friendship: number;
  compact?: boolean;
  celebrate?: boolean;
}) {
  const { t } = useTranslation();
  const { tier, next, fraction } = bondProgress(friendship);
  const name = t(`bond.tier.${BOND_TIERS[tier]}`);
  const label = next
    ? `${name} · ${t('bond.next', { tier: t(`bond.tier.${BOND_TIERS[next]}`) })}`
    : name;
  return (
    <div
      className={`visit__bond ${compact ? 'visit__bond--compact' : ''} ${
        celebrate ? 'visit__bond--celebrate' : ''
      }`}
      data-tier={tier}
      data-friendship={Math.round(friendship)}
      title={label}
      aria-label={label}
    >
      <span className="visit__bond-name">
        {celebrate ? t('bond.milestone.title', { tier: name }) : name}
      </span>
      <span className="visit__hearts" aria-hidden>
        {[1, 2, 3].map((n) => (
          <i key={n} className={n <= tier ? 'is-on' : ''} />
        ))}
      </span>
      <span className="talk__bar" aria-hidden>
        <span className="talk__bar-fill" style={{ width: `${Math.round(fraction * 100)}%` }} />
      </span>
      <span className="talk__bar-num" aria-hidden>
        {Math.round(friendship)}
      </span>
    </div>
  );
}
