import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { useFmt } from '../useFmt';
import { canPrestige, kernelsFromPrestige } from '../../sim/prestige';
import { PRESTIGE_BRANCHES, PRESTIGE_SKILLS } from '../../content/prestige';
import type { PrestigeBranchDef } from '../../content/types';
import type { PrestigeBranchId } from '../../sim/types';
import { Icon } from '../../art/UiIcon';

/** Signed percentage, so a cost reads as a cost rather than as a bare number. */
function signedPercent(value: number): string {
  const percent = Math.round(value * 1000) / 10;
  return `${percent > 0 ? '+' : ''}${percent}%`;
}

/**
 * The effects a branch actually applies, read straight off the definition.
 *
 * Only non-zero terms are listed: a branch with no rare-event bonus should say nothing
 * about rare events rather than advertise "+0%".
 */
function branchEffects(branch: PrestigeBranchDef) {
  const effects: { label: string; value: string; good: boolean }[] = [];
  if (branch.productionMultiplier !== 1) {
    effects.push({
      label: 'prestige.effect.production',
      value: signedPercent(branch.productionMultiplier - 1),
      good: branch.productionMultiplier > 1,
    });
  }
  if (branch.moraleBonus !== 0) {
    effects.push({
      label: 'prestige.effect.morale',
      value: `${branch.moraleBonus > 0 ? '+' : ''}${branch.moraleBonus}`,
      good: branch.moraleBonus > 0,
    });
  }
  if (branch.rareEventChance !== 0) {
    effects.push({
      label: 'prestige.effect.rareEvents',
      value: signedPercent(branch.rareEventChance),
      good: branch.rareEventChance > 0,
    });
  }
  return effects;
}

export function PrestigeView() {
  const { t } = useTranslation();
  const { state } = useGame();
  const fmt = useFmt();
  const doPrestige = useStore((s) => s.doPrestige);
  const buySkill = useStore((s) => s.buySkill);
  const [selected, setSelected] = useState<PrestigeBranchId>(state.prestige.branch ?? 'industrial');
  const [confirming, setConfirming] = useState(false);

  const unlocked = canPrestige(state);
  const kernels = kernelsFromPrestige(state);

  return (
    <section className="view view--prestige">
      <h2>{t('prestige.title')}</h2>
      <p className="muted">{t('prestige.explain')}</p>

      {!unlocked ? (
        <div className="panel">
          <p>{t('prestige.lockedUntil', { value: fmt.num(1_000_000) })}</p>
          <div className="bar">
            <div
              className="bar__fill"
              style={{
                width: `${Math.min(100, (state.stats.totalNutsEarned / 1_000_000) * 100)}%`,
              }}
            />
          </div>
        </div>
      ) : (
        <div className="panel">
          <p>{t('prestige.willEarn', { value: fmt.num(kernels) })}</p>
          <h3>{t('prestige.chooseBranch')}</h3>
          <div className="branch-grid">
            {PRESTIGE_BRANCHES.map((b) => (
              <button
                key={b.id}
                className={`branch ${selected === b.id ? 'is-active' : ''}`}
                onClick={() => setSelected(b.id)}
              >
                <strong>{t(b.nameKey)}</strong>
                <span>{t(b.descriptionKey)}</span>
                {/* The numbers, not just the adjectives.
                    Branch choice is permanent and once per run, and the prose alone
                    ("gentle bonuses", "Big rare-event chance") gives no way to compare
                    two branches. These chips are derived from the SAME fields the
                    simulation reads, so a card can never drift away from what the
                    branch actually does — which is exactly how the morale and
                    rare-event effects managed to be fictional for so long. */}
                <span className="branch__effects">
                  {branchEffects(b).map((effect) => (
                    <em key={effect.label} className={effect.good ? '' : 'is-cost'}>
                      {t(effect.label, { value: effect.value })}
                    </em>
                  ))}
                </span>
              </button>
            ))}
          </div>
          {confirming ? (
            <div className="confirm-row">
              <span>{t('prestige.confirm')}</span>
              <button className="buy-btn" onClick={() => doPrestige(selected)}>
                {t('common.confirm')}
              </button>
              <button className="ghost-btn" onClick={() => setConfirming(false)}>
                {t('common.cancel')}
              </button>
            </div>
          ) : (
            <button className="buy-btn buy-btn--big" onClick={() => setConfirming(true)}>
              {t('prestige.title')}
            </button>
          )}
        </div>
      )}

      <div className="panel">
        <h3 className="skill-head">
          {t('prestige.skillTree')}
          <span className="kernel-count">
            <Icon name="kernel" size={16} /> {fmt.int(state.resources.permanentKernels)}
          </span>
        </h3>
        <ul className="card-list">
          {PRESTIGE_SKILLS.map((sk) => {
            const level = state.prestige.skills[sk.id] ?? 0;
            const maxed = level >= sk.maxLevel;
            const afford = state.resources.permanentKernels >= sk.cost;
            return (
              <li key={sk.id} className={`card ${maxed ? 'is-maxed' : ''}`}>
                <div className="card__body">
                  <div className="card__title">
                    {t(sk.nameKey)}
                    <span className="pill">
                      {maxed ? t('common.max') : t('common.level', { level })}
                    </span>
                  </div>
                  <div className="card__desc">{t(sk.descriptionKey)}</div>
                </div>
                <button
                  className="buy-btn"
                  disabled={maxed || !afford}
                  onClick={() => buySkill(sk.id)}
                >
                  {maxed ? (
                    t('common.max')
                  ) : (
                    <>
                      <Icon name="kernel" size={14} /> {sk.cost}
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
