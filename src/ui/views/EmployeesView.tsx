import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { useFmt } from '../useFmt';
import { EMPLOYEES } from '../../content/employees';
import { aggregatePassives, employeeLevelCost, isEmployeeUnlocked } from '../../sim/economy';
import { unlockedRooms, resolveEmployeeRoom, roomHasSpace } from '../../sim/rooms';
import { Critter } from '../../art/Critter';
import { shapeFor } from '../../art/critterShapes';
import { employeeSprite, VECTOR_CRITTER_CARD_SIZE } from '../../art/employeeSprites';
import { useSpriteAvailabilityRevision } from '../../art/spriteAvailability';
import { EmployeeSprite } from '../../art/EmployeeSprite';
import { Acorn, GoldenNut } from '../../art/Icons';
import { Tip, TipContent } from '../Tooltip';
import { employeeMood, moodProductivityMultiplier, MOOD_POSITIVE, MOOD_TONE } from '../../sim/mood';
import { MoodEmoji } from '../../art/EmployeeMoodBadge';
import { roomAffinity, affinityPercent } from '../../sim/affinity';
import { ROOMS_BY_ID } from '../../content/rooms';
import { canTalk, talkCooldownRemaining } from '../../sim/talks';
import { pendingMoment, wavingTeammates, type PendingMoment } from '../../sim/bonds';
import { BondMeter } from '../BondMeter';
import { employeeGain } from '../../sim/goals';
import { announcePurchase } from '../officeEvents';
import { Glyph, type GlyphName } from '../../art/Glyph';

/** The mark beside "wants to tell you something" (same as the office's). */
const SHARE_GLYPH: Record<PendingMoment['kind'], GlyphName> = {
  story: 'dots',
  milestone: 'heart',
  hint: 'sparkle',
};

