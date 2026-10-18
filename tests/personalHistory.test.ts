import { describe, expect, it } from 'vitest';

import en from '../src/i18n/locales/en.json';
import pt from '../src/i18n/locales/pt-BR.json';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import { migrate } from '../src/save/migrations';
import { gameStateSchema } from '../src/save/schema';
import { performPrestige } from '../src/sim/prestige';
import { EMPLOYEES } from '../src/content/employees';
import { CHARACTERS } from '../src/content/characters';
import { GIFTS } from '../src/content/employeeGifts';
import {
  BOND_THRESHOLDS,
  STORY_CALLBACK_DELAY_SECONDS,
  STORY_FIND_DELAY_SECONDS,
  STORY_GAP_SECONDS,
  storyTopicId,
} from '../src/content/stories';
import { KEEPSAKE_TALKS, keepsakeFlag, keepsakeTopicId } from '../src/content/employeeKeepsakes';
import { TALKS_BY_ID, topicsForEmployee } from '../src/content/employeeTalks';
import { GAME_EVENTS } from '../src/content/events';
import {
  journalFor,
  keepsakeFor,
  keepsakeOnDisplay,
  storyNamed,
  storyState,
  talkAftermath,
  talkChoiceCost,
} from '../src/sim/bonds';
import { remarksDue } from '../src/sim/happenings';
import { nodePrompt, TALK_COOLDOWN_SECONDS } from '../src/sim/talks';
import type { GameState } from '../src/sim/types';

/**
 * Chapter 7: stories, keepsakes and personal history.
 *
 * A story is told over visits, and each part says when it ends where the story
 * stands and what it set going (never what); what you said in Part 1 comes back in
 * the office on its own; a keepsake stays unknown until you have heard of it, then
 * says what it is, where it is and how it got there; the scrapbook files what you
 * said as well as what they said, and names no story before it begins. All of it
 * is read from marks the save already keeps.
 */

const T0 = 1_800_000_000_000;
const IDS = EMPLOYEES.map((employee) => employee.id);
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

/** Everyone on the payroll, money to spend, a clock we control. */
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
    wait(seconds: number) {
      clock += seconds * 1000;
      engine.tick(0.1);
    },
  };
}
type World = ReturnType<typeof company>;

/** Sit down for a topic, answer once, and return what the visit is left saying. */
function answer(w: World, id: string, topicId: string, choice: string) {
  expect(w.engine.openTalk(id, topicId, true), `${topicId} opens for ${id}`).toBe(true);
  expect(w.engine.chooseTalkOption(choice, w.engine.activeTalk!.instanceId)).toBe(true);
  const talk = w.engine.activeTalk!;
  const left = { aftermath: talk.aftermath, ended: talk.nodeId === '', report: talk.report };
  w.engine.closeTalk();
  return left;
}

/** Tell a whole story, as a player would across visits. */
function tellStory(w: World, id: string, choices: ['a' | 'b', 'a' | 'b', 'a' | 'b']) {
  const rt = w.state.employees[id];
  rt.friendship = Math.max(rt.friendship, BOND_THRESHOLDS.familiar);
  answer(w, id, storyTopicId(id, 1), choices[0]);
  rt.friendship = Math.max(rt.friendship, BOND_THRESHOLDS.trusted);
  w.wait(STORY_GAP_SECONDS + 1);
  answer(w, id, storyTopicId(id, 2), choices[1]);
  rt.friendship = Math.max(rt.friendship, BOND_THRESHOLDS.close);
  w.wait(STORY_GAP_SECONDS + 1);
  const finale = answer(w, id, storyTopicId(id, 3), choices[2]);
  w.wait(TALK_COOLDOWN_SECONDS + 1);
  return finale;
}

const roundTrip = (state: GameState) =>
  gameStateSchema.parse(migrate(JSON.parse(JSON.stringify(state)))) as GameState;

// ---- a story's turns ---------------------------------------------------------------

