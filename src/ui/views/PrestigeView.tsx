import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { useFmt } from '../useFmt';
import { canPrestige, kernelsFromPrestige } from '../../sim/prestige';
import { PRESTIGE_BRANCHES, PRESTIGE_SKILLS } from '../../content/prestige';
import type { PrestigeBranchId } from '../../sim/types';
import { Icon } from '../../art/UiIcon';

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
              style={{ width: `${Math.min(100, (state.stats.totalNutsEarned / 1_000_000) * 100)}%` }}
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
                    <span className="pill">{maxed ? t('common.max') : t('common.level', { level })}</span>
                  </div>
                  <div className="card__desc">{t(sk.descriptionKey)}</div>
                </div>
                <button className="buy-btn" disabled={maxed || !afford} onClick={() => buySkill(sk.id)}>
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