export function EmployeesView() {
  const { t } = useTranslation();
  const { engine, state } = useGame();
  const fmt = useFmt();
  const audio = useStore((s) => s.audio);
  const passives = aggregatePassives(state);
  // Fall back to the drawn silhouette if a portrait's artwork is missing.
  useSpriteAvailabilityRevision();

  const hiredCount = Object.values(state.employees).filter((e) => e.hired).length;

  function arrange(strategy: 'department' | 'balanced') {
    const moved = engine.autoArrangeEmployees(strategy);
    audio.play(moved > 0 ? 'upgrade' : 'click');
  }

  // Conversation availability, read fresh each render so the button reflects the
  // cooldown ticking down rather than a stale snapshot.
  const now = Date.now();
  const talkReady = (id: string) => canTalk(state, id, now);
  const waving = wavingTeammates(state, now);
  const cooldown = (id: string) => talkCooldownRemaining(state, id, now);
  const [showReady, setShowReady] = useState(false);
  const readyCount = EMPLOYEES.filter(
    (def) => state.employees[def.id].hired && talkReady(def.id),
  ).length;

  // What each hire or promotion would add per second, measured when the team,
  // purchases, standing or morale move (not on every tick of the sim).
  const [short, setShort] = useState<{ id: string; key: number } | null>(null);
  useEffect(() => {
    if (!short) return undefined;
    const timer = window.setTimeout(() => setShort(null), 2600);
    return () => window.clearTimeout(timer);
  }, [short]);
  const signature = [
    Object.entries(state.upgrades)
      .map(([id, level]) => `${id}${level}`)
      .join(','),
    Object.values(state.employees)
      .map((rt) => `${rt.hired ? 1 : 0}${rt.level}${rt.room ?? ''}`)
      .join(''),
    Math.floor(state.resources.reputation),
    Math.round(state.resources.morale),
  ].join('|');
  const gains = useMemo(
    () => {
      const map = new Map<string, number>();
      for (const def of EMPLOYEES) {
        if (!isEmployeeUnlocked(state, def)) continue;
        const perSecond = employeeGain(state, def.id).perSecond;
        if (perSecond > 0.0001) map.set(def.id, perSecond);
      }
      return map;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature],
  );

  return (
    <section className="view view--employees">
      <div className="view-head">
        <h2>{t('nav.employees')}</h2>
        {hiredCount > 1 ? (
          <div className="arrange-bar" role="group" aria-label={t('employee.autoArrange')}>
            <Tip
              content={
                <TipContent
                  title={t('employee.byDepartment')}
                  lines={[t('employee.byDepartmentTip')]}
                />
              }
            >
              <button className="chip-btn" onClick={() => arrange('department')}>
                {t('employee.byDepartment')}
              </button>
            </Tip>
            <Tip
              content={
                <TipContent title={t('employee.spread')} lines={[t('employee.spreadTip')]} />
              }
            >
              <button className="chip-btn" onClick={() => arrange('balanced')}>
                {t('employee.spread')}
              </button>
            </Tip>
          </div>
        ) : null}
      </div>
      <ul className="employee-list">
        <li className="personnel-index">
          <div>
            <strong>{t('employee.personnelFile')}</strong>
            <span>{t('employee.readyCount', { count: readyCount })}</span>
          </div>
          <button
            className="ghost-btn"
            aria-pressed={showReady}
            onClick={() => setShowReady((v) => !v)}
          >
            {t(showReady ? 'employee.everyone' : 'employee.onlyReady')}
          </button>
          {showReady && !readyCount ? <p>{t('employee.noneReady')}</p> : null}
        </li>
        {EMPLOYEES.filter(
          (def) => !showReady || (state.employees[def.id].hired && talkReady(def.id)),
        ).map((def) => {
          const rt = state.employees[def.id];
          const unlocked = isEmployeeUnlocked(state, def);
          const reduction = def.hireCost.resource === 'nuts' ? passives.costReduction : 0;
          const cost = employeeLevelCost(def, rt.level, reduction);
          const afford = state.resources[def.hireCost.resource] >= cost;
          const shape = shapeFor(def.id);
          const sprite = employeeSprite(def.id);
          const accent = def.outfits.find((o) => o.id === rt.outfitId)?.accent ?? def.accent;
          return (
            <li key={def.id} className={`employee-card ${rt.hired ? '' : 'is-locked'}`}>
              <div className={`employee-card__art ${sprite ? 'employee-card__art--sprite' : ''}`}>
                {sprite ? (
                  <EmployeeSprite
                    config={sprite}
                    // Locked animals stay a still poster; hired ones animate
                    // (unless the player prefers reduced motion).
                    reducedMotion={state.settings.reducedMotion || !rt.hired}
                    height={sprite.cardHeight}
                  />
                ) : (
                  <Critter
                    species={shape.species}
                    color={def.color}
                    accent={accent}
                    state={rt.hired ? 'idle' : 'sleep'}
                    hasGlasses={shape.hasGlasses}
                    size={VECTOR_CRITTER_CARD_SIZE}
                    reducedMotion={state.settings.reducedMotion}
                  />
                )}
              </div>
              <div className="employee-card__info">
                <div className="employee-card__name">
                  {rt.nickname ?? t(def.nameKey)}
                  {rt.hired ? (
                    <span className="pill">{t('common.level', { level: rt.level })}</span>
                  ) : null}
                </div>
                <div className="employee-card__fullname">{t(def.fullNameKey)}</div>
                <div className="employee-card__role">{t(def.roleKey)}</div>
                <div className="employee-card__story">{t(def.storyKey)}</div>
                <div className="employee-card__goal">
                  <span className="goal-label">{t('employee.goal')}</span> {t(def.goalKey)}
                </div>
                {rt.hired ? (
                  <div className="employee-card__bond">
                    <Tip
                      content={
                        <TipContent
                          title={t('employee.friendship')}
                          lines={[
                            t('tip.friendship'),
                            `${Math.round(rt.friendship)}%`,
                            t('bond.closeBonus'),
                          ]}
                        />
                      }
                    >
                      <span>
                        <BondMeter friendship={rt.friendship} compact />
                      </span>
                    </Tip>
                    {(() => {
                      // Something they would like to share, said quietly here too
                      // (for the same few the office shows waving).
                      const moment = waving.get(def.id);
                      return moment ? (
                        <span className="employee-card__share" data-kind={moment.kind}>
                          <span className="employee-card__share-mark" aria-hidden>
                            <Glyph name={SHARE_GLYPH[moment.kind]} size={11} />
                          </span>
                          {t(`bond.pending.${moment.kind}`, {
                            name: rt.nickname ?? t(def.nameKey),
                          })}
                        </span>
                      ) : null;
                    })()}
                  </div>
                ) : null}
                {rt.hired ? (
                  <div className="employee-card__controls">
                    {(() => {
                      const mood = employeeMood(state, def.id);
                      const mm = moodProductivityMultiplier(mood);
                      const delta = Math.round((mm - 1) * 100);
                      const effect =
                        delta === 0
                          ? t('mood.effectNeutral')
                          : t('mood.effect', { value: `${delta > 0 ? '+' : ''}${delta}` });
                      return (
                        <Tip
                          content={
                            <TipContent title={t(`mood.${mood}`)} lines={[t('tip.mood'), effect]} />
                          }
                        >
                          <span
                            className={`mood-chip ${MOOD_POSITIVE[mood] ? 'mood-chip--positive' : 'mood-chip--negative'}`}
                            data-mood={mood}
                            style={{ ['--mood-color' as string]: MOOD_TONE[mood] }}
                          >
                            <MoodEmoji mood={mood} color={MOOD_TONE[mood]} />
                            <span className="mood-chip__label">{t(`mood.${mood}`)}</span>
                            <em className={delta >= 0 ? 'prod-pos' : 'prod-neg'}>
                              {delta > 0 ? '+' : ''}
                              {delta}%
                            </em>
                          </span>
                        </Tip>
                      );
                    })()}
                    {(() => {
                      const room = resolveEmployeeRoom(state, def.id);
                      const tier = roomAffinity(def.id, room);
                      const pct = affinityPercent(def.id, room);
                      return (
                        <Tip
                          content={
                            <TipContent
                              title={t(`affinity.${tier}`)}
                              lines={[t('tip.affinity'), t(ROOMS_BY_ID[room]?.nameKey ?? room)]}
                            />
                          }
                        >
                          <span className={`affinity-chip affinity-chip--${tier}`}>
                            {t(`affinity.${tier}`)}
                            {pct !== 0 ? (
                              <em className={pct > 0 ? 'prod-pos' : 'prod-neg'}>
                                {pct > 0 ? '+' : ''}
                                {pct}%
                              </em>
                            ) : null}
                          </span>
                        </Tip>
                      );
                    })()}
                    <input
                      className="nickname-input"
                      placeholder={t('employee.renamePlaceholder')}
                      defaultValue={rt.nickname ?? ''}
                      onBlur={(e) => engine.renameEmployee(def.id, e.target.value)}
                      aria-label={t('employee.nickname')}
                    />
                    <label className="assign-row">
                      <span>{t('employee.assignRoom')}</span>
                      <select
                        className="select"
                        value={rt.room ?? ''}
                        onChange={(e) => engine.assignEmployee(def.id, e.target.value || null)}
                      >
                        <option value="">{t('overview.autoRoom')}</option>
                        {unlockedRooms(state).map((r) => {
                          const pct = affinityPercent(def.id, r.id);
                          const tag = pct > 0 ? `  (+${pct}%)` : pct < 0 ? `  (${pct}%)` : '';
                          // A full room is shown but not selectable, so the roster
                          // explains why a desk is unavailable instead of accepting
                          // the choice and quietly putting them somewhere else.
                          const here = resolveEmployeeRoom(state, def.id) === r.id;
                          const full = !here && !roomHasSpace(state, r.id);
                          return (
                            <option key={r.id} value={r.id} disabled={full}>
                              {t(r.nameKey)}
                              {tag}
                              {full ? `  — ${t('office.roomFullShort')}` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                    <div className="outfits">
                      {def.outfits.map((o) => {
                        const owns = state.collections.outfits.includes(o.id);
                        const active = rt.outfitId === o.id;
                        return (
                          <button
                            key={o.id}
                            className={`outfit-chip ${active ? 'is-active' : ''}`}
                            style={{ borderColor: o.accent }}
                            onClick={() => engine.setEmployeeOutfit(def.id, o.id)}
                            title={t(o.nameKey)}
                          >
                            <span className="dot" style={{ background: o.accent }} />
                            {t(o.nameKey)}
                            {!owns && o.cost.amount > 0 ? (
                              <span className="outfit-cost">
                                {o.cost.resource === 'goldenNuts' ? (
                                  <GoldenNut size={12} />
                                ) : (
                                  <Acorn size={12} />
                                )}
                                {o.cost.amount}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="employee-card__actions">
                {!unlocked ? (
                  <span className="muted small">
                    {t('employee.unlockAt', { value: def.unlock.reputation ?? 0 })}
                  </span>
                ) : (
                  <>
                    {/* What the hire or promotion buys, measured like the goal tag. */}
                    {gains.get(def.id) ? (
                      <span className="employee-card__gain">
                        {t('goal.perSecond', { value: fmt.num(gains.get(def.id) ?? 0) })}
                      </span>
                    ) : null}
                    <button
                      className="buy-btn"
                      // Short of the price: still pressable, so it can say what is missing.
                      aria-disabled={afford ? undefined : true}
                      onClick={() => {
                        if (afford && engine.hireOrLevelEmployee(def.id)) {
                          audio.play('upgrade');
                          setShort(null);
                          announcePurchase({
                            title: rt.hired
                              ? t('goal.level', {
                                  name: rt.nickname ?? t(def.nameKey),
                                  level: rt.level + 1,
                                })
                              : t('goal.hire', { name: t(def.nameKey) }),
                            gain: gains.get(def.id)
                              ? t('goal.perSecond', { value: fmt.num(gains.get(def.id) ?? 0) })
                              : null,
                            employeeId: def.id,
                          });
                        } else {
                          audio.play('error');
                          setShort({ id: def.id, key: Date.now() });
                        }
                      }}
                    >
                      {def.hireCost.resource === 'goldenNuts' ? (
                        <GoldenNut size={16} />
                      ) : (
                        <Acorn size={16} />
                      )}
                      <span>{fmt.num(cost)}</span>
                      <em>{rt.hired ? t('employee.promote') : t('employee.hire')}</em>
                    </button>
                    {short?.id === def.id && !afford ? (
                      <span key={short.key} className="employee-card__short" role="status">
                        {t('shop.shortNote', {
                          amount:
                            def.hireCost.resource === 'goldenNuts'
                              ? t('station.tip.goldenAmount', {
                                  amount: fmt.int(
                                    Math.ceil(cost - state.resources[def.hireCost.resource]),
                                  ),
                                })
                              : t('station.tip.nutAmount', {
                                  amount: fmt.int(
                                    Math.ceil(cost - state.resources[def.hireCost.resource]),
                                  ),
                                }),
                        })}
                      </span>
                    ) : null}
                    {rt.hired ? (
                      <button
                        className="ghost-btn"
                        disabled={engine.coffeeCooldownRemaining(def.id) > 0}
                        onClick={() => {
                          if (engine.giveCoffee(def.id)) audio.play('coffee');
                        }}
                      >
                        {engine.coffeeCooldownRemaining(def.id) > 0
                          ? t('employee.coffeeCooling', {
                              seconds: engine.coffeeCooldownRemaining(def.id),
                            })
                          : t('employee.give_coffee')}
                      </button>
                    ) : null}
                    {/* The roster is the reliable way in: the office critter only opens
                        a conversation when one is available, so without this a player
                        who has just talked to someone has no visible affordance at all.
                        Disabled-with-a-reason rather than hidden, so the cooldown and
                        the "nothing new to say" state are legible. */}
                    {rt.hired ? (
                      <Tip
                        content={
                          talkReady(def.id)
                            ? t('talk.tip.ready')
                            : cooldown(def.id) > 0
                              ? t('talk.tip.cooldown', { seconds: cooldown(def.id) })
                              : t('talk.tip.nothing')
                        }
                      >
                        <button
                          className="ghost-btn employee-card__talk"
                          data-employee={def.id}
                          onClick={() => {
                            // A teammate with something to share opens straight onto it.
                            const moment = pendingMoment(state, def.id, Date.now());
                            const opened =
                              moment?.kind === 'story'
                                ? engine.openTalk(def.id, moment.topicId, true)
                                : engine.openTalk(def.id, undefined, true, {
                                    tab: moment?.kind === 'hint' ? 'gifts' : 'talk',
                                  });
                            audio.play(opened ? 'paper' : 'error');
                          }}
                        >
                          {t('talk.open')}
                        </button>
                      </Tip>
                    ) : null}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