describe('a story told over visits says, as each part ends, where it stands', () => {
  it('Part 1 is remembered, Part 2 sets something going, the end files a souvenir', () => {
    const w = company(BOND_THRESHOLDS.familiar);
    const first = answer(w, 'otto', storyTopicId('otto', 1), 'b');
    expect(first.ended).toBe(true);
    expect(first.aftermath).toMatchObject({ remembered: true, later: false, keepsake: false });
    // ...and the visit can say what the next part waits for.
    expect(storyState(w.state, 'otto', w.now())).toMatchObject({
      told: 1,
      next: 2,
      waitingFor: 'friendship',
    });

    w.state.employees.otto.friendship = BOND_THRESHOLDS.trusted;
    w.wait(STORY_GAP_SECONDS + 1);
    const kind = answer(w, 'otto', storyTopicId('otto', 2), 'a');
    expect(kind.aftermath).toMatchObject({ later: true, remembered: false });
    expect(storyState(w.state, 'otto', w.now()).waitingFor).toBe('friendship');

    w.state.employees.otto.friendship = BOND_THRESHOLDS.close;
    w.wait(STORY_GAP_SECONDS + 1);
    const end = answer(w, 'otto', storyTopicId('otto', 3), 'a');
    expect(end.aftermath).toMatchObject({ moment: true, keepsake: true });
    expect(storyState(w.state, 'otto', w.now()).told).toBe(3);
  });

  it('the other answer to Part 2 sets nothing going, it brings in their partner', () => {
    const w = company(BOND_THRESHOLDS.familiar);
    answer(w, 'otto', storyTopicId('otto', 1), 'a');
    w.state.employees.otto.friendship = BOND_THRESHOLDS.trusted;
    w.wait(STORY_GAP_SECONDS + 1);
    const before = w.state.employees.rizzo.friendship;
    const other = answer(w, 'otto', storyTopicId('otto', 2), 'b');
    expect(other.aftermath).toMatchObject({ later: false, remembered: false });
    expect(w.state.employees.rizzo.friendship).toBe(before + 3);
    expect(w.state.scheduled).toEqual([]);
  });

  it('every teammate’s story ends with their keepsake going on the desk, said once', () => {
    const w = company(0);
    for (const id of IDS) {
      const finale = tellStory(w, id, ['a', 'b', 'a']);
      expect(finale.aftermath?.keepsake, id).toBe(true);
      expect(finale.aftermath?.moment, id).toBe(true);
      expect(keepsakeOnDisplay(w.state, id), id).toBe(true);
    }
  });

  it('does not reveal a keepsake that is already on the desk', () => {
    const w = company(30);
    answer(w, 'bea', keepsakeTopicId('bea'), 'care');
    expect(keepsakeOnDisplay(w.state, 'bea')).toBe(true);
    w.wait(TALK_COOLDOWN_SECONDS + 1);
    const finale = tellStory(w, 'bea', ['b', 'a', 'b']);
    expect(finale.aftermath?.keepsake).toBe(false);
  });
});

