import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../state/hooks';
import { useStore } from '../state/store';
import { EMPLOYEES_BY_ID } from '../content/employees';
import { UPGRADES_BY_ID } from '../content/upgrades';
import { goalProgress, nextGoal, type Goal } from '../sim/goals';
import { announcePurchase, focusFloor } from './officeEvents';
import { useFmt } from './useFmt';
import { Icon } from '../art/UiIcon';

// The immediate goal, on a paper tag in the office: what the next purchase is,
// how close the company is to it, and what it will change. Once it is affordable
// the tag IS the purchase — one tap, no menu — and it says what just changed
// before moving on to the next goal. The full lists stay in the Upgrades and
// Team sheets; the tag only ever offers the next sensible step.

const BOUGHT_MS = 1400;

function goalName(t: ReturnType<typeof useTranslation>['t'], goal: Goal, owned = 0): string {
  if (goal.kind === 'hire' || goal.kind === 'level') {
    const name = t(EMPLOYEES_BY_ID[goal.id]?.nameKey ?? goal.id);
    return goal.kind === 'hire'
      ? t('goal.hire', { name })
      : t('goal.level', { name, level: goal.level });
  }
  // A machine bought again says which level comes next, so the tag visibly moves
  // on after a purchase instead of repeating the same name.
  const name = t(goal.nameKey, goal.nameParams);
  return owned > 0 ? t('goal.nextLevel', { name, level: owned + 1 }) : name;
}

function goalGain(
  t: ReturnType<typeof useTranslation>['t'],
  fmt: ReturnType<typeof useFmt>,
  goal: Goal,
): string | null {
  if (goal.kind === 'room') return t('goal.opens');
  if (goal.gain.perSecond > 0.0001)
    return t('goal.perSecond', { value: fmt.num(goal.gain.perSecond) });
  if (goal.gain.perTap > 0.0001) return t('goal.perTap', { value: fmt.num(goal.gain.perTap) });
  const kind = UPGRADES_BY_ID[goal.id]?.effect.kind;
  return kind ? t(`goal.effect.${kind}`, { defaultValue: '' }) || null : null;
}

export function GoalTag() {
  const { t } = useTranslation();
  const fmt = useFmt();
  const { engine, state } = useGame();
  const audio = useStore((s) => s.audio);
  const setView = useStore((s) => s.setView);
  const opening = useStore((s) => s.showOpening || s.showOnboarding);
  // A minigame covers the office: the tag rests until it is back.
  const minigameOpen = useStore((s) => s.minigameOpen);
  const [bought, setBought] = useState<{ name: string; gain: string | null } | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  // Which purchase is next (and what it changes) only moves when something is
  // bought, the team changes or a threshold opens something up, so it is measured
  // then, not on every one of the ten sim ticks a second. Progress is live.
  const signature = [
    Object.entries(state.upgrades)
      .map(([id, level]) => `${id}${level}`)
      .join(','),
    Object.values(state.employees)
      .map((rt) => `${rt.hired ? 1 : 0}${rt.level}`)
      .join(''),
    Math.floor(state.resources.reputation),
    state.prestige.count,
  ].join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const goal = useMemo(() => nextGoal(state), [signature]);

  if (opening || minigameOpen) return null;
  if (!goal && !bought) return null;

  if (bought) {
    return (
      <div className="goal-tag is-bought" role="status">
        <span className="goal-tag__icon" aria-hidden>
          <Icon name="production" size={15} />
        </span>
        <span className="goal-tag__body">
          <span className="goal-tag__name">{bought.name}</span>
          <span className="goal-tag__gain">{bought.gain ?? t('goal.bought')}</span>
        </span>
      </div>
    );
  }

  const g = goal as Goal;
  const progress = goalProgress(state, g);
  const ready = progress >= 1;
  const name = goalName(t, g, g.kind === 'upgrade' ? (state.upgrades[g.id] ?? 0) : 0);
  const gain = goalGain(t, fmt, g);
  // The very first purchase of a new company: the coach points here.
  const first =
    Object.keys(state.upgrades).length === 0 &&
    Object.entries(state.employees).every(([id, rt]) => id === 'pip' || !rt.hired) &&
    (state.employees.pip?.level ?? 1) <= 1;

  function buy() {
    const ok =
      g.kind === 'hire' || g.kind === 'level'
        ? engine.hireOrLevelEmployee(g.id)
        : engine.buyUpgrade(g.id);
    if (!ok) return;
    audio.play(g.kind === 'room' ? 'celebrate' : 'upgrade');
    setBought({ name, gain });
    if (g.kind === 'room' && g.roomId) {
      const roomId = g.roomId;
      window.setTimeout(() => focusFloor(roomId), 160);
    } else {
      // The purchase lands in the office, not only on the tag: the team there
      // cheers and a slip on the room says what just changed.
      announcePurchase({
        title: name,
        gain,
        employeeId: g.kind === 'hire' || g.kind === 'level' ? g.id : undefined,
      });
    }
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setBought(null);
    }, BOUGHT_MS);
  }

  function browse() {
    audio.play('click');
    setView(g.kind === 'hire' || g.kind === 'level' ? 'employees' : 'shop');
  }

  return (
    <button
      type="button"
      className={`goal-tag ${ready ? 'is-ready' : ''} ${ready && first ? 'is-coached' : ''}`}
      data-goal={g.kind}
      data-goal-id={g.id}
      style={{ ['--goal-progress' as string]: progress.toFixed(3) } as CSSProperties}
      onClick={ready ? buy : browse}
      aria-label={`${t('goal.next')}: ${name}. ${gain ?? ''} ${
        ready
          ? t('goal.buy')
          : t('goal.progress', { have: fmt.int(state.resources.nuts), need: fmt.int(g.cost) })
      }`}
      title={ready ? undefined : t('goal.open')}
    >
      <span className="goal-tag__icon" aria-hidden>
        <Icon
          name={
            g.kind === 'hire' || g.kind === 'level'
              ? 'employees'
              : g.kind === 'room'
                ? 'rooms'
                : 'production'
          }
          size={15}
        />
      </span>
      <span className="goal-tag__body">
        <span className="goal-tag__name">{name}</span>
        {gain ? <span className="goal-tag__gain">{gain}</span> : null}
        {!ready ? (
          <span className="goal-tag__bar" aria-hidden>
            <span className="goal-tag__fill" />
          </span>
        ) : null}
      </span>
      <span className="goal-tag__cost">
        {ready ? (
          <span className="goal-tag__buy">
            {t('goal.buy')} <Icon name="nut" size={11} /> {fmt.int(g.cost)}
          </span>
        ) : (
          <>
            <Icon name="nut" size={11} /> {fmt.int(g.cost)}
          </>
        )}
      </span>
    </button>
  );
}
