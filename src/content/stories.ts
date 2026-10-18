import { EMPLOYEES } from './employees';
import { CHARACTERS, type StoryFlavor } from './characters';
import type { TalkTopic } from './employeeTalks';
import type { EventEffect } from './types';

// Personal stories: every teammate has one, told in three parts that open as you
// become closer. The words are theirs (`arc.<id>.*` in the locales); the shape is
// shared so the whole cast scales cleanly:
//
//   Part 1 — once you are FAMILIAR. They bring something up; how you answer is
//            remembered (`<id>.arc.1.a|b`) and they bring it back up in the office:
//            once on their own a few minutes later, then now and then when poked.
//   Part 2 — once you are TRUSTED, and a while later. One answer pays off later:
//            they turn up in the office with something for you. The other pulls
//            in a teammate from their story.
//   Part 3 — once you are CLOSE, and a while later. They open by remembering what
//            you said in Part 1, and the ending you choose becomes a keepsake.
//
// Every part's effects are written into durable flags, so the story survives
// saves and restructures, and later content can read it.

/** Friendship needed for each relationship stage. */
export const BOND_THRESHOLDS = { familiar: 15, trusted: 40, close: 70 } as const;

/** The gap between parts, so a story unfolds over visits rather than in one sitting. */
export const STORY_GAP_SECONDS = 8 * 60;

/** How long after Part 2's kind answer they come back with something. */
export const STORY_FIND_DELAY_SECONDS = 6 * 60;

/**
 * How long after Part 1 they bring your answer up in the office, unprompted, the
 * first time (`arc.<id>.callback.a|b`; then now and then when poked). Said when
 * their floor is in view, so it waits for the player like any other remark.
 */
export const STORY_CALLBACK_DELAY_SECONDS = 5 * 60;

export function storyTopicId(employeeId: string, part: 1 | 2 | 3): string {
  return `story-${employeeId}-${part}`;
}

export function storyFlag(employeeId: string, part: 1 | 2 | 3, choice?: 'a' | 'b'): string {
  return choice ? `${employeeId}.arc.${part}.${choice}` : `${employeeId}.arc.${part}`;
}

export function storyDoneFlag(employeeId: string): string {
  return `${employeeId}.arc.done`;
}

/** What a story touches besides friendship, growing with each part. */
function flavorEffects(flavor: StoryFlavor, part: 1 | 2 | 3): EventEffect[] {
  switch (flavor) {
    case 'morale':
      return [{ type: 'morale', value: [4, 6, 8][part - 1] }];
    case 'reputation':
      return [{ type: 'reputation', value: [4, 6, 10][part - 1] }];
    case 'production':
      return [
        {
          type: 'productionBoost',
          value: [1.1, 1.15, 1.2][part - 1],
          durationSeconds: [300, 300, 600][part - 1],
        },
      ];
    case 'golden':
      return part === 1
        ? [{ type: 'reputation', value: 3 }]
        : [{ type: 'goldenNuts', value: part === 2 ? 1 : 2 }];
  }
}

