import { useEffect, useRef, useState, type FocusEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../state/hooks';
import { useStore } from '../../state/store';
import { EMPLOYEES_BY_ID } from '../../content/employees';
import { DiscoveryArt } from '../../art/DiscoveryArt';
import {
  eventChoicesForState,
  previewEventChoice,
  reportEventChoiceRepairs,
  type ChoicePreview,
  type EventRequirementFailure,
} from '../../sim/eventChoices';
import { eventCast, eventPlace } from '../../sim/happenings';
import { employeesInRoom } from '../../sim/rooms';
import { PopupShell, usePopupExit, type PopupVariant } from './PopupShell';
import { IncidentScene, type ActorReaction } from './IncidentScene';
import { ChoiceEffects } from './ChoiceEffects';

/** How the people on the card would take an answer, for its scene. */
function reactionsFor(
  state: Parameters<typeof employeesInRoom>[0],
  preview: ChoicePreview,
): Record<string, ActorReaction> {
  const out: Record<string, ActorReaction> = {};
  for (const room of preview.rooms) {
    if (!room.emotion) continue;
    for (const id of employeesInRoom(state, room.roomId)) out[id] = { emotion: room.emotion };
  }
  for (const person of preview.people) {
    out[person.id] = {
      emotion: person.emotion ?? out[person.id]?.emotion ?? null,
      friendship: person.friendship,
    };
  }
  return out;
}

export function EventModal() {
  const { t } = useTranslation();
  const { engine, state } = useGame();
  const audio = useStore((s) => s.audio);
  const devEnabled = useStore((s) => s.devEnabled);
  const active = engine.activeEvent;
  const { closing, exitThen } = usePopupExit();
  // The answer being pointed at or focused: its people react on the card.
  const [considering, setConsidering] = useState<string | null>(null);
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

  // A new card (or the next part of this one) starts with nobody reacting.
  useEffect(() => setConsidering(null), [active?.instanceId, active?.step]);

  // In a short window the report scrolls above its answers: it fades at its foot
  // while there is more of it below.
  const bodyRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return undefined;
    const update = () => {
      el.dataset.more = String(el.scrollHeight - el.clientHeight - el.scrollTop > 2);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      observer?.disconnect();
    };
  }, [active?.instanceId, active?.step]);

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
  // Where it is happening, and who brought it to you: the card is set there.
  const place = active.place ?? eventPlace(state, def);
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
  // What each answer will do, read from the simulation's own rules.
  const previews = new Map(
    choiceSet.choices.map(({ choice }) => [choice.id, previewEventChoice(state, def, choice)]),
  );
  const consideredPreview = considering && !closing ? (previews.get(considering) ?? null) : null;
  const stepKey = `${active.instanceId}-${step ?? 'root'}`;
  const consider = (id: string) => setConsidering(id);
  // Letting go of one goes back to the answer the keys are on, if any.
  const letGo = (id: string) =>
    setConsidering((current) => {
      if (current !== id) return current;
      const focused = document.activeElement;
      return focused instanceof HTMLElement &&
        focused.matches('.event-choice:focus-visible') &&
        focused.dataset.optionId !== id
        ? (focused.dataset.optionId ?? null)
        : null;
    });
  // A focus the player moved there (keys), not the card's own first focus.
  const considerOnFocus = (id: string) => (event: FocusEvent<HTMLButtonElement>) => {
    if (event.currentTarget.matches(':focus-visible')) consider(id);
  };

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
      <IncidentScene
        roomId={place.roomId}
        people={eventCast(state, def, place)}
        rarity={def.rarity}
        reducedMotion={state.settings.reducedMotion}
        reactions={consideredPreview ? reactionsFor(state, consideredPreview) : undefined}
      />
      <div className="event-modal__head">
        <DiscoveryArt eventId={def.id} />
        <h2 id={titleId}>{t(def.titleKey)}</h2>
      </div>
      <p className="event-modal__body" ref={bodyRef} key={`body-${stepKey}`}>
        {t(body)}
      </p>
      <div className="event-modal__prompt">{t('event.resolvePrompt')}</div>
      <div className="event-modal__choices" role="group" aria-label={t('event.resolvePrompt')}>
        {choiceSet.choices.map(({ choice, enabled, failures, fallback }) => {
          const requirementId =
            failures.length > 0 ? `event-requirement-${stepKey}-${choice.id}` : undefined;
          const labelId = `event-choice-${stepKey}-${choice.id}`;
          const effectsId = `event-effects-${stepKey}-${choice.id}`;
          const preview = previews.get(choice.id)!;
          const disabledReasons = [
            ...failures.map((failure) => failure.kind),
            ...(closing ? ['processing'] : []),
          ];
          return (
            <button
              key={choice.id}
              type="button"
              className={`event-choice ${fallback ? 'event-choice--fallback' : ''}`.trim()}
              data-event-id={def.id}
              data-event-instance={active.instanceId}
              data-event-step={step ?? 'root'}
              data-option-id={choice.id}
              data-eligible={enabled}
              data-disabled-reasons={disabledReasons.join(',')}
              data-processing={closing}
              data-considered={considering === choice.id ? 'true' : undefined}
              aria-labelledby={labelId}
              aria-describedby={requirementId ?? effectsId}
              aria-disabled={!enabled || closing}
              onMouseEnter={() => consider(choice.id)}
              onMouseLeave={() => letGo(choice.id)}
              onFocus={considerOnFocus(choice.id)}
              onBlur={() => letGo(choice.id)}
              onClick={() => {
                if (!enabled || closing) {
                  audio.play('error');
                  return;
                }
                const eventInstanceId = active.instanceId;
                const expectedStep = step;
                setConsidering(null);
                audio.play('paper');
                exitThen(() =>
                  engine.resolveEventChoice(choice.id, {
                    eventInstanceId,
                    step: expectedStep,
                  }),
                );
              }}
            >
              <span className="event-choice__tick" aria-hidden />
              <span className="event-choice__label" id={labelId}>
                {t(choice.labelKey)}
              </span>
              {failures.length === 0 ? (
                <ChoiceEffects id={effectsId} preview={preview} state={state} />
              ) : null}
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
