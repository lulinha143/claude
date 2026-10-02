import { describe, expect, it } from 'vitest';

import en from '../src/i18n/locales/en.json';
import pt from '../src/i18n/locales/pt-BR.json';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import { migrate } from '../src/save/migrations';
import { gameStateSchema } from '../src/save/schema';
import { performPrestige } from '../src/sim/prestige';
import { EMPLOYEES, EMPLOYEES_BY_ID } from '../src/content/employees';
import { CHARACTERS } from '../src/content/characters';
import {
  GIFTS,
  LEGACY_GIFT_FAVORITES,
  giftReaction,
  type GiftId,
} from '../src/content/employeeGifts';
import { PAIRS } from '../src/content/pairs';
import {
  BOND_THRESHOLDS,
  STORY_FIND_DELAY_SECONDS,
  STORY_GAP_SECONDS,
  storyTopicId,
} from '../src/content/stories';
import { TALKS_BY_ID, type TalkTopic } from '../src/content/employeeTalks';
import { DIALOGUE_COUNTS } from '../src/content/dialogue';
import {
  acknowledgedTier,
  bondTier,
  giftHint,
  journalFor,
  keepsakeOnDisplay,
  knownFavorite,
  knownReactions,
  pairsTogether,
  pendingMoment,
  storyCallbackKey,
  storyState,
  wavingTeammates,
  MAX_WAVING,
} from '../src/sim/bonds';
import { employeeOutput } from '../src/sim/economy';
import { employeeMood } from '../src/sim/mood';
import { nodePrompt, TALK_COOLDOWN_SECONDS } from '../src/sim/talks';
import type { GameState } from '../src/sim/types';

/**
 * Gameplay chapter 2: the cast as people worth coming back for.
 *
 * Content is checked for EVERY teammate (a story, gifts, a voice, words in both
 * shipped languages), and the mechanics are played through end to end: the
 * friendship stages, a story told over several visits, the gift guessing game,
 * the scrapbook, the moments they wave you over for, and that all of it survives
 * a save, an old save, and a restructure.
 */

const T0 = 1_800_000_000_000;
const IDS = EMPLOYEES.map((e) => e.id);
const LOCALES = { en, 'pt-BR': pt } as Record<string, unknown>;

function text(locale: string, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      LOCALES[locale],
    );
}

/** A company with everyone on the payroll and money to spend, on a clock we control. */
function company(friendship = 0, mutate?: (s: GameState) => void) {
  let clock = T0;
  const state = createInitialState(T0);
  for (const id of IDS) {
    state.employees[id] = {
      ...state.employees[id],
      hired: true,
      level: 2,
      friendship,
      talks: { count: 0, lastAt: 0, seen: {} },
    };
  }
  state.resources.nuts = 5_000_000;
  state.resources.goldenNuts = 50;
  state.resources.morale = 60;
  mutate?.(state);
  const engine = new GameEngine(state, { deterministic: true, now: () => clock });
  return {
    engine,
    get state() {
      return engine.state;
    },
    now: () => clock,
    /** Let time pass (the cooldown between conversations included). */
    wait(seconds: number) {
      clock += seconds * 1000;
      engine.tick(0.1);
    },
  };
}

type World = ReturnType<typeof company>;

/** Sit down with someone for a specific topic and answer once. */
function talk(w: World, id: string, topicId: string, choice: string) {
  expect(w.engine.openTalk(id, topicId, true), `${topicId} opens for ${id}`).toBe(true);
  expect(
    w.engine.chooseTalkOption(choice, w.engine.activeTalk!.instanceId),
    `${topicId}/${choice} is taken`,
  ).toBe(true);
  w.engine.closeTalk();
}

/** Tell one teammate's whole story, the way a player would across visits. */
function tellStory(w: World, id: string, answers: ['a' | 'b', 'a' | 'b', 'a' | 'b']) {
  const rt = w.state.employees[id];
  rt.friendship = Math.max(rt.friendship, BOND_THRESHOLDS.familiar);
  talk(w, id, storyTopicId(id, 1), answers[0]);
  rt.friendship = Math.max(rt.friendship, BOND_THRESHOLDS.trusted);
  w.wait(STORY_GAP_SECONDS + 1);
  talk(w, id, storyTopicId(id, 2), answers[1]);
  rt.friendship = Math.max(rt.friendship, BOND_THRESHOLDS.close);
  w.wait(STORY_GAP_SECONDS + 1);
  talk(w, id, storyTopicId(id, 3), answers[2]);
  w.wait(TALK_COOLDOWN_SECONDS + 1);
}

