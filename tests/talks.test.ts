import { describe, expect, it } from 'vitest';

import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import { SAVE_VERSION } from '../src/sim/config';
import { migrate } from '../src/save/migrations';
import { gameStateSchema } from '../src/save/schema';
import { TALKS_BY_ID, topicsForEmployee } from '../src/content/employeeTalks';
import {
  TALK_COOLDOWN_SECONDS,
  canTalk,
  eligibleTopics,
  evaluateTalkNode,
  pickTopic,
  talkCooldownRemaining,
  topicSpent,
} from '../src/sim/talks';
import type { GameState } from '../src/sim/types';

/**
 * Employee conversations: gating, branching, and whether a decision actually sticks.
 *
 * These test MECHANICS, not the writing: that a choice moves the numbers it claims to,
 * that a promise made in conversation is billed later by the same queue that bills
 * events, that a once-only topic stays spent across a save/load, and that a
 * conversation can never dead-end with no option the player can take.
 */

/** An engine with an injectable clock, so cooldowns and delays are testable. */
function engineAt(now: number, mutate?: (s: GameState) => void) {
  const state = createInitialState(now);
  mutate?.(state);
  return new GameEngine(state, { deterministic: true, now: () => now });
}

/** Hire someone and give the company enough to spend. */
function staffed(now: number, extra?: (s: GameState) => void) {
  return engineAt(now, (s) => {
    for (const id of ['pip', 'dorm', 'rizzo']) {
      s.employees[id] = {
        ...s.employees[id],
        hired: true,
        level: 3,
        friendship: 60,
        talks: { count: 0, lastAt: 0, seen: {} },
      };
    }
    s.resources.nuts = 500_000;
    s.resources.goldenNuts = 10;
    s.resources.morale = 70;
    extra?.(s);
  });
}

describe('conversation content', () => {
  it('gives every topic a reachable root and only valid node links', () => {
    for (const topic of Object.values(TALKS_BY_ID)) {
      expect(topic.nodes[topic.root], `${topic.id} root`).toBeDefined();
      for (const node of Object.values(topic.nodes)) {
        expect(node.choices.length, `${topic.id}/${node.id} has options`).toBeGreaterThan(0);
        for (const choice of node.choices) {
          if (choice.next) {
            expect(
              topic.nodes[choice.next],
              `${topic.id}/${choice.id} -> ${choice.next}`,
            ).toBeDefined();
          }
        }
      }
    }
  });

  // The stated failure mode for this feature was three buttons that all do the same
  // thing. A node's options must differ in what they DO, not only in wording.
  it('never offers a node whose options all have the same effects', () => {
    for (const topic of Object.values(TALKS_BY_ID)) {
      for (const node of Object.values(topic.nodes)) {
        if (node.choices.length < 2) continue;
        const shapes = new Set(
          node.choices.map((c) =>
            JSON.stringify(
              c.effects.map((e) => `${e.type}:${e.value ?? ''}:${e.flagId ?? ''}`).sort(),
            ),
          ),
        );
        expect(shapes.size, `${topic.id}/${node.id} options are interchangeable`).toBe(
          node.choices.length,
        );
      }
    }
  });

  it('gives every option its own reply, so a choice always gets a response', () => {
    const replies = new Set<string>();
    for (const topic of Object.values(TALKS_BY_ID)) {
      for (const node of Object.values(topic.nodes)) {
        for (const choice of node.choices) {
          expect(choice.replyKey, `${topic.id}/${choice.id}`).toBeTruthy();
          expect(replies.has(choice.replyKey), `${choice.replyKey} is reused`).toBe(false);
          replies.add(choice.replyKey);
        }
      }
    }
  });

  it('scopes character topics to their own animal', () => {
    expect(topicsForEmployee('pip').map((t) => t.id)).toContain('pip-doubt');
    expect(topicsForEmployee('dorm').map((t) => t.id)).not.toContain('pip-doubt');
    // Universal topics are available to everyone.
    expect(topicsForEmployee('dorm').map((t) => t.id)).toContain('check-in');
  });
});

