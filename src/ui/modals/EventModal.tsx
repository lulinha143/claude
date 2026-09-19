import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { EMPLOYEES_BY_ID } from '../../content/employees';
import { DiscoveryArt } from '../../art/DiscoveryArt';
import { Critter } from '../../art/Critter';
import { shapeFor } from '../../art/critterShapes';
import {
  eventChoicesForState,
  reportEventChoiceRepairs,
  type EventRequirementFailure,
} from '../../sim/eventChoices';
import { PopupShell, usePopupExit, type PopupVariant } from './PopupShell';

export function EventModal() {
  const { t } = useTranslation();
  const { engine, state } = useGame();
  const audio = useStore((s) => s.audio);
  const devEnabled = useStore((s) => s.devEnabled);
  const active = engine.activeEvent;
  const { closing, exitThen } = usePopupExit();
  const choiceSet = active ? eventChoicesForState(state, active.def, active.step) : null;
  const availabilitySignature = choiceSet
    ? JSON.stringify(
        choiceSet.choices.map(({ choice, enabled, failures }) => ({
          id: choice.id,
          enabled,
          failures,
        })),
      )
    : '';

  useEffect(() => {
    if (active) audio.play('event');
  }, [active, audio]);

  useEffect(() => {
    if (!active || !choiceSet) return;
    reportEventChoiceRepairs(active.def, active.step, choiceSet.repairs);
    if (!devEnabled) return;
    for (const evaluated of choiceSet.choices) {
      if (evaluated.enabled && !closing) continue;
      console.info('[events] choice unavailable', {
        eventId: active.def.id,
        eventInstanceId: active.instanceId,
        step: active.step ?? 'root',
        optionId: evaluated.choice.id,
        eligibility: evaluated.enabled,
        failedRequirements: evaluated.failures,
        resources: { ...state.resources },
        requiredEmployee: evaluated.choice.requires?.hiredEmployee ?? null,
        ownedEmployees: Object.entries(state.employees)
          .filter(([, employee]) => employee.hired)
          .map(([id]) => id),
        processing: closing,
        overlay: 'event-modal-active',
      });
    }
    // availabilitySignature captures in-place engine state mutations without
    // repeatedly logging on unrelated simulation frames.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.instanceId, active?.step, availabilitySignature, closing, devEnabled]);

  if (!active || !choiceSet) return null;
  const { def, step } = active;
  const body = step && def.steps?.[step] ? def.steps[step].bodyKey : def.bodyKey;
  const emp = def.employeeId ? EMPLOYEES_BY_ID[def.employeeId] : null;
  const shape = emp ? shapeFor(emp.id) : null;
  const variant: PopupVariant =
    def.rarity === 'legendary'
      ? 'critical'
      : def.rarity === 'rare'
        ? 'warning'
        : emp
          ? 'employee'
          : 'choice';
  const titleId = `event-title-${def.id}`;
  const ownedEmployees = Object.entries(state.employees)
    .filter(([, employee]) => employee.hired)
    .map(([id]) => id);

  const eventHistoryCount = state.eventHistory.filter((entry) => entry.eventId === def.id).length;

  const requirementText = (failure: EventRequirementFailure): string => {
    if (failure.kind === 'hiredEmployee') {
      const nameKey = failure.employeeId ? EMPLOYEES_BY_ID[failure.employeeId]?.nameKey : undefined;
      return t(failure.messageKey, {
        employee: nameKey ? t(nameKey) : failure.employeeId,
      });
    }
    return t(failure.messageKey, { value: failure.required });
  };

  return (
    <PopupShell
      variant={variant}
      className={`event-modal event-modal--${def.rarity} event-file--${def.id}`}
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
        <DiscoveryArt eventId={def.id} />
        <h2 id={titleId}>{t(def.titleKey)}</h2>
      </div>
      <p className="event-modal__body">{t(body)}</p>
      <div className="event-modal__prompt">{t('event.resolvePrompt')}</div>
      <div className="event-modal__choices">
        {choiceSet.choices.map(({ choice, enabled, failures, fallback }) => {
          const requirementId =
            failures.length > 0 ? `event-requirement-${active.instanceId}-${choice.id}` : undefined;
          const disabledReasons = [
            ...failures.map((failure) => failure.kind),
            ...(closing ? ['processing'] : []),
          ];
          return (
            <button
              key={choice.id}
              className={`event-choice ${fallback ? 'event-choice--fallback' : ''}`.trim()}
              data-event-id={def.id}
              data-event-instance={active.instanceId}
              data-event-step={step ?? 'root'}
              data-option-id={choice.id}
              data-eligible={enabled}
              data-disabled-reasons={disabledReasons.join(',')}
              data-processing={closing}
              aria-describedby={requirementId}
              aria-disabled={!enabled || closing}
              onClick={() => {
                if (!enabled || closing) return;
                const eventInstanceId = active.instanceId;
                const expectedStep = step;
                exitThen(() =>
                  engine.resolveEventChoice(choice.id, {
                    eventInstanceId,
                    step: expectedStep,
                  }),
                );
              }}
            >
              <span>{t(choice.labelKey)}</span>
              {failures.length > 0 ? (
                <span id={requirementId} className="event-choice__req">
                  {/* Prefer the authored explanation. `disabledKey` has been on
                      EventChoice and written in the content for a while — "Not enough
                      nuts to make this quietly disappear" — but it was never rendered,
                      so the player got the generic "Requires 1200 nuts" instead of the
                      line somebody wrote for that exact moment. The generic list stays
                      as the fallback for choices that have no authored copy. */}
                  {choice.disabledKey
                    ? t(choice.disabledKey)
                    : failures.map(requirementText).join(' · ')}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {devEnabled ? (
        <details className="event-choice-debug" data-event-history-count={eventHistoryCount}>
          <summary>Choice diagnostics</summary>
          <pre>
            {JSON.stringify(
              {
                eventId: def.id,
                eventInstanceId: active.instanceId,
                step: step ?? 'root',
                processing: closing,
                overlay: 'event-modal-active',
                resources: state.resources,
                ownedEmployees,
                historyCount: eventHistoryCount,
                options: choiceSet.choices.map(({ choice, enabled, failures, fallback }) => ({
                  optionId: choice.id,
                  eligibility: enabled,
                  failedRequirements: failures,
                  fallback,
                })),
              },
              null,
              2,
            )}
          </pre>
        </details>
      ) : null}
    </PopupShell>
  );
}
