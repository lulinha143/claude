// The company's standing, shown as a ladder rather than a float.
//
// Reputation used to be a bare number with no sense of where it was going. Naming
// the rungs does the progression work: the player can see which tier they hold,
// what it is worth, how close the next one is, and — because the names escalate
// from "Unlisted Entity" to "Irregular Global Institution" — roughly how strange
// the company is becoming.

import { useTranslation } from 'react-i18next';
import { useGame } from '../state/hooks';
import {
  REPUTATION_TIERS,
  nextReputationTier,
  reputationTier,
  reputationTierIndex,
  reputationTierProgress,
} from '../content/reputationTiers';
import { useFmt } from './useFmt';

/** The perks a tier grants, as readable lines. */
function perkLines(
  perk: NonNullable<(typeof REPUTATION_TIERS)[number]['perk']> | undefined,
  t: (key: string) => string,
): string[] {
  if (!perk) return [];
  const lines: string[] = [];
  const pct = (v: number) => `+${Math.round(v * 100)}%`;
  if (perk.automation) lines.push(`${t('effect.automation')} ${pct(perk.automation)}`);
  if (perk.costReduction)
    lines.push(`${t('effect.costReduction')} \u2212${Math.round(perk.costReduction * 100)}%`);
  if (perk.eventLuck) lines.push(`${t('effect.eventLuck')} ${pct(perk.eventLuck)}`);
  if (perk.goldenChance)
    lines.push(`${t('effect.goldenChance')} +${(perk.goldenChance * 100).toFixed(2)}%`);
  return lines;
}

export function ReputationLadder() {
  const { t } = useTranslation();
  const { state } = useGame();
  const fmt = useFmt();
  const reputation = state.resources.reputation;
  const tier = reputationTier(reputation);
  const next = nextReputationTier(reputation);
  const progress = reputationTierProgress(reputation);
  const index = reputationTierIndex(reputation);

  return (
    <div className="rep-ladder">
      <header className="rep-ladder__head">
        <span className="rep-ladder__marker" aria-hidden />
        <div className="rep-ladder__titles">
          <strong className="rep-ladder__tier">{t(tier.nameKey)}</strong>
          <span className="rep-ladder__step">
            {index + 1}/{REPUTATION_TIERS.length}
          </span>
        </div>
      </header>

      <p className="rep-ladder__blurb">{t(tier.blurbKey)}</p>

      {/* Progress toward the next rung, with the actual numbers alongside so the
          bar is informative rather than decorative. */}
      <div
        className="rep-ladder__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-label={t('repTier.progressLabel')}
      >
        <span className="rep-ladder__fill" style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="rep-ladder__foot">
        <span className="rep-ladder__now">{fmt.num(reputation)}</span>
        {next ? (
          <span className="rep-ladder__next">
            {t('repTier.nextAt', { name: t(next.nameKey), at: fmt.num(next.at) })}
          </span>
        ) : (
          <span className="rep-ladder__next">{t('repTier.maxed')}</span>
        )}
      </div>

      {(() => {
        const lines = perkLines(tier.perk, t);
        if (lines.length === 0) return null;
        return (
          <ul className="rep-ladder__perks">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        );
      })()}
    </div>
  );
}