describe('what you said in Part 1 comes back in the office', () => {
  it('once, on its own, a few minutes later, in their words for that answer', () => {
    for (const choice of ['a', 'b'] as const) {
      const w = company(BOND_THRESHOLDS.familiar);
      answer(w, 'hazel', storyTopicId('hazel', 1), choice);
      const key = `arc.hazel.callback.${choice}`;
      const [remark] = w.state.happenings.remarks;
      expect(remark).toMatchObject({ employeeId: 'hazel', key });
      expect(remark.at - w.now()).toBe(STORY_CALLBACK_DELAY_SECONDS * 1000);
      expect(remarksDue(w.state, w.now())).toEqual([]);
      w.wait(STORY_CALLBACK_DELAY_SECONDS);
      expect(remarksDue(w.state, w.now())).toEqual([{ employeeId: 'hazel', key, at: remark.at }]);
      expect(w.engine.takeRemark('hazel')).toBe(key);
      expect(w.engine.takeRemark('hazel')).toBeNull();
    }
  });

  it('waits for the player however long they are away, and is kept by a save', () => {
    const w = company(BOND_THRESHOLDS.familiar);
    answer(w, 'pingo', storyTopicId('pingo', 1), 'a');
    w.engine.setAttended(false);
    w.wait(3 * 3600);
    // Nobody heard it: it is still waiting, once.
    expect(w.state.happenings.remarks.map((r) => r.key)).toEqual(['arc.pingo.callback.a']);
    const loaded = roundTrip(w.state);
    expect(loaded.happenings.remarks).toEqual(w.state.happenings.remarks);
    const again = new GameEngine(loaded, { deterministic: true, now: () => w.now() });
    expect(again.takeRemark('pingo')).toBe('arc.pingo.callback.a');
  });

  it('is written for both answers of every teammate, in both languages', () => {
    for (const id of IDS) {
      const part1 = TALKS_BY_ID[storyTopicId(id, 1)].nodes.open.choices;
      for (const choice of part1) {
        const remark = choice.effects.find((effect) => effect.type === 'remark');
        expect(remark?.lineKey, `${id} ${choice.id}`).toBe(`arc.${id}.callback.${choice.id}`);
        for (const locale of Object.keys(LOCALES)) {
          expect(typeof text(locale, remark!.lineKey!), `${locale} ${remark!.lineKey}`).toBe(
            'string',
          );
        }
      }
    }
  });
});

describe('a promised payoff respects the window', () => {
  it('Part 2’s find waits while the game is minimized and arrives once it is seen', () => {
    const w = company(BOND_THRESHOLDS.familiar);
    answer(w, 'moss', storyTopicId('moss', 1), 'a');
    w.state.employees.moss.friendship = BOND_THRESHOLDS.trusted;
    w.wait(STORY_GAP_SECONDS + 1);
    answer(w, 'moss', storyTopicId('moss', 2), 'a');
    w.engine.setAttended(false);
    w.wait(STORY_FIND_DELAY_SECONDS + 60);
    expect(w.state.finds.some((find) => find.noteKey)).toBe(false);
    expect(w.engine.settledConsequences).toEqual([]);
    w.engine.setAttended(true);
    w.wait(0.1);
    expect(w.state.finds.filter((find) => find.noteKey === 'arc.moss.find')).toHaveLength(1);
    expect(w.engine.settledConsequences).toHaveLength(1);
    w.wait(STORY_FIND_DELAY_SECONDS);
    expect(w.state.finds.filter((find) => find.noteKey === 'arc.moss.find')).toHaveLength(1);
  });
});

// ---- answers: what they cost, what they leave --------------------------------------

describe('an answer says what it costs before it is taken', () => {
  it('a keepsake’s care costs what it charges, and the other answer is free', () => {
    for (const topic of KEEPSAKE_TALKS) {
      const [care, other] = topic.nodes.open.choices;
      expect(talkChoiceCost(care).nuts, topic.id).toBe(care.requires?.nuts);
      expect(talkChoiceCost(care).nuts, topic.id).toBeGreaterThan(0);
      expect(talkChoiceCost(other), topic.id).toEqual({ nuts: 0, goldenNuts: 0 });
    }
  });

  it('a check-in’s fix and every gift say their price', () => {
    const fix = topicsForEmployee('otto')
      .find((topic) => topic.id === 'check-in')!
      .nodes.listened.choices.find((choice) => choice.id === 'fix')!;
    expect(talkChoiceCost(fix)).toEqual({ nuts: 2500, goldenNuts: 0 });
    const gifts = topicsForEmployee('otto').find((topic) => topic.id === 'gift')!.nodes.open
      .choices;
    for (const gift of GIFTS) {
      const choice = gifts.find((candidate) => candidate.id === gift.id)!;
      expect(talkChoiceCost(choice), gift.id).toEqual({
        nuts: gift.cost.nuts ?? 0,
        goldenNuts: gift.cost.goldenNuts ?? 0,
      });
    }
  });
});