function storyKeys(topic: TalkTopic): string[] {
  const keys = [topic.titleKey];
  for (const node of Object.values(topic.nodes)) {
    keys.push(node.promptKey, ...(node.variants ?? []).map((v) => v.promptKey));
    for (const choice of node.choices) keys.push(choice.labelKey, choice.replyKey);
  }
  return keys;
}

function roundTrip(state: GameState): GameState {
  return gameStateSchema.parse(migrate(JSON.parse(JSON.stringify(state)))) as GameState;
}

// ---- who they are ---------------------------------------------------------------

describe('every teammate is a character', () => {
  it('has a profile: a voice, gift tastes, a story shape and a partner in it', () => {
    expect(Object.keys(CHARACTERS).sort()).toEqual([...IDS].sort());
    const gifts = new Set(GIFTS.map((g) => g.id));
    for (const id of IDS) {
      const c = CHARACTERS[id];
      expect(c.voice.base, id).toBeGreaterThan(0);
      const { loves, likes, odd } = c.gifts;
      expect(new Set([loves, likes, odd]).size, `${id} tastes are distinct`).toBe(3);
      for (const g of [loves, likes, odd]) expect(gifts.has(g), `${id}: ${g}`).toBe(true);
      expect(c.story.moods, id).toHaveLength(6);
      expect(EMPLOYEES_BY_ID[c.story.partner], `${id} partner`).toBeDefined();
      expect(c.story.partner, id).not.toBe(id);
    }
  });

  it('does not stamp one personality onto everyone', () => {
    const voices = new Set(IDS.map((id) => JSON.stringify(CHARACTERS[id].voice)));
    expect(voices.size, 'every voice is their own').toBe(IDS.length);
    const shapes = new Set(IDS.map((id) => JSON.stringify(CHARACTERS[id].story.moods)));
    expect(shapes.size).toBeGreaterThan(IDS.length / 2);
    const partners = new Set(IDS.map((id) => CHARACTERS[id].story.partner));
    expect(partners.size).toBeGreaterThan(10);
    // Favourites are spread around, so learning one teaches nothing about the next.
    const loves = new Map<GiftId, number>();
    for (const id of IDS)
      loves.set(CHARACTERS[id].gifts.loves, (loves.get(CHARACTERS[id].gifts.loves) ?? 0) + 1);
    expect(loves.size).toBe(GIFTS.length);
    for (const [gift, count] of loves) expect(count, gift).toBeLessThanOrEqual(6);
  });

  it('has a unique name in each shipped language', () => {
    for (const locale of Object.keys(LOCALES)) {
      const names = IDS.map((id) => text(locale, `employee.${id}.name`));
      expect(new Set(names).size, `${locale}: ${names.join(', ')}`).toBe(IDS.length);
    }
    expect(text('pt-BR', 'employee.rizzo.name')).toBe('Guaxi');
    expect(text('pt-BR', 'employee.bea.name')).toBe('Beta');
  });

  it('has enough to say: every line counted, none repeated', () => {
    for (const id of IDS) {
      expect(DIALOGUE_COUNTS[id], id).toBeGreaterThanOrEqual(10);
      for (const locale of Object.keys(LOCALES)) {
        const lines = text(locale, `dialogue.${id}`) as string[];
        expect(lines, `${locale} ${id}`).toHaveLength(DIALOGUE_COUNTS[id]);
        expect(new Set(lines).size, `${locale} ${id} repeats a line`).toBe(lines.length);
      }
    }
  });
});

// ---- their story ------------------------------------------------------------------