describe('conversation eligibility', () => {
  it('offers nothing for an employee who has not been hired', () => {
    const e = engineAt(1_000);
    expect(eligibleTopics(e.state, 'dorm', 1_000)).toEqual([]);
    expect(e.openTalk('dorm')).toBe(false);
  });

  it('opens the most pressing topic first', () => {
    // A morale crisis outranks small talk, deterministically.
    const e = staffed(1_000, (s) => {
      s.resources.morale = 20;
    });
    expect(pickTopic(e.state, 'dorm', 1_000)?.id).toBe('slump');
    // With morale healthy, the crisis topic is not even eligible.
    const calm = staffed(1_000, (s) => {
      s.resources.morale = 80;
    });
    expect(eligibleTopics(calm.state, 'dorm', 1_000).map((t) => t.id)).not.toContain('slump');
  });

  it('hides a topic whose requirements are not met', () => {
    const poor = staffed(1_000, (s) => {
      s.resources.nuts = 0;
      s.resources.goldenNuts = 0;
    });
    // The gift topic needs something to give.
    expect(eligibleTopics(poor.state, 'dorm', 1_000).map((t) => t.id)).not.toContain('gift');
  });

  it('requires trust before a private topic is offered', () => {
    const stranger = staffed(1_000, (s) => {
      s.employees.pip.friendship = 5;
    });
    expect(eligibleTopics(stranger.state, 'pip', 1_000).map((t) => t.id)).not.toContain(
      'pip-doubt',
    );
    const friend = staffed(1_000, (s) => {
      s.employees.pip.friendship = 80;
    });
    expect(eligibleTopics(friend.state, 'pip', 1_000).map((t) => t.id)).toContain('pip-doubt');
  });
});

