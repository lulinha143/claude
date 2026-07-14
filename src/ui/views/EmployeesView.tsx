import { useTranslation } from 'react-i18next';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { useFmt } from '../useFmt';
import { EMPLOYEES } from '../../content/employees';
import { aggregatePassives, employeeLevelCost, isEmployeeUnlocked } from '../../sim/economy';
import { Critter } from '../../art/Critter';
import { shapeFor } from '../../art/critterShapes';
import { Acorn, GoldenNut } from '../../art/Icons';

export function EmployeesView() {
  const { t } = useTranslation();
  const { engine, state } = useGame();
  const fmt = useFmt();
  const audio = useStore((s) => s.audio);
  const passives = aggregatePassives(state);

  return (
    <section className="view view--employees">
      <h2>{t('nav.employees')}</h2>
      <ul className="employee-list">
        {EMPLOYEES.map((def) => {
          const rt = state.employees[def.id];
          const unlocked = isEmployeeUnlocked(state, def);
          const reduction = def.hireCost.resource === 'nuts' ? passives.costReduction : 0;
          const cost = employeeLevelCost(def, rt.level, reduction);
          const afford = state.resources[def.hireCost.resource] >= cost;
          const shape = shapeFor(def.id);
          const accent = def.outfits.find((o) => o.id === rt.outfitId)?.accent ?? def.accent;
          return (
            <li key={def.id} className={`employee-card ${rt.hired ? '' : 'is-locked'}`}>
              <div className="employee-card__art">
                <Critter
                  species={shape.species}
                  color={def.color}
                  accent={accent}
                  state={rt.hired ? 'idle' : 'sleep'}
                  hasGlasses={shape.hasGlasses}
                  size={78}
                  reducedMotion={state.settings.reducedMotion}
                />
              </div>
              <div className="employee-card__info">
                <div className="employee-card__name">
                  {rt.nickname ?? t(def.nameKey)}
                  {rt.hired ? <span className="pill">{t('common.level', { level: rt.level })}</span> : null}
                </div>
                <div className="employee-card__fullname">{t(def.fullNameKey)}</div>
                <div className="employee-card__role">{t(def.roleKey)}</div>
                <div className="employee-card__story">{t(def.storyKey)}</div>
                <div className="employee-card__goal">
                  <span className="goal-label">{t('employee.goal')}</span> {t(def.goalKey)}
                </div>
                {rt.hired ? (
                  <div className="friendship">
                    <span>{t('employee.friendship')}</span>
                    <div className="bar">
                      <div className="bar__fill" style={{ width: `${rt.friendship}%` }} />
                    </div>
                  </div>
                ) : null}
                {rt.hired ? (
                  <div className="employee-card__controls">
                    <input
                      className="nickname-input"
                      placeholder={t('employee.renamePlaceholder')}
                      defaultValue={rt.nickname ?? ''}
                      onBlur={(e) => engine.renameEmployee(def.id, e.target.value)}
                      aria-label={t('employee.nickname')}
                    />
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
                                {o.cost.resource === 'goldenNuts' ? <GoldenNut size={12} /> : <Acorn size={12} />}
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
                      onClick={() => (engine.hireOrLevelEmployee(def.id) ? audio.play('upgrade') : audio.play('error'))}
                    >
                      {def.hireCost.resource === 'goldenNuts' ? <GoldenNut size={16} /> : <Acorn size={16} />}
                      <span>{fmt.num(cost)}</span>
                      <em>{rt.hired ? t('employee.promote') : t('employee.hire')}</em>
                    </button>
                    {rt.hired ? (
                      <button className="ghost-btn" onClick={() => { engine.giveCoffee(def.id); audio.play('coffee'); }}>
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