describe('a conversation says what it set going, and only what it did', () => {
  it('praise is remembered at the next check-in; a promise lands later', () => {
    const w = company(30);
    const praise = answer(w, 'junie', 'check-in', 'praise');
    expect(praise.aftermath).toMatchObject({ remembered: true, later: false });
    w.wait(TALK_COOLDOWN_SECONDS + 1);
    const open = topicsForEmployee('junie').find((topic) => topic.id === 'check-in')!.nodes.open;
    expect(
      nodePrompt(w.state, open, { employeeId: 'junie', topicId: 'check-in', now: w.now() }),
    ).toBe('checkin.junie.praised');

    const v = company(30);
    expect(v.engine.openTalk('rosa', 'check-in', true)).toBe(true);
    v.engine.chooseTalkOption('listen', v.engine.activeTalk!.instanceId);
    v.engine.chooseTalkOption('promise', v.engine.activeTalk!.instanceId);
    expect(v.engine.activeTalk!.aftermath).toMatchObject({ later: true });
    expect(v.state.scheduled).toHaveLength(1);
  });

  it('a keepsake answer that opens an incident later says so, and it does open', () => {
    const w = company(30);
    expect(w.engine.eligibleEventIds()).not.toContain('building-replies');
    const other = answer(w, 'inky', keepsakeTopicId('inky'), 'other');
    expect(other.aftermath?.later).toBe(true);
    expect(w.engine.eligibleEventIds()).toContain('building-replies');
  });

  it('a keepsake Pip is looked after for is remembered in the incident about him', () => {
    const care = TALKS_BY_ID[keepsakeTopicId('pip')].nodes.open.choices[0];
    expect(talkAftermath('pip', care).remembered).toBe(true);
    const coffee = GAME_EVENTS.find((event) => event.id === 'coffee-for-the-night-shift')!;
    expect(
      coffee.choices.some((choice) => choice.requires?.flag === keepsakeFlag('pip', 'cared')),
    ).toBe(true);
  });

  it('never claims more than the answer does, for anything anyone can be asked', () => {
    for (const id of IDS) {
      for (const topic of topicsForEmployee(id)) {
        for (const node of Object.values(topic.nodes)) {
          for (const choice of node.choices) {
            const left = talkAftermath(id, choice);
            if (!left.later) continue;
            const marks = choice.effects.filter((e) => e.type === 'setFlag').map((e) => e.flagId);
            const delayed = choice.effects.some(
              (e) =>
                (e.type === 'schedule' && (e.scheduled?.length ?? 0) > 0) ||
                ['find', 'incident', 'oddity'].includes(e.type),
            );
            const opens =
              GAME_EVENTS.some((event) => marks.includes(event.requires?.flag)) ||
              topicsForEmployee(id).some(
                (other) => !other.story && marks.includes(other.requires?.flag),
              );
            expect(delayed || opens, `${id} ${topic.id} ${choice.id}`).toBe(true);
          }
        }
      }
    }
  });
});

// ---- the keepsake ----------------------------------------------------------------