describe('taking an option', () => {
  it('applies the measured effects and reports them', () => {
    const e = staffed(1_000, (s) => {
      s.resources.morale = 80;
    });
    const before = e.state.employees.dorm.friendship;
    expect(e.openTalk('dorm')).toBe(true);
    const topic = e.activeTalk!.topic;
    const node = topic.nodes[e.activeTalk!.nodeId];
    // The warm option on dorm's topic trades nothing and buys trust.
    expect(e.chooseTalkOption('let-sleep', e.activeTalk!.instanceId)).toBe(true);
    expect(e.state.employees.dorm.friendship).toBeGreaterThan(before);
    // The report is MEASURED, so it reflects the real change after any caps.
    const change = e.activeTalk!.report!.employees.find((x) => x.id === 'dorm');
    expect(change?.friendshipDelta).toBe(e.state.employees.dorm.friendship - before);
    expect(node.choices.some((c) => c.id === 'let-sleep')).toBe(true);
  });

  it('points employee-scoped effects at the employee being talked to', () => {
    const e = staffed(1_000, (s) => {
      s.resources.morale = 80;
    });
    e.openTalk('dorm');
    e.chooseTalkOption('let-sleep', e.activeTalk!.instanceId);
    // The emotion landed on dorm, and NOT on the founder.
    expect(e.state.employees.dorm.emotion?.id).toBe('relaxed');
    expect(e.state.employees.pip.emotion).toBeNull();
  });

  it('charges a costly option and refuses it when it cannot be paid', () => {
    const broke = staffed(1_000, (s) => {
      s.resources.morale = 80;
      s.resources.nuts = 10;
      s.resources.goldenNuts = 0;
    });
    broke.openTalk('rizzo');
    // The gift topic is not even eligible without funds, so open the one that is and
    // check gating directly on a node instead.
    const e = staffed(1_000, (s) => {
      s.resources.morale = 80;
      s.resources.goldenNuts = 0;
    });
    e.openTalk('dorm');
    const gift = TALKS_BY_ID.gift;
    const evaluated = evaluateTalkNode(e.state, 'dorm', gift.nodes.open.choices, 1_000);
    const golden = evaluated.find((c) => c.choice.id === 'golden')!;
    expect(golden.enabled).toBe(false);
    expect(golden.failures[0].kind).toBe('goldenNuts');
    // ...and an affordable sibling is still open, so the node is not a dead end.
    expect(evaluated.find((c) => c.choice.id === 'coffee')!.enabled).toBe(true);
  });

  it('never leaves a node with no takeable option', () => {
    // Strip the company bare so every gated option fails.
    const e = staffed(1_000, (s) => {
      s.resources.nuts = 0;
      s.resources.goldenNuts = 0;
      s.employees.dorm.friendship = 0;
    });
    for (const topic of Object.values(TALKS_BY_ID)) {
      for (const node of Object.values(topic.nodes)) {
        const evaluated = evaluateTalkNode(e.state, 'dorm', node.choices, 1_000);
        expect(
          evaluated.some((c) => c.enabled),
          `${topic.id}/${node.id} has no takeable option`,
        ).toBe(true);
      }
    }
  });

  it('advances a branch and then ends the conversation', () => {
    const e = staffed(1_000, (s) => {
      s.resources.morale = 80;
      s.employees.pip.friendship = 80;
    });
    expect(e.openTalk('pip')).toBe(true);
    expect(e.activeTalk!.topic.id).toBe('pip-doubt');
    expect(e.activeTalk!.nodeId).toBe('open');
    // `reassure` links to a second node rather than ending.
    e.chooseTalkOption('reassure', e.activeTalk!.instanceId);
    expect(e.activeTalk!.nodeId).toBe('reassured');
    expect(e.activeTalk!.exchanges).toBe(1);
    expect(e.activeTalk!.lastReplyKey).toBeTruthy();
    // The terminal option closes it out.
    e.chooseTalkOption('work', e.activeTalk!.instanceId);
    expect(e.activeTalk!.nodeId).toBe('');
    expect(e.state.employees.pip.talks!.count).toBe(1);
  });

  it('rejects a click that belongs to a conversation that has moved on', () => {
    const e = staffed(1_000, (s) => {
      s.resources.morale = 80;
    });
    e.openTalk('dorm');
    expect(e.chooseTalkOption('let-sleep', 'not-the-right-instance')).toBe(false);
    // The real instance still works.
    expect(e.chooseTalkOption('let-sleep', e.activeTalk!.instanceId)).toBe(true);
  });
});