describe('personal stories', () => {
  it('gives all 23 teammates three parts, opening at familiar, trusted and close', () => {
    expect(IDS).toHaveLength(23);
    for (const id of IDS) {
      const parts = [1, 2, 3].map((n) => TALKS_BY_ID[storyTopicId(id, n as 1 | 2 | 3)]);
      parts.forEach((topic, i) => {
        expect(topic, `${id} part ${i + 1}`).toBeDefined();
        expect(topic.employeeId).toBe(id);
        expect(topic.once).toBe(true);
        expect(topic.part).toBe(i + 1);
      });
      expect(parts[0].requires?.friendship).toBe(BOND_THRESHOLDS.familiar);
      expect(parts[1].requires?.friendship).toBe(BOND_THRESHOLDS.trusted);
      expect(parts[2].requires?.friendship).toBe(BOND_THRESHOLDS.close);
      // Parts unfold over visits, not in one sitting.
      expect(parts[1].requires?.after?.seconds).toBe(STORY_GAP_SECONDS);
      expect(parts[2].requires?.after?.seconds).toBe(STORY_GAP_SECONDS);
    }
  });

  it('is written for every part, in both languages, with no line shared between people', () => {
    for (const locale of Object.keys(LOCALES)) {
      const seen = new Map<string, string>();
      for (const id of IDS) {
        const keys = [1, 2, 3].flatMap((n) =>
          storyKeys(TALKS_BY_ID[storyTopicId(id, n as 1 | 2 | 3)]),
        );
        keys.push(`arc.${id}.callback.a`, `arc.${id}.callback.b`, `arc.${id}.find`);
        for (const key of new Set(keys)) {
          const value = text(locale, key);
          expect(typeof value === 'string' && value.trim().length > 0, `${locale} ${key}`).toBe(
            true,
          );
          const other = seen.get(value as string);
          expect(other, `${locale} ${key} repeats ${other}`).toBeUndefined();
          seen.set(value as string, key);
        }
      }
    }
  });

  it('is translated rather than copied into Portuguese', () => {
    for (const id of IDS) {
      for (const key of ['title', '1.prompt', '2.prompt', '3.prompt.a', 'find']) {
        expect(text('pt-BR', `arc.${id}.${key}`), `${id} ${key}`).not.toBe(
          text('en', `arc.${id}.${key}`),
        );
      }
    }
  });

  it('waits for the friendship, then for time, then tells the next part', () => {
    const w = company(10);
    expect(storyState(w.state, 'otto', w.now()).waitingFor).toBe('friendship');
    w.state.employees.otto.friendship = 15;
    expect(storyState(w.state, 'otto', w.now()).readyTopicId).toBe('story-otto-1');
    talk(w, 'otto', 'story-otto-1', 'b');
    expect('otto.arc.1.b' in w.state.flags).toBe(true);

    w.state.employees.otto.friendship = 45;
    w.wait(TALK_COOLDOWN_SECONDS + 1);
    const waiting = storyState(w.state, 'otto', w.now());
    expect(waiting.told).toBe(1);
    expect(waiting.waitingFor).toBe('time');
    expect(w.engine.openTalk('otto', 'story-otto-2', true)).toBe(false);
    w.wait(STORY_GAP_SECONDS);
    expect(storyState(w.state, 'otto', w.now()).readyTopicId).toBe('story-otto-2');
  });

  it('remembers Part 1 in the office and opens Part 3 with it', () => {
    for (const first of ['a', 'b'] as const) {
      const w = company(15);
      talk(w, 'hazel', 'story-hazel-1', first);
      expect(storyCallbackKey(w.state, 'hazel')).toBe(`arc.hazel.callback.${first}`);
      w.state.employees.hazel.friendship = 40;
      w.wait(STORY_GAP_SECONDS + 1);
      talk(w, 'hazel', 'story-hazel-2', 'b');
      w.state.employees.hazel.friendship = 70;
      w.wait(STORY_GAP_SECONDS + 1);
      const part3 = TALKS_BY_ID['story-hazel-3'];
      expect(nodePrompt(w.state, part3.nodes.open)).toBe(`arc.hazel.3.prompt.${first}`);
    }
  });

  it("pays off Part 2's kind answer later: they come back holding something", () => {
    const w = company(15);
    talk(w, 'moss', 'story-moss-1', 'a');
    w.state.employees.moss.friendship = 40;
    w.wait(STORY_GAP_SECONDS + 1);
    talk(w, 'moss', 'story-moss-2', 'a');
    expect(w.state.finds.some((f) => f.noteKey)).toBe(false);
    w.wait(STORY_FIND_DELAY_SECONDS + 1);
    const find = w.state.finds.find((f) => f.employeeId === 'moss' && f.noteKey);
    expect(find?.noteKey).toBe('arc.moss.find');
    const before = w.state.employees.moss.friendship;
    const reward = w.engine.collectFind(find!.id)!;
    expect(reward.nuts).toBeGreaterThan(0);
    expect(w.state.employees.moss.friendship).toBe(before + 3);
    expect(journalFor(w.state, 'moss').some((e) => e.kind === 'find')).toBe(true);
    // Good news is announced as good news.
    expect(w.engine.settledConsequences.at(-1)?.effects.every((e) => (e.value ?? 0) >= 0)).toBe(
      true,
    );
  });

  it('plays through for every teammate, ending in a keepsake on display', () => {
    const w = company(0);
    IDS.forEach((id, i) => {
      const answers: ['a' | 'b', 'a' | 'b', 'a' | 'b'] = [
        i % 2 ? 'a' : 'b',
        i % 3 ? 'b' : 'a',
        i % 2 ? 'b' : 'a',
      ];
      tellStory(w, id, answers);
      const story = storyState(w.state, id, w.now());
      expect(story.told, id).toBe(3);
      expect(keepsakeOnDisplay(w.state, id), id).toBe(true);
      expect(storyCallbackKey(w.state, id), id).toBeNull();
      const parts = journalFor(w.state, id).filter((e) => e.kind === 'story');
      expect(
        parts.map((e) => (e.kind === 'story' ? `${e.part}${e.choice}` : '')).sort(),
        id,
      ).toEqual([`1${answers[0]}`, `2${answers[1]}`, `3${answers[2]}`]);
      // Told once: a finished story is never offered again.
      expect(w.engine.openTalk(id, storyTopicId(id, 3), true)).toBe(false);
    });
    // The ending is a moment worth keeping.
    expect(w.state.collections.moments.length).toBeGreaterThanOrEqual(IDS.length);
  });
});

