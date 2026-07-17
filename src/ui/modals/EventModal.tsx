import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { EMPLOYEES_BY_ID } from '../../content/employees';
import { Critter } from '../../art/Critter';
import { shapeFor } from '../../art/critterShapes';
import type { EventChoice } from '../../content/types';
import type { GameState } from '../../sim/types';
import { PopupShell, usePopupExit, type PopupVariant } from './PopupShell';

function choiceEnabled(state: GameState, c: EventChoice): boolean {
  const r = c.requires;
  if (!r) return true;
  if (r.nuts && state.resources.nuts < r.nuts) return false;
  if (r.goldenNuts && state.resources.goldenNuts < r.goldenNuts) return false;
  if (r.reputation && state.resources.reputation < r.reputation) return false;
  if (r.hiredEmployee && !state.employees[r.hiredEmployee]?.hired) return false;
  return true;
}

export function EventModal() {
  const { t } = useTranslation();
  const { engine, state } = useGame();
  const audio = useStore((s) => s.audio);
  const active = engine.activeEvent;
  const { closing, exitThen } = usePopupExit();

  useEffect(() => {
    if (active) audio.play('event');
  }, [active, audio]);

  if (!active) return null;
  const { def, step } = active;
  const body = step && def.steps?.[step] ? def.steps[step].bodyKey : def.bodyKey;
  const choices = step && def.steps?.[step] ? def.steps[step].choices : def.choices;
  const emp = def.employeeId ? EMPLOYEES_BY_ID[def.employeeId] : null;
  const shape = emp ? shapeFor(emp.id) : null;
  const variant: PopupVariant = def.rarity === 'legendary'
    ? 'critical'
    : def.rarity === 'rare'
      ? 'warning'
      : emp
        ? 'employee'
        : 'choice';
  const titleId = `event-title-${def.id}`;

  return (
    <PopupShell
      variant={variant}
      className={`event-modal event-modal--${def.rarity}`}
      titleId={titleId}
      closing={closing}
    >
      <div className="event-modal__head">
        {emp && shape ? (
          <Critter
            species={shape.species}
            color={emp.color}
            accent={emp.accent}
            state="talk"
            hasGlasses={shape.hasGlasses}
            size={68}
          />
        ) : null}
        <h2 id={titleId}>{t(def.titleKey)}</h2>
      </div>
      <p className="event-modal__body">{t(body)}</p>
      <div className="event-modal__prompt">{t('event.resolvePrompt')}</div>
      <div className="event-modal__choices">
        {choices.map((choice) => {
          const enabled = choiceEnabled(state, choice);
          return (
            <button
              key={choice.id}
              className="event-choice"
              disabled={!enabled || closing}
              onClick={() => enabled && exitThen(() => engine.resolveEventChoice(choice.id))}
            >
              <span>{t(choice.labelKey)}</span>
              {!enabled && choice.disabledKey ? (
                <span className="event-choice__req">{t(choice.disabledKey)}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </PopupShell>
  );
}