describe('conversation memory', () => {
  it('starts every employee at never-talked', () => {
    const e = engineAt(1_000);
    expect(e.state.employees.pip.talks).toEqual({ count: 0, lastAt: 0, seen: {} });
  });

  it('spends a once-only topic so it is never offered again', () => {
    const now = 1_000_000;
    const e = staffed(now, (s) => {
      s.resources.morale = 80;
      s.employees.rizzo.friendship = 70;
    });
    expect(e.openTalk('rizzo')).toBe(true);
    expect(e.activeTalk!.topic.id).toBe('rizzo-inventory');
    e.chooseTalkOption('dont-ask', e.activeTalk!.instanceId);
    expect(topicSpent(e.state, 'rizzo', 'rizzo-inventory')).toBe(true);
    expect(eligibleTopics(e.state, 'rizzo', now).map((t) => t.id)).not.toContain('rizzo-inventory');
  });

  // Abandoning a branching conversation after taking its first (rewarding) option used
  // to leave the topic unspent and the cooldown unstarted, so re-opening and taking the
  // same option again repeated the reward indefinitely. Taking an option IS having the
  // conversation.
  it('cannot be farmed by taking the first option and walking away', () => {
    const now = 1_000_000;
    const e = staffed(now, (s) => {
      s.resources.morale = 80;
      s.employees.pip.friendship = 80;
    });
    expect(e.openTalk('pip')).toBe(true);
    expect(e.activeTalk!.topic.id).toBe('pip-doubt');
    // `reassure` branches onward rather than ending the conversation.
    e.chooseTalkOption('reassure', e.activeTalk!.instanceId);
    expect(e.activeTalk!.nodeId).toBe('reassured');
    const afterFirst = e.state.employees.pip.friendship;

    // Walk away mid-conversation.
    e.closeTalk();
    // It still counted, the topic is spent, and the cooldown is running.
    expect(e.state.employees.pip.talks!.count).toBe(1);
    expect(topicSpent(e.state, 'pip', 'pip-doubt')).toBe(true);
    expect(talkCooldownRemaining(e.state, 'pip', now)).toBe(TALK_COOLDOWN_SECONDS);
    // So the reward cannot be taken again.
    expect(e.openTalk('pip')).toBe(false);
    expect(e.state.employees.pip.friendship).toBe(afterFirst);
  });

  it('counts a multi-step conversation once, not once per option', () => {
    const now = 1_000_000;
    const e = staffed(now, (s) => {
      s.resources.morale = 80;
      s.employees.pip.friendship = 80;
    });
    e.openTalk('pip');
    e.chooseTalkOption('reassure', e.activeTalk!.instanceId);
    e.chooseTalkOption('work', e.activeTalk!.instanceId);
    expect(e.activeTalk!.nodeId).toBe('');
    expect(e.state.employees.pip.talks!.count).toBe(1);
  });

  it('holds a cooldown after a conversation, then lets it lapse', () => {
    const now = 1_000_000;
    const e = staffed(now, (s) => {
      s.resources.morale = 80;
    });
    e.openTalk('dorm');
    e.chooseTalkOption('wake', e.activeTalk!.instanceId);
    expect(talkCooldownRemaining(e.state, 'dorm', now)).toBe(TALK_COOLDOWN_SECONDS);
    expect(canTalk(e.state, 'dorm', now)).toBe(false);
    // Opening again is refused while it holds...
    expect(e.openTalk('dorm')).toBe(false);
    // ...and allowed once it has passed.
    const later = now + (TALK_COOLDOWN_SECONDS + 1) * 1000;
    expect(talkCooldownRemaining(e.state, 'dorm', later)).toBe(0);
    expect(canTalk(e.state, 'dorm', later)).toBe(true);
  });

  it('survives a save/load round trip through the schema', () => {
    const now = 1_000_000;
    const e = staffed(now, (s) => {
      s.resources.morale = 80;
    });
    e.openTalk('dorm');
    e.chooseTalkOption('join', e.activeTalk!.instanceId);

    const parsed = gameStateSchema.parse(JSON.parse(JSON.stringify(e.state)));
    expect(parsed.employees.dorm.talks?.count).toBe(1);
    expect(parsed.employees.dorm.talks?.seen['dorm-sleep']).toBe(now);
    // Which means the once-only rule and the cooldown still hold after a reload.
    expect(topicSpent(parsed as unknown as GameState, 'dorm', 'dorm-sleep')).toBe(true);
  });

  it('backfills conversation memory into a save written before the feature', () => {
    const old = {
      version: 10,
      // `resources` is one of the few root fields the schema genuinely requires, so a
      // realistic pre-feature save has to carry it.
      resources: { nuts: 120, goldenNuts: 0, permanentKernels: 0, morale: 60, reputation: 3 },
      employees: { pip: { hired: true, level: 1, friendship: 20, x: 0.2 } },
    };
    const migrated = migrate(old as Record<string, unknown>);
    expect(migrated.version).toBe(SAVE_VERSION);
    const employees = migrated.employees as Record<string, { talks?: unknown }>;
    expect(employees.pip.talks).toEqual({ count: 0, lastAt: 0, seen: {} });
    // A returning player keeps every once-only conversation available rather than
    // having them silently marked spent.
    const parsed = gameStateSchema.parse(migrated);
    expect(parsed.employees.pip.talks?.count).toBe(0);
  });

  it('backfills an employee added by a later content update', () => {
    // repairEmployees runs in the engine constructor, so an employee with no runtime
    // entry at all still ends up with usable conversation memory.
    const e = engineAt(1_000, (s) => {
      delete (s.employees as Record<string, unknown>).dorm;
    });
    expect(e.state.employees.dorm.talks).toEqual({ count: 0, lastAt: 0, seen: {} });
  });
});

