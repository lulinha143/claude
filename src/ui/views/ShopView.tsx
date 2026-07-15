import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { useFmt } from '../useFmt';
import { UPGRADES } from '../../content/upgrades';
import type { UpgradeDef } from '../../content/types';
import { aggregatePassives, isUpgradeUnlocked, upgradeCost } from '../../sim/economy';
import { Acorn, GoldenNut } from '../../art/Icons';
import { Tip, TipContent } from '../Tooltip';

const CATEGORIES: UpgradeDef['category'][] = [
  'production',
  'automation',
  'furniture',
  'coffee',
  'quality',
  'room',
];

export function ShopView() {
  const { t } = useTranslation();
  const { engine, state } = useGame();
  const fmt = useFmt();
  const audio = useStore((s) => s.audio);
  const [cat, setCat] = useState<UpgradeDef['category']>('production');

  const passives = aggregatePassives(state);
  const visible = UPGRADES.filter((u) => u.category === cat && isUpgradeUnlocked(state, u));

  function buy(u: UpgradeDef) {
    if (engine.buyUpgrade(u.id)) audio.play('upgrade');
    else audio.play('error');
  }

  return (
    <section className="view view--shop">
      <h2>{t('shop.title')}</h2>
      <div className="tabs">
        {CATEGORIES.map((c) => (
          <button key={c} className={`tab ${cat === c ? 'is-active' : ''}`} onClick={() => setCat(c)}>
            {t(`shop.category.${c}`)}
          </button>
        ))}
      </div>
      {visible.length === 0 ? <p className="muted">{t('shop.empty')}</p> : null}
      <ul className="card-list">
        {visible.map((u) => {
          const owned = state.upgrades[u.id] ?? 0;
          const maxed = owned >= u.maxLevel;
          const reduction = u.resource === 'nuts' ? passives.costReduction : 0;
          const cost = upgradeCost(u, owned, reduction);
          const afford = state.resources[u.resource] >= cost;
          return (
            <li key={u.id} className={`card ${maxed ? 'is-maxed' : ''}`}>
              <div className="card__body">
                <div className="card__title">
                  {t(u.nameKey, u.nameParams)}
                  {u.maxLevel > 1 ? <span className="pill">{maxed ? t('common.max') : t('common.level', { level: owned })}</span> : null}
                </div>
                <div className="card__desc">{t(u.descriptionKey, u.nameParams)}</div>
              </div>
              <Tip
                content={
                  <TipContent
                    title={t(u.nameKey, u.nameParams)}
                    lines={[
                      t(u.descriptionKey, u.nameParams),
                      u.maxLevel > 1 ? (maxed ? t('common.max') : t('common.level', { level: owned })) : null,
                      maxed ? null : `${t('common.cost')}: ${fmt.num(cost)}`,
                    ]}
                  />
                }
              >
                <button className="buy-btn" disabled={maxed || !afford} onClick={() => buy(u)}>
                  {maxed ? (
                    t('common.max')
                  ) : (
                    <>
                      {u.resource === 'goldenNuts' ? <GoldenNut size={16} /> : <Acorn size={16} />}
                      <span>{fmt.num(cost)}</span>
                    </>
                  )}
                </button>
              </Tip>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