function storyFor(employeeId: string): TalkTopic[] {
  const character = CHARACTERS[employeeId];
  if (!character) return [];
  const { flavor, moods, partner } = character.story;
  const key = (rest: string) => `arc.${employeeId}.${rest}`;
  const mood = (index: number, seconds: number): EventEffect => ({
    type: 'emotion',
    emotion: moods[index],
    durationSeconds: seconds,
  });
  // What you said in Part 1 comes back: a few minutes later, in the office.
  const callback = (choice: 'a' | 'b'): EventEffect => ({
    type: 'remark',
    lineKey: key(`callback.${choice}`),
    delaySeconds: STORY_CALLBACK_DELAY_SECONDS,
  });
  const base = {
    employeeId,
    titleKey: key('title'),
    blurbKey: key('title'),
    root: 'open',
    once: true,
    // Above small talk and gifts, below a teammate's own situational topics (a
    // ready part is also offered directly, from the office and the Team card).
    weight: 11,
    story: employeeId,
  };

  const part1: TalkTopic = {
    ...base,
    id: storyTopicId(employeeId, 1),
    part: 1,
    requires: { friendship: BOND_THRESHOLDS.familiar },
    nodes: {
      open: {
        id: 'open',
        promptKey: key('1.prompt'),
        choices: [
          {
            id: 'a',
            tone: 'warm',
            labelKey: key('1.a.label'),
            replyKey: key('1.a.reply'),
            effects: [
              { type: 'friendship', value: 6 },
              mood(0, 600),
              { type: 'setFlag', flagId: storyFlag(employeeId, 1) },
              { type: 'setFlag', flagId: storyFlag(employeeId, 1, 'a') },
              callback('a'),
            ],
          },
          {
            id: 'b',
            tone: 'curious',
            labelKey: key('1.b.label'),
            replyKey: key('1.b.reply'),
            effects: [
              { type: 'friendship', value: 3 },
              ...flavorEffects(flavor, 1),
              mood(1, 600),
              { type: 'setFlag', flagId: storyFlag(employeeId, 1) },
              { type: 'setFlag', flagId: storyFlag(employeeId, 1, 'b') },
              callback('b'),
            ],
          },
        ],
      },
    },
  };

  const part2: TalkTopic = {
    ...base,
    id: storyTopicId(employeeId, 2),
    part: 2,
    requires: {
      friendship: BOND_THRESHOLDS.trusted,
      flag: storyFlag(employeeId, 1),
      after: { flag: storyFlag(employeeId, 1), seconds: STORY_GAP_SECONDS },
    },
    nodes: {
      open: {
        id: 'open',
        promptKey: key('2.prompt'),
        choices: [
          {
            id: 'a',
            tone: 'warm',
            labelKey: key('2.a.label'),
            replyKey: key('2.a.reply'),
            effects: [
              { type: 'friendship', value: 6 },
              mood(2, 600),
              // The kind answer comes back to you: later, in the office, they
              // hold out something they found for you.
              {
                type: 'schedule',
                delaySeconds: STORY_FIND_DELAY_SECONDS,
                flagId: `${employeeId}.storyFind`,
                scheduleTitleKey: key('title'),
                scheduleBodyKey: 'arc.findArrived',
                scheduled: [{ type: 'find', findNoteKey: key('find') }],
              },
              { type: 'setFlag', flagId: storyFlag(employeeId, 2) },
              { type: 'setFlag', flagId: storyFlag(employeeId, 2, 'a') },
            ],
          },
          {
            id: 'b',
            tone: 'curious',
            labelKey: key('2.b.label'),
            replyKey: key('2.b.reply'),
            effects: [
              { type: 'friendship', value: 3 },
              { type: 'friendship', employeeId: partner, value: 3 },
              ...flavorEffects(flavor, 2),
              mood(3, 600),
              { type: 'setFlag', flagId: storyFlag(employeeId, 2) },
              { type: 'setFlag', flagId: storyFlag(employeeId, 2, 'b') },
            ],
          },
        ],
      },
    },
  };

  const part3: TalkTopic = {
    ...base,
    id: storyTopicId(employeeId, 3),
    part: 3,
    requires: {
      friendship: BOND_THRESHOLDS.close,
      flag: storyFlag(employeeId, 2),
      after: { flag: storyFlag(employeeId, 2), seconds: STORY_GAP_SECONDS },
    },
    nodes: {
      open: {
        id: 'open',
        // They open by remembering what you said back in Part 1.
        promptKey: key('3.prompt.a'),
        variants: [
          { flag: storyFlag(employeeId, 1, 'a'), promptKey: key('3.prompt.a') },
          { flag: storyFlag(employeeId, 1, 'b'), promptKey: key('3.prompt.b') },
        ],
        choices: [
          {
            id: 'a',
            tone: 'warm',
            labelKey: key('3.a.label'),
            replyKey: key('3.a.reply'),
            effects: [
              { type: 'friendship', value: 8 },
              mood(4, 1800),
              { type: 'momentCard' },
              { type: 'setFlag', flagId: storyFlag(employeeId, 3) },
              { type: 'setFlag', flagId: storyFlag(employeeId, 3, 'a') },
              { type: 'setFlag', flagId: storyDoneFlag(employeeId) },
            ],
          },
          {
            id: 'b',
            tone: 'curious',
            labelKey: key('3.b.label'),
            replyKey: key('3.b.reply'),
            effects: [
              { type: 'friendship', value: 5 },
              ...flavorEffects(flavor, 3),
              mood(5, 1800),
              { type: 'momentCard' },
              { type: 'setFlag', flagId: storyFlag(employeeId, 3) },
              { type: 'setFlag', flagId: storyFlag(employeeId, 3, 'b') },
              { type: 'setFlag', flagId: storyDoneFlag(employeeId) },
            ],
          },
        ],
      },
    },
  };

  return [part1, part2, part3];
}

export const STORY_TALKS: readonly TalkTopic[] = EMPLOYEES.flatMap((employee) =>
  storyFor(employee.id),
);