describe('conversations reuse the consequence machinery', () => {
  it('bills a promised consequence later, through the scheduled queue', () => {
    let clock = 1_000_000;
    const state = createInitialState(clock);
    for (const id of ['pip', 'dorm']) {
      state.employees[id] = {
        ...state.employees[id],
        hired: true,
        level: 3,
        friendship: 60,
        talks: { count: 0, lastAt: 0, seen: {} },
      };
    }
    state.resources.nuts = 500_000;
    state.resources.morale = 80;
    const e = new GameEngine(state, { deterministic: true, now: () => clock });

    e.openTalk('dorm');
    e.chooseTalkOption('let-sleep', e.activeTalk!.instanceId);
    // The conversation promised something for later, so it is queued rather than paid.
    expect(e.state.scheduled.length).toBe(1);
    const due = e.state.scheduled[0].at;
    expect(due).toBeGreaterThan(clock);

    // Nothing settles early.
    clock = due - 1000;
    e.tick(0.1);
    expect(e.state.scheduled.length).toBe(1);

    // ...and it lands on time, through the same queue that bills random events.
    clock = due + 1000;
    e.tick(0.1);
    expect(e.state.scheduled.length).toBe(0);
    expect(e.settledConsequences.length).toBe(1);
  });

  it('writes a durable flag that other content can read', () => {
    const e = staffed(1_000, (s) => {
      s.resources.morale = 80;
      s.employees.rizzo.friendship = 70;
    });
    e.openTalk('rizzo');
    e.chooseTalkOption('dont-ask', e.activeTalk!.instanceId);
    expect('rizzo.dontAsk' in e.state.flags).toBe(true);
    expect(e.state.flags['rizzo.dontAsk']).toBe(1_000);
  });

  it('records the decision in the company timeline', () => {
    const e = staffed(1_000, (s) => {
      s.resources.morale = 80;
    });
    e.openTalk('dorm');
    e.chooseTalkOption('wake', e.activeTalk!.instanceId);
    const entry = e.state.eventHistory.at(-1)!;
    expect(entry.eventId).toBe('talk:dorm-sleep');
    expect(entry.choiceId).toBe('wake');
  });

  it('closes cleanly and leaves the applied consequences behind', () => {
    const e = staffed(1_000, (s) => {
      s.resources.morale = 80;
    });
    const before = e.state.employees.dorm.friendship;
    e.openTalk('dorm');
    e.chooseTalkOption('join', e.activeTalk!.instanceId);
    const after = e.state.employees.dorm.friendship;
    e.closeTalk();
    expect(e.activeTalk).toBeNull();
    // Closing the screen does not undo anything.
    expect(e.state.employees.dorm.friendship).toBe(after);
    expect(after).toBeGreaterThan(before);
  });
});

/**
 * BREADTH AND CONTINUITY OF THE CONVERSATION CATALOGUE.
 *
 * The catalogue had four universal topics plus personal ones for three animals, so
 * twenty of the twenty-three employees shared exactly the same conversations — the
 * roster read as interchangeable however distinct the artwork was. These tests pin
 * the two properties that fixed it, both of which are easy to lose by editing
 * content:
 *
 *   BREADTH   — personal topics exist for more than a token few animals, and a
 *               personal topic is never offered to the wrong employee.
 *   CONTINUITY — a conversation can exist BECAUSE of an earlier one. `moss-ledger`
 *               is gated on a flag that only certain choices in `moss-count` write,
 *               so it is a consequence of a decision rather than of a timer.
 */
