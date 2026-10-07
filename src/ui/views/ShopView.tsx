import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { useFmt } from '../useFmt';
import { UPGRADES, UPGRADES_BY_ID } from '../../content/upgrades';
import type { UpgradeDef } from '../../content/types';
import {
  aggregatePassives,
  isUpgradeUnlocked,
  upgradeCost,
  upgradeSaturated,
} from '../../sim/economy';
import { nextGoal, unlocksMoreUpgrades, upgradeGain, type Goal } from '../../sim/goals';
import type { GameState } from '../../sim/types';
import { Acorn, GoldenNut } from '../../art/Icons';
import { sparkleAt } from '../sparkle';
import { announcePurchase } from '../officeEvents';

// The Upgrades sheet: a short list per category in which every row says, in
// numbers, what one more level does (measured on a copy of the company, exactly
// like the goal tag), what it costs and how far off it is. A purchase answers at
// once: "Feito! +0,4/s" on the row, a slip and a cheer in the office, the rate
// on the HUD. A purchase that is short answers too — a shake and what is
// missing — instead of a dead greyed-out button.

const CATEGORIES: UpgradeDef['category'][] = [
  'production',
  'automation',
  'furniture',
  'coffee',
  'quality',
  'room',
];

const FEEDBACK_MS = 2600;

interface Feedback {
  id: string;
  tone: 'ok' | 'short';
  text: string;
  key: number;
}

/** What moves the measured gains: purchases, the team, standing and morale. */
function gainSignature(state: GameState): string {
  return [
    Object.entries(state.upgrades)
      .map(([id, level]) => `${id}${level}`)
      .join(','),
    Object.values(state.employees)
      .map((rt) => `${rt.hired ? 1 : 0}${rt.level}${rt.room ?? ''}`)
      .join(''),
    Math.floor(state.resources.reputation),
    Math.round(state.resources.morale),
    state.prestige.count,
  ].join('|');
}