describe('a keepsake is a personal object with a history', () => {
  it('stays unknown until you have heard of it', () => {
    const w = company(30);
    for (const id of IDS) expect(keepsakeFor(w.state, id), id).toBeNull();
    expect(journalFor(w.state, 'bea').some((entry) => entry.kind === 'keepsake')).toBe(false);
  });

  it('kept in the drawer after you talk it over, on the desk once you look after it', () => {
    const w = company(30);
    answer(w, 'otto', keepsakeTopicId('otto'), 'other');
    expect(keepsakeFor(w.state, 'otto')).toMatchObject({
      onDisplay: false,
      reason: null,
      since: null,
      itemKey: 'item.ledger',
      sceneKey: 'keepsake.otto.scene',
      talk: {
        decision: 'discussed',
        choiceLabelKey: 'keepsake.otto.other.label',
        replyKey: 'keepsake.otto.other.reply',
      },
    });
    const at = w.now();
    answer(w, 'bea', keepsakeTopicId('bea'), 'care');
    expect(keepsakeFor(w.state, 'bea')).toMatchObject({
      onDisplay: true,
      reason: 'cared',
      since: at,
      talk: { decision: 'cared', choiceLabelKey: 'keepsake.bea.care.label' },
    });
  });

  it('goes on the desk at the end of their story, and says so', () => {
    const w = company(30);
    answer(w, 'otto', keepsakeTopicId('otto'), 'other');
    w.wait(TALK_COOLDOWN_SECONDS + 1);
    tellStory(w, 'otto', ['a', 'a', 'b']);
    const view = keepsakeFor(w.state, 'otto')!;
    expect(view).toMatchObject({ onDisplay: true, reason: 'story' });
    expect(view.since).toBe(w.state.flags['otto.arc.done']);
    // The conversation about it is still part of its history.
    expect(view.talk?.decision).toBe('discussed');
  });

  it('files the conversation about it once, with what you chose and what they said', () => {
    const w = company(30);
    answer(w, 'nixie', keepsakeTopicId('nixie'), 'care');
    const entries = journalFor(w.state, 'nixie');
    expect(entries.filter((entry) => entry.kind === 'keepsake')).toEqual([
      {
        kind: 'keepsake',
        at: w.state.flags['favorite.nixie.cared'],
        decision: 'cared',
        titleKey: 'item.gadget',
        saidKey: 'keepsake.nixie.care.label',
        quoteKey: 'keepsake.nixie.care.reply',
      },
    ]);
    // Not again as a bare conversation title.
    expect(entries.filter((entry) => entry.kind === 'talk')).toEqual([]);
  });

  it('has a name, a scene, two answers and two replies for all 23, in both languages', () => {
    for (const employee of EMPLOYEES) {
      const topic = TALKS_BY_ID[keepsakeTopicId(employee.id)];
      const keys = [
        employee.favoriteItemKey,
        `keepsake.${employee.id}.scene`,
        ...topic.nodes.open.choices.flatMap((choice) => [choice.labelKey, choice.replyKey]),
      ];
      for (const locale of Object.keys(LOCALES)) {
        for (const key of keys) {
          const value = text(locale, key);
          expect(typeof value === 'string' && value.length > 0, `${locale} ${key}`).toBe(true);
        }
      }
    }
  });
});

// ---- the scrapbook ---------------------------------------------------------------

describe('the scrapbook files what you said, and names nothing early', () => {
  it('does not name a story before it begins, or is ready to', () => {
    const w = company(0);
    expect(storyNamed(w.state, 'nino', w.now())).toBe(false);
    w.state.employees.nino.friendship = BOND_THRESHOLDS.familiar;
    expect(storyNamed(w.state, 'nino', w.now())).toBe(true);
    const later = company(0);
    later.state.flags['nino.arc.1'] = T0;
    expect(storyNamed(later.state, 'nino', later.now())).toBe(true);
  });

  it('keeps your words beside theirs for every part of every story', () => {
    const w = company(0);
    IDS.forEach((id, index) => {
      const choices: ['a' | 'b', 'a' | 'b', 'a' | 'b'] = [
        index % 2 ? 'a' : 'b',
        index % 3 ? 'b' : 'a',
        'a',
      ];
      tellStory(w, id, choices);
      const parts = journalFor(w.state, id).filter((entry) => entry.kind === 'story');
      for (const entry of parts) {
        if (entry.kind !== 'story') continue;
        expect(entry.saidKey).toBe(`arc.${id}.${entry.part}.${entry.choice}.label`);
        expect(entry.quoteKey).toBe(`arc.${id}.${entry.part}.${entry.choice}.reply`);
        expect(entry.choice).toBe(choices[entry.part - 1]);
      }
    });
  });
});

// ---- saves -------------------------------------------------------------------------