describe('conversation catalogue breadth and continuity', () => {
  /** Hire one animal with enough trust to unlock their personal material. */
  function withEmployee(now: number, id: string, friendship = 60) {
    return engineAt(now, (s) => {
      s.employees[id] = {
        ...s.employees[id],
        hired: true,
        level: 3,
        friendship,
        talks: { count: 0, lastAt: 0, seen: {} },
      };
      s.resources.nuts = 50_000;
      s.resources.goldenNuts = 10;
    });
  }

  it('gives personal conversations to a meaningful share of the cast', () => {
    const personal = new Set(
      Object.values(TALKS_BY_ID)
        .map((t) => t.employeeId)
        .filter((id): id is string => Boolean(id)),
    );
    // Was three (pip, dorm, rizzo). The point of the guard is that adding cast
    // members must not quietly re-dilute the roster back to shared small talk.
    expect(personal.size).toBeGreaterThanOrEqual(5);
  });

  it('never offers one animal another animal\u2019s personal topic', () => {
    for (const topic of Object.values(TALKS_BY_ID)) {
      if (!topic.employeeId) continue;
      const others = ['pip', 'moss', 'bia', 'dorm', 'rizzo'].filter(
        (id) => id !== topic.employeeId,
      );
      for (const other of others) {
        expect(
          topicsForEmployee(other).some((t) => t.id === topic.id),
          `${topic.id} leaked to ${other}`,
        ).toBe(false);
      }
    }
  });

  it('keeps the follow-up conversation shut until the choice that opens it is made', () => {
    const now = 1_000_000;
    const engine = withEmployee(now, 'moss');

    // Before anything is decided, the payoff topic must not be on offer.
    expect(eligibleTopics(engine.state, 'moss', now).map((t) => t.id)).not.toContain('moss-ledger');

    // Hushing her is the option that does NOT file the count, so it must not open it.
    engine.state.flags['moss.hushed'] = now;
    expect(eligibleTopics(engine.state, 'moss', now).map((t) => t.id)).not.toContain('moss-ledger');

    // Filing it is what earns the follow-up.
    engine.state.flags['moss.counted'] = now;
    expect(eligibleTopics(engine.state, 'moss', now).map((t) => t.id)).toContain('moss-ledger');
  });

  it('writes the mark that opens the follow-up when the count is filed', () => {
    // Pure content assertion: the flag written and the flag required must be the
    // same string, which needs no engine.
    const topic = TALKS_BY_ID['moss-count'];
    const filing = topic.nodes.open.choices.find((c) => c.id === 'log');
    expect(filing, 'moss-count must keep an option that files the count').toBeDefined();
    // The flag the follow-up requires and the flag this choice writes must be the
    // same string, or the arc silently never chains.
    expect(filing!.effects.some((e) => e.type === 'setFlag' && e.flagId === 'moss.counted')).toBe(
      true,
    );
    expect(TALKS_BY_ID['moss-ledger'].requires?.flag).toBe('moss.counted');
  });

  it('makes the risky option cost something real and promise something later', () => {
    const door = TALKS_BY_ID['bia-door'];
    const risky = door.nodes.open.choices.find((c) => c.id === 'open-it');
    expect(risky).toBeDefined();
    // A "risky" option that only pays out now is not risky, it is just the best one.
    const promise = risky!.effects.find((e) => e.type === 'schedule');
    expect(promise, 'the risky option must schedule a later consequence').toBeDefined();
    expect(promise!.delaySeconds ?? 0).toBeGreaterThan(0);
    expect((promise!.scheduled ?? []).length).toBeGreaterThan(0);
    // And the later consequence must actually be a downside somewhere.
    expect(
      (promise!.scheduled ?? []).some((e) => (e.value ?? 0) < 0),
      'the delayed consequence should not be pure upside',
    ).toBe(true);
  });

  it('diverges in KIND across the options of a new topic, not just in magnitude', () => {
    for (const id of ['moss-count', 'bia-door']) {
      const kinds = TALKS_BY_ID[id].nodes.open.choices.map(
        (c) => new Set(c.effects.map((e) => e.type)),
      );
      // At least two options must touch a different SET of systems, which is what
      // stops "three buttons that all pay +5 nuts".
      const signatures = new Set(kinds.map((s) => [...s].sort().join(',')));
      expect(signatures.size, `${id} options are mechanically interchangeable`).toBeGreaterThan(1);
    }
  });
});
