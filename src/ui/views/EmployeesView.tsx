import { useTranslation } from 'react-i18next';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { useFmt } from '../useFmt';
import { EMPLOYEES } from '../../content/employees';
import { aggregatePassives, employeeLevelCost, isEmployeeUnlocked } from '../../sim/economy';
import { unlockedRooms, resolveEmployeeRoom } from '../../sim/rooms';
import { Critter } from '../../art/Critter';
import { shapeFor } from '../../art/critterShapes';
import { employeeSprite, presenceSize } from '../../art/employeeSprites';
import { useSpriteAvailabilityRevision } from '../../art/spriteAvailability';
import { EmployeeSprite } from '../../art/EmployeeSprite';
import { Acorn, GoldenNut } from '../../art/Icons';
import { Tip, TipContent } from '../Tooltip';
import { employeeMood, moodProductivityMultiplier, MOOD_POSITIVE, MOOD_TONE } from '../../sim/mood';
import { MoodEmoji } from '../../art/EmployeeMoodBadge';
import { roomAffinity, affinityPercent } from '../../sim/affinity';
import { ROOMS_BY_ID } from '../../content/rooms';

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
        {EMPLOYEES.map((def) => {
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
                    size={presenceSize(78)}
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
                  <Tip
                    content={
                      <TipContent
                        title={t('employee.friendship')}
                        lines={[t('tip.friendship'), `${Math.round(rt.friendship)}%`]}
                      />
                    }
                  >
                    <div className="friendship">
                      <span>{t('employee.friendship')}</span>
                      <div className="bar">
                        <div className="bar__fill" style={{ width: `${rt.friendship}%` }} />
                      </div>
                    </div>
                  </Tip>
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
                          return (
                            <option key={r.id} value={r.id}>
                              {t(r.nameKey)}
                              {tag}
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
                    <button
                      className="buy-btn"
                      disabled={!afford}
                      onClick={() =>
                        engine.hireOrLevelEmployee(def.id)
                          ? audio.play('upgrade')
                          : audio.play('error')
                      }
                    >
                      {def.hireCost.resource === 'goldenNuts' ? (
                        <GoldenNut size={16} />
                      ) : (
                        <Acorn size={16} />
                      )}
                      <span>{fmt.num(cost)}</span>
                      <em>{rt.hired ? t('employee.promote') : t('employee.hire')}</em>
                    </button>
                    {rt.hired ? (
                      <button
                        className="ghost-btn"
                        onClick={() => {
                          engine.giveCoffee(def.id);
                          audio.play('coffee');
                        }}
                      >
                        {t('employee.give_coffee')}
                      </button>
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