// ---- the friendship ----------------------------------------------------------------

describe('friendship stages', () => {
  it('goes new face, familiar, trusted, close', () => {
    expect([0, 14, 15, 39, 40, 69, 70, 100].map(bondTier)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it('celebrates a new stage once, the next time you stop by', () => {
    const w = company(0, (s) => {
      s.employees.junie.friendship = 52;
    });
    expect(pendingMoment(w.state, 'junie', w.now())).toEqual({ kind: 'milestone', tier: 2 });
    expect(w.engine.openTalk('junie', undefined, true)).toBe(true);
    // One celebration for the stage reached, every stage on the way recorded.
    expect(w.engine.activeTalk?.milestone).toBe(2);
    expect(acknowledgedTier(w.state, 'junie')).toBe(2);
    w.engine.closeTalk();
    expect(pendingMoment(w.state, 'junie', w.now())?.kind).not.toBe('milestone');
    expect(journalFor(w.state, 'junie').filter((e) => e.kind === 'tier')).toHaveLength(2);
  });

  it('notices a stage reached in the middle of a conversation', () => {
    const w = company(13);
    w.engine.openTalk('nixie', undefined, true);
    expect(w.engine.activeTalk?.milestone).toBeNull();
    // Their favourite gift is the surest +10.
    const loves = CHARACTERS.nixie.gifts.loves;
    w.engine.closeTalk();
    w.engine.openTalk('nixie', 'gift', true);
    w.engine.chooseTalkOption(loves, w.engine.activeTalk!.instanceId);
    expect(w.engine.activeTalk?.milestone).toBe(1);
  });

  it('does not make news of the founder knowing you on day one', () => {
    const state = createInitialState(T0);
    expect(acknowledgedTier(state, 'pip')).toBe(1);
    expect(pendingMoment(state, 'pip', T0)?.kind).not.toBe('milestone');
  });

  it('makes a close friend work 10% better', () => {
    const w = company(69);
    const def = EMPLOYEES_BY_ID.canela;
    const trusted = employeeOutput(w.state, def, 3);
    w.state.employees.canela.friendship = 70;
    expect(employeeOutput(w.state, def, 3) / trusted).toBeCloseTo(1.1, 5);
  });
});

// ---- gifts --------------------------------------------------------------------

describe('gifts', () => {
  it('gives every teammate one favourite, one they like, one that baffles them', () => {
    for (const id of IDS) {
      const reactions = GIFTS.map((gift) => giftReaction(id, gift.id));
      expect(
        reactions.filter((r) => r === 'loved'),
        id,
      ).toHaveLength(1);
      expect(
        reactions.filter((r) => r === 'liked'),
        id,
      ).toHaveLength(1);
      expect(
        reactions.filter((r) => r === 'odd'),
        id,
      ).toHaveLength(1);
      expect(
        reactions.filter((r) => r === 'polite'),
        id,
      ).toHaveLength(3);
      for (const locale of Object.keys(LOCALES)) {
        for (const kind of ['reactions', 'liked', 'odd', 'polite']) {
          expect(typeof text(locale, `gifts.${kind}.${id}`), `${locale} gifts.${kind}.${id}`).toBe(
            'string',
          );
        }
      }
    }
  });

  it('teaches you only what you actually tried', () => {
    const w = company(20);
    const { loves, odd } = CHARACTERS.rosa.gifts;
    expect(knownReactions(w.state, 'rosa')).toEqual({});
    talk(w, 'rosa', 'gift', odd);
    expect(knownReactions(w.state, 'rosa')).toEqual({ [odd]: 'odd' });
    // Another gift never gives the favourite away.
    expect(knownFavorite(w.state, 'rosa')).toBeNull();
    w.wait(TALK_COOLDOWN_SECONDS + 1);
    talk(w, 'rosa', 'gift', loves);
    expect(knownFavorite(w.state, 'rosa')).toBe(loves);
    expect(journalFor(w.state, 'rosa').filter((e) => e.kind === 'gift')).toHaveLength(2);
  });

  it('reacts in proportion: a favourite is a real moment, a miss is still kind', () => {
    const w = company(20);
    const { loves, odd } = CHARACTERS.bia.gifts;
    talk(w, 'bia', 'gift', loves);
    expect(w.state.employees.bia.friendship).toBe(30);
    expect(w.state.employees.bia.emotion?.id).toBe('excited');
    expect(`favorite.bia.giftMemory` in w.state.flags).toBe(true);
    w.wait(TALK_COOLDOWN_SECONDS + 1);
    talk(w, 'bia', 'gift', odd);
    expect(w.state.employees.bia.friendship).toBe(31);
  });

  it('drops a hint once trusted and stumped, and only until it is read', () => {
    const w = company(40, (s) => {
      // Their story is mid-way, so the hint is what they have to share.
      s.flags['echo.arc.1'] = T0;
      s.flags['echo.arc.1.a'] = T0;
      s.flags['echo.tier.1'] = T0;
      s.flags['echo.tier.2'] = T0;
    });
    const { loves, likes, odd } = CHARACTERS.echo.gifts;
    expect(giftHint(w.state, 'echo')).toBeNull();
    talk(w, 'echo', 'gift', odd);
    w.wait(TALK_COOLDOWN_SECONDS + 1);
    expect(giftHint(w.state, 'echo')).toBeNull();
    talk(w, 'echo', 'gift', likes);
    w.wait(TALK_COOLDOWN_SECONDS + 1);
    expect(giftHint(w.state, 'echo')).toBe(loves);
    expect(text('en', `gifts.hint.${loves}`)).toBeTruthy();
    // Waves you over about it until the hint has been read.
    w.state.flags['echo.arc.1'] = w.now();
    expect(pendingMoment(w.state, 'echo', w.now())).toEqual({ kind: 'hint', gift: loves });
    w.engine.noteHintSeen('echo');
    expect(pendingMoment(w.state, 'echo', w.now())).toBeNull();
    // Not before they trust you, though.
    const early = company(20);
    early.state.flags[`inky.gift.${CHARACTERS.inky.gifts.odd}`] = T0;
    early.state.flags[`inky.gift.${CHARACTERS.inky.gifts.likes}`] = T0;
    expect(giftHint(early.state, 'inky')).toBeNull();
  });

  it('costs what the label says', () => {
    const w = company(20, (s) => {
      s.resources.nuts = 100;
      s.resources.goldenNuts = 0;
    });
    w.engine.openTalk('fenn', 'gift', true);
    const options = TALKS_BY_ID.gift.nodes.open.choices.map((c) => c.id);
    expect(options.sort()).toEqual(GIFTS.map((g) => g.id).sort());
    expect(w.engine.chooseTalkOption('scarf', w.engine.activeTalk!.instanceId)).toBe(false);
    expect(w.engine.chooseTalkOption('golden', w.engine.activeTalk!.instanceId)).toBe(false);
    // Coffee is always on the house.
    expect(w.engine.chooseTalkOption('coffee', w.engine.activeTalk!.instanceId)).toBe(true);
  });
});

// ---- the people around them ------------------------------------------------------

describe('coworker relationships', () => {
  it('pairs a handful of teammates, each with words of their own', () => {
    expect(PAIRS.length).toBeGreaterThanOrEqual(10);
    expect(PAIRS.length).toBeLessThanOrEqual(14);
    const lines = new Set<unknown>();
    for (const pair of PAIRS) {
      expect(EMPLOYEES_BY_ID[pair.a] && EMPLOYEES_BY_ID[pair.b], pair.id).toBeTruthy();
      expect(pair.a).not.toBe(pair.b);
      for (const locale of Object.keys(LOCALES)) {
        for (const key of ['1.a', '1.b', '2.a', '2.b']) {
          const line = text(locale, `pair.${pair.id}.${key}`);
          expect(typeof line, `${locale} pair.${pair.id}.${key}`).toBe('string');
          expect(lines.has(line), `${locale} pair.${pair.id}.${key} repeats`).toBe(false);
          lines.add(line);
        }
      }
    }
  });

  it('changes how they feel when they share a room', () => {
    const together = (a: string, b: string) =>
      company(30, (s) => {
        for (const id of IDS) s.employees[id].hired = id === a || id === b;
        s.employees[a].room = 'founder-desk';
        s.employees[b].room = 'founder-desk';
      });
    const expectations: Array<[string, string, string, string]> = [
      ['moss', 'echo', 'happy', 'happy'], // friends
      ['nixie', 'quincy', 'focused', 'focused'], // rivals
      ['hazel', 'nino', 'embarrassed', 'embarrassed'], // awkward
      ['marlow', 'pip', 'proud', 'inspired'], // mentor and mentee
    ];
    for (const [a, b, moodA, moodB] of expectations) {
      const w = together(a, b);
      expect(pairsTogether(w.state, a).length, `${a}+${b}`).toBe(1);
      expect(employeeMood(w.state, a, w.now()), a).toBe(moodA);
      expect(employeeMood(w.state, b, w.now()), b).toBe(moodB);
    }
    // Apart, nothing.
    const apart = company(30, (s) => {
      for (const id of IDS) s.employees[id].hired = id === 'moss';
    });
    expect(pairsTogether(apart.state, 'moss')).toHaveLength(0);
  });

  it('remembers having seen them together, for both of them', () => {
    const w = company(30);
    w.engine.notePairSeen('night-shift');
    for (const [id, other] of [
      ['moss', 'echo'],
      ['echo', 'moss'],
    ]) {
      const entry = journalFor(w.state, id).find((e) => e.kind === 'pair');
      expect(entry && entry.kind === 'pair' && entry.other).toBe(other);
    }
  });
});

// ---- moments they start -------------------------------------------------------------

describe('moments they start', () => {
  it('waves you over for a milestone first, then their story, then a hint', () => {
    const w = company(16);
    expect(pendingMoment(w.state, 'perry', w.now())).toEqual({ kind: 'milestone', tier: 1 });
    w.engine.openTalk('perry', undefined, true);
    w.engine.closeTalk();
    expect(pendingMoment(w.state, 'perry', w.now())).toEqual({
      kind: 'story',
      topicId: 'story-perry-1',
    });
  });

  it('waves a few teammates over at a time, news about the friendship first', () => {
    const w = company(20);
    w.engine.openTalk('pip', undefined, true);
    w.engine.closeTalk();
    const waving = wavingTeammates(w.state, w.now());
    expect(waving.size).toBe(MAX_WAVING);
    expect([...waving.values()].every((m) => m.kind === 'milestone')).toBe(true);
    // Once the news is out, the stories are next in line.
    for (const id of IDS) {
      w.engine.openTalk(id, undefined, true);
      w.engine.closeTalk();
    }
    expect([...wavingTeammates(w.state, w.now()).values()].map((m) => m.kind)).toEqual([
      'story',
      'story',
      'story',
    ]);
  });

  it('gives them a breather after a conversation', () => {
    const w = company(16, (s) => {
      s.flags['axel.tier.1'] = T0;
    });
    talk(
      w,
      'axel',
      'check-in',
      TALKS_BY_ID['check-in'].nodes[TALKS_BY_ID['check-in'].root].choices[0].id,
    );
    expect(pendingMoment(w.state, 'axel', w.now())).toBeNull();
    w.wait(TALK_COOLDOWN_SECONDS + 1);
    expect(pendingMoment(w.state, 'axel', w.now())?.kind).toBe('story');
  });
});

// ---- it all lasts ------------------------------------------------------------------

describe('persistence', () => {
  it('survives a save and load: stages, stories, gifts, moods and the scrapbook', () => {
    const w = company(15);
    talk(w, 'corvus', 'story-corvus-1', 'a');
    w.state.employees.corvus.friendship = 42;
    w.wait(STORY_GAP_SECONDS + 1);
    talk(w, 'corvus', 'story-corvus-2', 'a');
    w.engine.openTalk('rizzo', 'gift', true);
    w.engine.chooseTalkOption('coffee', w.engine.activeTalk!.instanceId);
    w.engine.closeTalk();

    const loaded = roundTrip(w.state);
    for (const id of ['corvus', 'rizzo']) {
      expect(journalFor(loaded, id)).toEqual(journalFor(w.state, id));
      expect(storyState(loaded, id, w.now())).toEqual(storyState(w.state, id, w.now()));
      expect(knownReactions(loaded, id)).toEqual(knownReactions(w.state, id));
    }
    // The emotion their story left them with is still there after the load.
    expect(employeeMood(loaded, 'corvus', w.now())).toBe(CHARACTERS.corvus.story.moods[2]);
    // So is the promise of a find, and the find itself keeps its words.
    expect(
      loaded.scheduled.some((s) => JSON.stringify(s.effects).includes('arc.corvus.find')),
    ).toBe(true);
    const engine = new GameEngine(loaded, { deterministic: true, now: () => w.now() + 400_000 });
    engine.tick(0.1);
    const find = engine.state.finds.find((f) => f.noteKey === 'arc.corvus.find');
    expect(find).toBeDefined();
    expect(roundTrip(engine.state).finds.find((f) => f.id === find!.id)?.noteKey).toBe(
      'arc.corvus.find',
    );
  });

  it('keeps every relationship through a restructure', () => {
    const w = company(15);
    tellStory(w, 'pingo', ['a', 'a', 'b']);
    w.engine.notePairSeen('timetable');
    talk(w, 'pingo', 'gift', CHARACTERS.pingo.gifts.loves);
    w.state.stats.totalNutsEarned = 1e15;
    w.state.resources.nuts = 1e15;
    const before = journalFor(w.state, 'pingo');
    const after = performPrestige(w.state, 'cooperative', w.now() + 1000);
    expect(after.prestige.count).toBe(1);
    expect(journalFor(after, 'pingo')).toEqual(before);
    expect(storyState(after, 'pingo', w.now()).told).toBe(3);
    expect(keepsakeOnDisplay(after, 'pingo')).toBe(true);
    expect(knownFavorite(after, 'pingo')).toBe(CHARACTERS.pingo.gifts.loves);
  });

  it('reads an old save honestly: an old favourite is a gift given, not a secret revealed', () => {
    const old = createInitialState(T0);
    for (const id of IDS) old.employees[id].hired = true;
    old.employees.mina.friendship = 55;
    // Before the discovery game: a "favourite known" mark, and one gift remembered.
    old.flags['favorite.mina.giftKnown'] = T0;
    old.flags['favorite.mina.giftMemory'] = T0;
    old.flags['favorite.pip.giftMemory'] = T0;
    old.flags['favorite.otto.giftKnown'] = T0;
    const loaded = roundTrip(old);
    const engine = new GameEngine(loaded, { deterministic: true, now: () => T0 });
    const s = engine.state;

    // Mina was given coffee back then; her favourite has since been rewritten.
    const legacy = LEGACY_GIFT_FAVORITES.mina;
    expect(knownReactions(s, 'mina')).toEqual({ [legacy]: giftReaction('mina', legacy) });
    expect(knownFavorite(s, 'mina')).toBe(CHARACTERS.mina.gifts.loves === legacy ? legacy : null);
    // Pip's favourite was and still is coffee: that one really was found.
    expect(knownFavorite(s, 'pip')).toBe('coffee');
    // "Known" without ever having given it reveals nothing any more.
    expect(knownFavorite(s, 'otto')).toBeNull();
    // An old friendship is celebrated once, at the stage it has reached.
    expect(pendingMoment(s, 'mina', T0)).toEqual({ kind: 'milestone', tier: 2 });
    // Nothing old is mistaken for a story told.
    expect(storyState(s, 'mina', T0).told).toBe(0);
  });
});