describe('personal history survives saves, old saves and a restructure', () => {
  it('reads the same after a save and a reload', () => {
    const w = company(30);
    answer(w, 'bea', keepsakeTopicId('bea'), 'care');
    w.wait(TALK_COOLDOWN_SECONDS + 1);
    tellStory(w, 'otto', ['b', 'a', 'a']);
    const loaded = roundTrip(w.state);
    for (const id of ['bea', 'otto']) {
      expect(keepsakeFor(loaded, id), id).toEqual(keepsakeFor(w.state, id));
      expect(journalFor(loaded, id), id).toEqual(journalFor(w.state, id));
    }
  });

  it('reads an old save honestly: earned keepsakes show, nothing unearned does', () => {
    // A save written before this chapter: the marks only, no new fields.
    const old = createInitialState(T0);
    old.employees.pip.hired = true;
    old.employees.pip.friendship = 50;
    old.employees.pip.talks = { count: 1, lastAt: T0, seen: { 'keepsake-pip': T0 } };
    old.flags['favorite.pip.cared'] = T0;
    // Someone whose conversation was recorded but whose decision never was.
    old.employees.rizzo.hired = true;
    old.employees.rizzo.talks = { count: 1, lastAt: T0, seen: { 'keepsake-rizzo': T0 } };
    const loaded = roundTrip(old);
    expect(keepsakeFor(loaded, 'pip')).toMatchObject({ onDisplay: true, reason: 'cared' });
    expect(keepsakeFor(loaded, 'rizzo')).toBeNull();
    expect(keepsakeOnDisplay(loaded, 'rizzo')).toBe(false);
    // It still has its plain line in the scrapbook, as before.
    expect(journalFor(loaded, 'rizzo')).toEqual([
      { kind: 'talk', at: T0, titleKey: 'item.stapler' },
    ]);
  });

  it('keeps keepsakes and stories through a restructure', () => {
    const w = company(30);
    answer(w, 'bea', keepsakeTopicId('bea'), 'care');
    w.wait(TALK_COOLDOWN_SECONDS + 1);
    tellStory(w, 'otto', ['a', 'b', 'a']);
    w.state.stats.totalNutsEarned = 1e15;
    const after = performPrestige(w.state, 'cooperative', w.now() + 1000);
    expect(keepsakeFor(after, 'bea')).toEqual(keepsakeFor(w.state, 'bea'));
    expect(keepsakeFor(after, 'otto')).toEqual(keepsakeFor(w.state, 'otto'));
    expect(storyState(after, 'otto', w.now()).told).toBe(3);
  });
});

// ---- words ----------------------------------------------------------------------

describe('words', () => {
  const KEYS = [
    'talk.cost.nuts',
    'talk.cost.goldenNuts',
    'visit.storyUnnamed',
    'visit.storyWaiting.first',
    'visit.keepsake.kind',
    'visit.keepsake.onDesk',
    'visit.keepsake.kept',
    'visit.keepsake.sinceTalk',
    'visit.keepsake.sinceStory',
    'visit.keepsake.chosen',
    'visit.keepsake.revealed',
    'visit.keepsake.see',
    'visit.keepsake.seeItem',
    'office.keepsakeTip',
    'scrapbook.keepsake',
    'scrapbook.youSaid',
  ];

  it('has every line in both languages, written rather than copied', () => {
    for (const key of KEYS) {
      const english = text('en', key);
      const portuguese = text('pt-BR', key);
      expect(typeof english, `en ${key}`).toBe('string');
      expect(typeof portuguese, `pt-BR ${key}`).toBe('string');
      expect(portuguese, key).not.toBe(english);
    }
  });

  it('agrees with who it is about in Portuguese', () => {
    expect(Object.values(CHARACTERS).some((c) => c.gender === 'female')).toBe(true);
    for (const key of ['visit.keepsake.onDesk', 'visit.keepsake.revealed']) {
      expect(text('pt-BR', key), key).toMatch(/\bdele\b/);
      expect(text('pt-BR', `${key}_female`), `${key}_female`).toMatch(/\bdela\b/);
    }
  });
});