export function ShopView() {
  const { t } = useTranslation();
  const { engine, state } = useGame();
  const fmt = useFmt();
  const audio = useStore((s) => s.audio);
  const signature = gainSignature(state);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const goal: Goal | null = useMemo(() => nextGoal(state), [signature]);
  const [cat, setCat] = useState<UpgradeDef['category']>(() => {
    const def = goal ? UPGRADES_BY_ID[goal.id] : undefined;
    return def && CATEGORIES.includes(def.category) ? def.category : 'production';
  });
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const keyRef = useRef(0);
  useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(
      () => setFeedback((current) => (current?.key === feedback.key ? null : current)),
      FEEDBACK_MS,
    );
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const passives = aggregatePassives(state);
  const costOf = (u: UpgradeDef) =>
    upgradeCost(u, state.upgrades[u.id] ?? 0, u.resource === 'nuts' ? passives.costReduction : 0);
  const isDone = (u: UpgradeDef) =>
    (state.upgrades[u.id] ?? 0) >= u.maxLevel || upgradeSaturated(state, u);
  const visible = UPGRADES.filter((u) => u.category === cat && isUpgradeUnlocked(state, u));
  // The next thing this category will offer, said once at the foot of the list.
  const upcoming = UPGRADES.find((u) => u.category === cat && !isUpgradeUnlocked(state, u));
  // Which categories hold something ready to buy right now.
  const readyIn = new Set(
    UPGRADES.filter(
      (u) => isUpgradeUnlocked(state, u) && !isDone(u) && state.resources[u.resource] >= costOf(u),
    ).map((u) => u.category),
  );

  // Measured only when something that moves them changes, not on every sim tick.
  const gains = useMemo(
    () => {
      const map = new Map<string, Goal['gain']>();
      for (const u of visible) {
        if (u.effect.kind === 'globalMultiplier' || u.effect.kind === 'clickPower') {
          map.set(u.id, upgradeGain(state, u.id));
        }
      }
      return map;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature, cat],
  );

  const small = useMemo(
    () => new Intl.NumberFormat(fmt.locale, { maximumFractionDigits: 2 }),
    [fmt.locale],
  );
  const pct = (fraction: number) => small.format(Math.round(fraction * 1000) / 10);

  /**
   * A measured gain too small to show at all (a hand-strength level once the
   * production slice carries every tap): said in words, never as "+0".
   */
  function negligible(u: UpgradeDef): boolean {
    const gain = gains.get(u.id);
    if (!gain) return false;
    const value = u.effect.kind === 'clickPower' ? gain.perTap : gain.perSecond;
    return fmt.num(value) === fmt.num(0);
  }
  /** Worth it for what its first level opens, as the goal tag says too. */
  function opens(u: UpgradeDef): boolean {
    if (goal?.id === u.id && goal.opens) return true;
    return negligible(u) && unlocksMoreUpgrades(state, u.id);
  }
  /** Nothing to promise: the gain line is shown quietly. */
  const faint = (u: UpgradeDef) => negligible(u) && !opens(u);

  /** One concrete line: what another level does. */
  function effectText(u: UpgradeDef): string {
    const e = u.effect;
    const gain = gains.get(u.id);
    if (opens(u)) return t('goal.unlocksMore');
    if (negligible(u)) return t('shop.effect.negligible');
    switch (e.kind) {
      case 'globalMultiplier':
        return t('goal.perSecond', { value: fmt.num(gain?.perSecond ?? 0) });
      case 'clickPower':
        return t('goal.perTap', { value: fmt.num(gain?.perTap ?? 0) });
      case 'unlockRoom':
        return t('shop.effect.unlockRoom');
      case 'autoCollect':
      case 'critChance':
      case 'comboWindow':
      case 'goldenChance':
      case 'eventReward':
      case 'roomEfficiency':
        return t(`shop.effect.${e.kind}`, { value: pct(e.perLevel) });
      case 'offlineCapHours':
      case 'reputationRate':
      case 'moraleCap':
        return t(`shop.effect.${e.kind}`, { value: small.format(e.perLevel) });
      default:
        return '';
    }
  }

  function amountWithUnit(u: UpgradeDef, amount: number): string {
    return u.resource === 'goldenNuts'
      ? t('station.tip.goldenAmount', { amount: fmt.int(Math.ceil(amount)) })
      : t('station.tip.nutAmount', { amount: fmt.int(Math.ceil(amount)) });
  }

  function buy(u: UpgradeDef, event: React.MouseEvent) {
    if (isDone(u)) return;
    const cost = costOf(u);
    const name = t(u.nameKey, u.nameParams);
    // Said before the purchase changes what the row measures. A negligible gain
    // is not celebrated as one.
    const promised = faint(u) ? '' : effectText(u);
    if (state.resources[u.resource] < cost || !engine.buyUpgrade(u.id)) {
      audio.play('error');
      // What is missing is said live on the row (its note is worked out as it
      // renders), so it keeps agreeing with the button while production ticks in.
      setFeedback({ id: u.id, tone: 'short', text: '', key: ++keyRef.current });
      return;
    }
    audio.play(u.effect.kind === 'unlockRoom' ? 'celebrate' : 'upgrade');
    sparkleAt(event);
    setFeedback({
      id: u.id,
      tone: 'ok',
      text: promised ? t('shop.bought', { gain: promised }) : t('shop.boughtPlain'),
      key: ++keyRef.current,
    });
    // The purchase lands in the office too: a slip on the room and a cheer.
    if (u.effect.kind !== 'unlockRoom') announcePurchase({ title: name, gain: promised || null });
  }

  return (
    <section className="view view--shop">
      <h2>{t('shop.title')}</h2>
      <div className="tabs shop-tabs" role="tablist" aria-label={t('shop.title')}>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={cat === c}
            className={`tab ${cat === c ? 'is-active' : ''}`}
            data-category={c}
            onClick={() => setCat(c)}
          >
            {t(`shop.category.${c}`)}
            {readyIn.has(c) ? (
              <span className="shop-tabs__dot" title={t('shop.ready')}>
                <span className="sr-only">{t('shop.ready')}</span>
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {visible.length === 0 ? <p className="empty-state">{t('shop.empty')}</p> : null}
      <ul className="card-list shop-list">
        {visible.map((u) => {
          const owned = state.upgrades[u.id] ?? 0;
          const maxed = owned >= u.maxLevel;
          const done = maxed || upgradeSaturated(state, u);
          const cost = costOf(u);
          const have = state.resources[u.resource];
          const afford = have >= cost;
          const golden = u.resource === 'goldenNuts';
          const name = t(u.nameKey, u.nameParams);
          const pressed = feedback?.id === u.id ? feedback : null;
          // A "short" answer lasts only while it is true, and counts down live.
          const note =
            pressed?.tone === 'short'
              ? afford || done
                ? null
                : {
                    ...pressed,
                    text: t('shop.shortNote', {
                      amount: amountWithUnit(u, Math.max(1, cost - have)),
                    }),
                  }
              : pressed;
          const effect = done ? null : effectText(u);
          return (
            <li
              key={u.id}
              data-upgrade={u.id}
              className={`card shop-item ${done ? 'is-maxed' : ''} ${
                !done && afford ? 'is-affordable' : ''
              } ${golden ? 'is-golden' : ''} ${note ? `is-${note.tone}` : ''}`}
            >
              <div className="card__body">
                <div className="card__title">
                  <span className="shop-item__name">{name}</span>
                  {u.maxLevel > 1 ? (
                    <span className="pill">
                      {maxed ? t('common.max') : t('common.level', { level: owned })}
                    </span>
                  ) : null}
                  {goal?.id === u.id && !done ? (
                    <span className="shop-item__goal">{t('shop.goal')}</span>
                  ) : null}
                </div>
                {effect ? (
                  <div className={`shop-item__gain ${faint(u) ? 'is-faint' : ''}`}>{effect}</div>
                ) : null}
                <div className="card__desc">
                  {done && !maxed ? t('shop.completeNote') : t(u.descriptionKey, u.nameParams)}
                </div>
              </div>
              <button
                type="button"
                className={`buy-btn shop-item__buy ${golden ? 'is-golden' : ''}`}
                disabled={done}
                aria-disabled={!done && !afford ? true : undefined}
                aria-label={
                  done
                    ? `${name}: ${maxed ? t('common.max') : t('shop.complete')}`
                    : `${t('shop.buy')} ${name}: ${amountWithUnit(u, cost)}${
                        afford
                          ? ''
                          : `. ${t('shop.short', { amount: amountWithUnit(u, cost - have) })}`
                      }`
                }
                onClick={(e) => buy(u, e)}
              >
                {done ? (
                  <span>{maxed ? t('common.max') : t('shop.complete')}</span>
                ) : (
                  <>
                    {golden ? <GoldenNut size={15} /> : <Acorn size={15} />}
                    <span className="shop-item__cost">{fmt.num(cost)}</span>
                    {afford ? null : (
                      <span className="shop-item__short">
                        {t('shop.short', { amount: fmt.num(Math.max(1, Math.ceil(cost - have))) })}
                      </span>
                    )}
                  </>
                )}
              </button>
              {note ? (
                <p key={note.key} className={`shop-item__note is-${note.tone}`} role="status">
                  {note.text}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {upcoming ? (
        <p className="shop-next">
          {t('shop.next', {
            name: t(upcoming.nameKey, upcoming.nameParams),
            condition: upcoming.unlock?.upgradeId
              ? t('shop.after', {
                  name: (() => {
                    const before = UPGRADES_BY_ID[upcoming.unlock.upgradeId];
                    return before ? t(before.nameKey, before.nameParams) : '';
                  })(),
                })
              : upcoming.unlock?.reputation
                ? t('shop.atReputation', { value: fmt.int(upcoming.unlock.reputation) })
                : t('shop.afterPrestige'),
          })}
        </p>
      ) : null}
    </section>
  );
}
