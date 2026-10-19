import { describe, expect, it } from 'vitest';
import en from '../src/i18n/locales/en.json';
import pt from '../src/i18n/locales/pt-BR.json';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import { gameStateSchema } from '../src/save/schema';
import { migrate } from '../src/save/migrations';
import { CHARACTERS } from '../src/content/characters';
import { EMPLOYEES_BY_ID } from '../src/content/employees';
import {
  TALKS_BY_ID,
  checkInMemoryFlag,
  topicsForEmployee,
  type TalkTopic,
} from '../src/content/employeeTalks';
import { nodePrompt, TALK_COOLDOWN_SECONDS } from '../src/sim/talks';
import { MOOD_POSITIVE } from '../src/sim/mood';
import {
  CAST_SCALE_CEILING,
  CAST_TALLEST_OFFICE_HEIGHT,
  EMPLOYEE_SPRITES,
  castScaleFor,
} from '../src/art/employeeSprites';
import type { EventEffect } from '../src/content/types';
import type { GameState } from '../src/sim/types';

/**
 * Gameplay chapter 2: the check-in in each teammate's own words, read from the
 * moment (their room, their mood, what happened since you last spoke), and one
 * presentation scale for the whole cast.
 */

const IDS = Object.keys(CHARACTERS);
const LINES = [
  'open',
  'home',
  'away',
  'down',
  'praised',
  'pushed',
  'fixed',
  'broken',
  'listen',
  'problem',
  'fixLabel',
  'fix',
  'promise',
  'thanks',
  'praise',
  'quota',
] as const;
type Lines = Record<string, Record<string, string>>;
const LOCALES: Record<string, Lines> = {
  en: (en as unknown as { checkin: Lines }).checkin,
  'pt-BR': (pt as unknown as { checkin: Lines }).checkin,
};
const T0 = 1_000_000_000;

function world(mutate: (s: GameState) => void = () => {}) {
  let now = T0;
  const state = createInitialState(now);
  state.resources.nuts = 50_000;
  state.resources.morale = 70;
  state.resources.reputation = 1_600;
  for (const room of ['construction', 'lab', 'procurement', 'research', 'meeting'])
    state.upgrades[`room-${room}`] = 1;
  mutate(state);
  const engine = new GameEngine(state, { deterministic: true, now: () => now });
  return {
    engine,
    state: engine.state,
    now: () => now,
    wait: (seconds: number) => {
      now += seconds * 1000;
      engine.tick(0.1);
    },
  };
}

/** Hire someone the way a check-in is reached: trusted enough, nothing else pending. */
function teammate(s: GameState, id: string, room?: string) {
  const rt = s.employees[id];
  rt.hired = true;
  rt.level = 2;
  rt.friendship = 10; // below every story part and personal topic
  if (room) rt.room = room;
}

function opening(w: ReturnType<typeof world>, id: string): string {
  expect(w.engine.openTalk(id, 'check-in', true), `${id} opens a check-in`).toBe(true);
  return w.engine.activeTalk!.promptKey!;
}

function answer(w: ReturnType<typeof world>, ...choices: string[]) {
  for (const choice of choices) {
    expect(
      w.engine.chooseTalkOption(choice, w.engine.activeTalk!.instanceId),
      `option ${choice}`,
    ).toBe(true);
  }
  w.engine.closeTalk();
}

function effectsShape(effects: EventEffect[]): string {
  return JSON.stringify(
    effects
      .filter((e) => !(e.flagId ?? '').includes('.checkin.'))
      .map((e) =>
        e.type === 'schedule'
          ? {
              ...e,
              scheduled: e.scheduled?.filter((x) => !(x.flagId ?? '').includes('.checkin.')),
            }
          : e,
      ),
  );
}

