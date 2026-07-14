import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { EMPLOYEES_BY_ID } from '../../content/employees';
import { Critter } from '../../art/Critter';
import { shapeFor } from '../../art/critterShapes';

export function EventModal() {
  const { t } = useTranslation();
  const { engine } = useGame();
  const audio = useStore((s) => s.audio);
  const active = engine.activeEvent;

  useEffect(() => {
    if (active) audio.play('event');
  }, [active, audio]);

  if (!active) return null;
  const { def, step } = active;
  const body = step && def.steps?.[step] ? def.steps[step].bodyKey : def.bodyKey;
  const choices = step && def.steps?.[step] ? def.steps[step].choices : def.choices;
  const emp = def.employeeId ? EMPLOYEES_BY_ID[def.employeeId] : null;
  const shape = emp ? shapeFor(emp.id) : null;

  return (
    <div className="modal-backdrop">
      <div className={`modal event-modal event-modal--${def.rarity}`} role="dialog" aria-modal>
        <div className="event-modal__head">
          {emp && shape ? (
            <Critter
              color={emp.color}
              accent={emp.accent}
              state="talk"
              earType={shape.earType}
              hasTail={shape.hasTail}
              hasGlasses={shape.hasGlasses}
              hasBeak={shape.hasBeak}
              size={64}
            />
          ) : null}
          <h2>{t(def.titleKey)}</h2>
        </div>
        <p className="event-modal__body">{t(body)}</p>
        <div className="event-modal__prompt">{t('event.resolvePrompt')}</div>
        <div className="event-modal__choices">
          {choices.map((c) => (
            <button key={c.id} className="buy-btn" onClick={() => engine.resolveEventChoice(c.id)}>
              {t(c.labelKey)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
