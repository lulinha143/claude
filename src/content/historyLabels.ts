import { GAME_EVENTS_BY_ID } from './events';
import { TALKS_BY_ID } from './employeeTalks';

/** Shared by the timeline and collectible/exported records. Never expose an
 * internal event id as the title of a player's memory. */
export function historyLabelKeys(eventId: string, choiceId?: string) {
  const event = GAME_EVENTS_BY_ID[eventId];
  if (event) {
    const choices = [
      ...event.choices,
      ...Object.values(event.steps ?? {}).flatMap((step) => step.choices),
    ];
    return {
      titleKey: event.titleKey,
      choiceKey:
        choices.find((choice) => choice.id === choiceId)?.labelKey ?? 'company.recordedChoice',
    };
  }
  const topic = eventId.startsWith('talk:') ? TALKS_BY_ID[eventId.slice(5)] : undefined;
  if (topic)
    return {
      titleKey: topic.titleKey,
      choiceKey:
        Object.values(topic.nodes)
          .flatMap((node) => node.choices)
          .find((choice) => choice.id === choiceId)?.labelKey ?? 'company.recordedChoice',
    };
  const mode = eventId.startsWith('microgame:') ? eventId.slice(10) : '';
  if (['coffeeRescue', 'bugSquash', 'cableUntangle'].includes(mode))
    return { titleKey: `microgame.${mode}.name`, choiceKey: 'microgame.masteryReward' };
  return { titleKey: 'moment.unknownTitle', choiceKey: 'company.recordedChoice' };
}