describe('every teammate has their own check-in', () => {
  it('has all sixteen lines, in English and Portuguese, for all 23', () => {
    expect(IDS).toHaveLength(23);
    for (const [lang, lines] of Object.entries(LOCALES)) {
      expect(Object.keys(lines).sort(), lang).toEqual([...IDS].sort());
      for (const id of IDS) {
        for (const key of LINES) {
          expect(lines[id][key]?.trim().length ?? 0, `${lang} ${id}.${key}`).toBeGreaterThan(8);
        }
      }
    }
  });

  it('never puts the same words in two mouths, or the old shared ones in any', () => {
    for (const [lang, lines] of Object.entries(LOCALES)) {
      const seen = new Map<string, string>();
      for (const id of IDS) {
        for (const key of LINES) {
          const line = lines[id][key];
          expect(seen.get(line), `${lang}: ${id}.${key} repeats ${seen.get(line)}`).toBeUndefined();
          seen.set(line, `${id}.${key}`);
        }
      }
      const shared = (lang === 'en' ? en : pt).talk['check-in'];
      expect([...seen.keys()]).not.toContain(shared.open.prompt);
      expect([...seen.keys()]).not.toContain(shared.listened.prompt);
    }
  });

  it('keeps the shared check-in shape, costs and consequences for everyone', () => {
    const shared = TALKS_BY_ID['check-in'];
    for (const id of IDS) {
      const topic = topicsForEmployee(id).find((t) => t.id === 'check-in') as TalkTopic;
      expect(topic.nodes.open.promptKey).toBe(`checkin.${id}.open`);
      expect(topic.nodes.listened.promptKey).toBe(`checkin.${id}.problem`);
      for (const nodeId of ['open', 'listened']) {
        const mine = topic.nodes[nodeId].choices;
        const theirs = shared.nodes[nodeId].choices;
        expect(mine.map((c) => c.id)).toEqual(theirs.map((c) => c.id));
        mine.forEach((choice, i) => {
          expect(choice.replyKey.startsWith(`checkin.${id}.`), `${id} ${choice.id}`).toBe(true);
          expect(choice.requires).toEqual(theirs[i].requires);
          expect(choice.next).toBe(theirs[i].next);
          expect(effectsShape(choice.effects), `${id} ${choice.id} effects`).toBe(
            effectsShape(theirs[i].effects),
          );
        });
      }
    }
  });

  it('agrees with who is speaking in Portuguese (every mood has a feminine form)', () => {
    const moods = pt.mood as Record<string, string>;
    for (const id of IDS) expect(['female', 'male']).toContain(CHARACTERS[id].gender);
    for (const mood of Object.keys(MOOD_POSITIVE)) {
      const plain = moods[mood];
      const female = moods[`${mood}_female`] ?? plain;
      // Words ending in -o take -a; the rest (Feliz, Triste) need no form.
      if (/o$/.test(plain)) expect(female, mood).toMatch(/a$/);
    }
    expect((pt.affinity as Record<string, string>).disliked_female).toBe('Não é a sala dela');
  });
});

describe('how they open reads the moment', () => {
  it('in their own department, in a room that clashes, anywhere else', () => {
    const home = EMPLOYEES_BY_ID.bea.room;
    const w = world((s) => teammate(s, 'bea', home));
    expect(opening(w, 'bea')).toBe('checkin.bea.home');
    w.engine.closeTalk();
    w.engine.assignEmployee('bea', 'lab');
    expect(opening(w, 'bea')).toBe('checkin.bea.away');
    w.engine.closeTalk();
    w.engine.assignEmployee('bea', 'procurement');
    expect(opening(w, 'bea')).toBe('checkin.bea.open');
  });

  it('a low mood (the one their sticker shows) comes before the room', () => {
    const w = world((s) => {
      teammate(s, 'otto', 'procurement');
      s.employees.otto.emotion = { id: 'worried', until: T0 + 600_000 };
    });
    expect(opening(w, 'otto')).toBe('checkin.otto.down');
  });

  it('what happened last time comes first, once, and only until you speak again', () => {
    const w = world((s) => teammate(s, 'nixie', 'lab'));
    opening(w, 'nixie');
    answer(w, 'praise');
    w.wait(TALK_COOLDOWN_SECONDS + 1);
    expect(opening(w, 'nixie')).toBe('checkin.nixie.praised');
    answer(w, 'quota');
    w.wait(TALK_COOLDOWN_SECONDS + 1);
    expect(opening(w, 'nixie')).toBe('checkin.nixie.pushed');
    answer(w, 'listen', 'fix');
    w.wait(TALK_COOLDOWN_SECONDS + 1);
    expect(opening(w, 'nixie')).toBe('checkin.nixie.fixed');
    answer(w, 'listen', 'thanks');
    w.wait(TALK_COOLDOWN_SECONDS + 1);
    // Nothing new happened since: back to how the moment reads.
    expect(opening(w, 'nixie')).toBe('checkin.nixie.home');
  });

  it('a promise left to lapse is what they bring up, for that teammate only', () => {
    const w = world((s) => {
      teammate(s, 'moss', 'research');
      teammate(s, 'echo', 'research');
    });
    opening(w, 'moss');
    answer(w, 'listen', 'promise');
    w.wait(300);
    expect(opening(w, 'moss')).toBe('checkin.moss.home');
    w.engine.closeTalk();
    w.wait(320); // the promise lands at ten minutes
    expect(checkInMemoryFlag('moss', 'broken') in w.state.flags).toBe(true);
    expect(opening(w, 'moss')).toBe('checkin.moss.broken');
    w.engine.closeTalk();
    expect(checkInMemoryFlag('echo', 'broken') in w.state.flags).toBe(false);
    expect(opening(w, 'echo')).toBe('checkin.echo.home');
  });

  it('is decided when you sit down: a mood that changes mid-read does not swap the words', () => {
    const w = world((s) => teammate(s, 'pingo', 'sorting'));
    w.state.upgrades['room-sorting'] = 1;
    const first = opening(w, 'pingo');
    w.state.employees.pingo.emotion = { id: 'sad', until: T0 + 600_000 };
    expect(w.engine.activeTalk!.promptKey).toBe(first);
    const node = w.engine.activeTalk!.topic.nodes.open;
    // The pure resolver, asked fresh, would say the low line now.
    expect(
      nodePrompt(w.state, node, { employeeId: 'pingo', topicId: 'check-in', now: w.now() }),
    ).toBe('checkin.pingo.down');
  });

  it('remembers across a save and a reload', () => {
    const w = world((s) => teammate(s, 'rosa', 'marketing'));
    w.state.upgrades['room-marketing'] = 1;
    opening(w, 'rosa');
    answer(w, 'praise');
    const saved = gameStateSchema.parse(migrate(JSON.parse(JSON.stringify(w.state)))) as GameState;
    const later = w.now() + (TALK_COOLDOWN_SECONDS + 5) * 1000;
    const reloaded = new GameEngine(saved, { deterministic: true, now: () => later });
    expect(reloaded.openTalk('rosa', 'check-in', true)).toBe(true);
    expect(reloaded.activeTalk!.promptKey).toBe('checkin.rosa.praised');
  });

  it('without someone speaking, only the flag variants are read (stories are unchanged)', () => {
    const node = {
      id: 'open',
      promptKey: 'plain',
      variants: [
        { lowMood: true, promptKey: 'personal' },
        { flag: 'x', promptKey: 'flagged' },
      ],
      choices: [],
    };
    const s = createInitialState(T0);
    expect(nodePrompt(s, node)).toBe('plain');
    s.flags.x = T0;
    expect(nodePrompt(s, node)).toBe('flagged');
  });
});

describe('one presentation scale for the whole cast', () => {
  it('never draws anyone larger than their densest build', () => {
    for (const [id, sprite] of Object.entries(EMPLOYEE_SPRITES)) {
      expect(sprite.officeHeight * CAST_SCALE_CEILING, id).toBeLessThanOrEqual(sprite.srcHeight);
    }
    expect(castScaleFor(10_000)).toBe(CAST_SCALE_CEILING);
  });

  it('fits the tallest of them in the space, and gives everyone the same number', () => {
    for (const space of [140, 170, 200]) {
      const k = castScaleFor(space);
      expect(CAST_TALLEST_OFFICE_HEIGHT * k).toBeLessThanOrEqual(space + 0.5);
    }
    // The office already draws every visible figure at Pip's height; one shared
    // scale keeps them matched (the registry's own tolerance, about 5%).
    const k = castScaleFor(180);
    const figures = Object.values(EMPLOYEE_SPRITES).map(
      (s) => Math.round(s.officeHeight * k) * (1 - s.figureTop),
    );
    expect(Math.max(...figures) / Math.min(...figures)).toBeLessThan(1.06);
  });
});
