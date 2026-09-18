import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import { gameStateSchema } from '../src/save/schema';
import { migrate } from '../src/save/migrations';
import { SAVE_VERSION } from '../src/sim/config';
import { GAME_EVENTS, GAME_EVENTS_BY_ID } from '../src/content/events';
import { ROOMS_BY_ID } from '../src/content/rooms';
import { scoreChoice } from '../src/sim/eventAutoResolve';
import { EMPLOYEE_TALKS } from '../src/content/employeeTalks';
import { MICRO_TEAM, type MicroMode } from '../src/sim/minigames';
import type { GameState } from '../src/sim/types';

function engineAt(now: number, mutate?: (s: GameState) => void) {
  const state = createInitialState(0);
  mutate?.(state);
  let clock = now;
  const engine = new GameEngine(state, { deterministic: true, now: () => clock });
  return {
    engine,
    advance(ms: number) {
      clock += ms;
    },
    set(ms: number) {
      clock = ms;
    },
  };
}

/** Unlock every room so room-gated events can be reached. */
function openTheBuilding(state: GameState) {
  state.resources.reputation = 100_000;
  for (const room of Object.values(ROOMS_BY_ID)) {
    if (room.unlock.upgradeId) state.upgrades[room.unlock.upgradeId] = 1;
  }
}

describe('consequence memory (flags)', () => {
  it('starts with a clean history', () => {
    expect(createInitialState(0).flags).toEqual({});
    expect(createInitialState(0).scheduled).toEqual([]);
  });

  it('records a mark with the time it happened', () => {
    const { engine } = engineAt(5_000);
    engine.applyEffect({ type: 'setFlag', flagId: 'test-mark' });
    expect(engine.state.flags['test-mark']).toBe(5_000);
  });

  it('does not overwrite the original timestamp of an existing mark', () => {
    const h = engineAt(1_000);
    h.engine.applyEffect({ type: 'setFlag', flagId: 'once' });
    h.advance(50_000);
    h.engine.applyEffect({ type: 'setFlag', flagId: 'once' });
    expect(h.engine.state.flags.once).toBe(1_000);
  });

  it('can clear a mark to close a thread', () => {
    const { engine } = engineAt(0);
    engine.applyEffect({ type: 'setFlag', flagId: 'debt' });
    engine.applyEffect({ type: 'clearFlag', flagId: 'debt' });
    expect('debt' in engine.state.flags).toBe(false);
  });

  it('survives a save/load round trip', () => {
    const state = createInitialState(0);
    state.flags['kept'] = 1234;
    const parsed = gameStateSchema.parse(JSON.parse(JSON.stringify(state)));
    expect(parsed.flags.kept).toBe(1234);
  });

  it('is backfilled for a save written before it existed', () => {
    const old = JSON.parse(JSON.stringify(createInitialState(0))) as Record<string, unknown>;
    old.version = 9;
    delete old.flags;
    delete old.scheduled;
    const parsed = gameStateSchema.parse(migrate(old));
    expect(parsed.version).toBe(SAVE_VERSION);
    expect(parsed.flags).toEqual({});
    expect(parsed.scheduled).toEqual([]);
  });
});

describe('memory gates which content exists', () => {
  it('hides a callback event until its mark has been earned', () => {
    const { engine } = engineAt(0, openTheBuilding);
    expect(engine.eligibleEventIds()).not.toContain('accountant-remembers');
    engine.applyEffect({ type: 'setFlag', flagId: 'accountant-favour' });
    expect(engine.eligibleEventIds()).toContain('accountant-remembers');
  });

  it('retires an event once its mark exists (missingFlag)', () => {
    const { engine } = engineAt(0, openTheBuilding);
    expect(engine.eligibleEventIds()).toContain('ledger-discrepancy');
    engine.applyEffect({ type: 'setFlag', flagId: 'accountant-favour' });
    expect(engine.eligibleEventIds()).not.toContain('ledger-discrepancy');
  });

  it('only offers a room event once that room exists', () => {
    const locked = engineAt(0).engine;
    expect(locked.eligibleEventIds()).not.toContain('basement-requisition');
    const open = engineAt(0, openTheBuilding).engine;
    expect(open.eligibleEventIds()).toContain('basement-requisition');
  });

  it('only offers a morale crisis when morale is genuinely low', () => {
    const { engine } = engineAt(0, openTheBuilding);
    engine.state.resources.morale = 80;
    expect(engine.eligibleEventIds()).not.toContain('morale-petition');
    engine.state.resources.morale = 20;
    expect(engine.eligibleEventIds()).toContain('morale-petition');
  });

  it('only rewards a genuinely happy company', () => {
    const { engine } = engineAt(0, openTheBuilding);
    engine.state.resources.morale = 50;
    expect(engine.eligibleEventIds()).not.toContain('unusually-good-week');
    engine.state.resources.morale = 95;
    expect(engine.eligibleEventIds()).toContain('unusually-good-week');
  });
});

describe('delayed consequences', () => {
  it('queues a promise instead of applying it immediately', () => {
    const { engine } = engineAt(10_000);
    const before = engine.state.resources.reputation;
    engine.state.resources.reputation = 100;
    engine.applyEffect({
      type: 'schedule',
      delaySeconds: 60,
      scheduled: [{ type: 'reputation', value: -30 }],
    });
    expect(engine.state.scheduled).toHaveLength(1);
    // Nothing has been charged yet.
    expect(engine.state.resources.reputation).toBe(100);
    expect(before).toBe(0);
  });

  it('applies the promise once its moment arrives', () => {
    const h = engineAt(0);
    h.engine.state.resources.reputation = 100;
    h.engine.applyEffect({
      type: 'schedule',
      delaySeconds: 60,
      scheduled: [{ type: 'reputation', value: -30 }],
    });

    h.advance(30_000);
    h.engine.tick(1);
    expect(h.engine.state.resources.reputation).toBeCloseTo(100, 0);

    h.advance(40_000);
    h.engine.tick(1);
    expect(h.engine.state.resources.reputation).toBeLessThan(75);
    expect(h.engine.state.scheduled).toHaveLength(0);
  });

  it('reports what it settled so the swing is never unexplained', () => {
    const h = engineAt(0);
    h.engine.applyEffect({
      type: 'schedule',
      delaySeconds: 10,
      scheduleTitleKey: 'event.moralePetition.laterTitle',
      scheduleBodyKey: 'event.moralePetition.laterBody',
      scheduled: [{ type: 'morale', value: -5 }],
    });
    h.advance(11_000);
    h.engine.tick(1);
    expect(h.engine.settledConsequences).toHaveLength(1);
    expect(h.engine.settledConsequences[0].titleKey).toBe('event.moralePetition.laterTitle');
  });

  it('settles a promise whose moment passed while the player was away', () => {
    const h = engineAt(0);
    h.engine.state.resources.morale = 80;
    h.engine.applyEffect({
      type: 'schedule',
      delaySeconds: 60,
      scheduled: [{ type: 'morale', value: -20 }],
    });
    // Simulate a long absence, then one tick on return.
    h.advance(3_600_000);
    h.engine.tick(1);
    expect(h.engine.state.resources.morale).toBeLessThan(80);
    expect(h.engine.state.scheduled).toHaveLength(0);
  });

  it('clamps a delayed effect the same way an immediate one is clamped', () => {
    const h = engineAt(0);
    h.engine.state.resources.reputation = 5;
    h.engine.applyEffect({
      type: 'schedule',
      delaySeconds: 1,
      scheduled: [{ type: 'reputation', value: -9999 }],
    });
    h.advance(2_000);
    h.engine.tick(1);
    // Reputation floors at zero rather than going negative.
    expect(h.engine.state.resources.reputation).toBe(0);
  });

  it('keeps the promise queue bounded', () => {
    const { engine } = engineAt(0);
    for (let i = 0; i < 60; i += 1) {
      engine.applyEffect({
        type: 'schedule',
        delaySeconds: 9_999,
        scheduled: [{ type: 'nuts', value: -1 }],
      });
    }
    expect(engine.state.scheduled.length).toBeLessThanOrEqual(24);
  });

  it('survives a save/load round trip with its effects intact', () => {
    const { engine } = engineAt(0);
    engine.applyEffect({
      type: 'schedule',
      delaySeconds: 600,
      scheduled: [{ type: 'reputation', value: -12 }],
    });
    const parsed = gameStateSchema.parse(JSON.parse(JSON.stringify(engine.state)));
    expect(parsed.scheduled).toHaveLength(1);
    expect(parsed.scheduled[0].effects[0]).toMatchObject({ type: 'reputation', value: -12 });
  });

  it('drops a malformed promise rather than rejecting the whole save', () => {
    const state = JSON.parse(JSON.stringify(createInitialState(0)));
    state.scheduled = [{ nonsense: true }, null, 7];
    const parsed = gameStateSchema.parse(state);
    expect(parsed.scheduled).toEqual([]);
    // The rest of the save is untouched.
    expect(parsed.resources.morale).toBeGreaterThan(0);
  });
});

describe('auto-resolution accounts for deferred costs', () => {
  it('scores a delayed penalty against the choice that promised it', () => {
    const honest = scoreChoice({ id: 'a', labelKey: 'a', effects: [{ type: 'nuts', value: 900 }] });
    const deferred = scoreChoice({
      id: 'b',
      labelKey: 'b',
      effects: [
        { type: 'nuts', value: 900 },
        {
          type: 'schedule',
          delaySeconds: 900,
          scheduled: [
            { type: 'reputation', value: -14 },
            { type: 'morale', value: -8 },
          ],
        },
      ],
    });
    // Same money up front, but the promise makes it a worse deal.
    expect(deferred).toBeLessThan(honest);
  });

  it('still prefers a deferred cost to the identical immediate one', () => {
    const now = scoreChoice({
      id: 'now',
      labelKey: 'now',
      effects: [{ type: 'reputation', value: -10 }],
    });
    const later = scoreChoice({
      id: 'later',
      labelKey: 'later',
      effects: [
        { type: 'schedule', delaySeconds: 600, scheduled: [{ type: 'reputation', value: -10 }] },
      ],
    });
    expect(later).toBeGreaterThan(now);
  });

  it('treats bookkeeping marks as worth nothing on their own', () => {
    expect(
      scoreChoice({ id: 'f', labelKey: 'f', effects: [{ type: 'setFlag', flagId: 'x' }] }),
    ).toBe(0);
  });
});

describe('the authored memory content is coherent', () => {
  it('only references marks that some choice can actually set', () => {
    const settable = new Set<string>();
    for (const topic of EMPLOYEE_TALKS) {
      for (const node of Object.values(topic.nodes)) {
        for (const choice of node.choices) {
          for (const effect of choice.effects) {
            if (effect.type === 'setFlag' && effect.flagId) settable.add(effect.flagId);
          }
        }
      }
    }
    // Runtime awards must really create the keys that authored events consume.
    const { engine } = engineAt(1_000_000);
    for (const mode of Object.keys(MICRO_TEAM) as MicroMode[]) engine.rewardMicrogame(mode, 35);
    for (const flag of Object.keys(engine.state.flags)) settable.add(flag);
    for (const ev of GAME_EVENTS) {
      const all = [...ev.choices, ...Object.values(ev.steps ?? {}).flatMap((s) => s.choices)];
      for (const c of all) {
        for (const e of c.effects) if (e.type === 'setFlag' && e.flagId) settable.add(e.flagId);
      }
    }
    for (const ev of GAME_EVENTS) {
      if (ev.requires?.flag) {
        expect(settable, `${ev.id} requires unsettable flag ${ev.requires.flag}`).toContain(
          ev.requires.flag,
        );
      }
      if (ev.requires?.missingFlag) {
        expect(settable).toContain(ev.requires.missingFlag);
      }
      // Individual CHOICES can be gated on a mark too, now that requires.flag is
      // actually evaluated. A choice gated on a mark nothing can set would be dead
      // content that silently never appears — the quieter twin of the bug where it
      // was never evaluated and so always appeared.
      const everyChoice = [
        ...ev.choices,
        ...Object.values(ev.steps ?? {}).flatMap((s) => s.choices),
      ];
      for (const choice of everyChoice) {
        if (!choice.requires?.flag) continue;
        expect(
          settable,
          `${ev.id}/${choice.id} requires unsettable flag ${choice.requires.flag}`,
        ).toContain(choice.requires.flag);
        // A locked choice must be able to say why, or the player just sees a dead button.
        expect(choice.disabledKey, `${ev.id}/${choice.id} has no disabledKey`).toBeTruthy();
      }
    }
  });

  it('only gates on real rooms', () => {
    for (const ev of GAME_EVENTS) {
      if (ev.requires?.room) expect(ROOMS_BY_ID[ev.requires.room]).toBeDefined();
    }
  });

  it('gives every scheduled promise its own callback copy', () => {
    for (const ev of GAME_EVENTS) {
      const all = [...ev.choices, ...Object.values(ev.steps ?? {}).flatMap((s) => s.choices)];
      for (const c of all) {
        for (const e of c.effects) {
          if (e.type !== 'schedule') continue;
          expect(e.scheduled?.length, `${ev.id}/${c.id} schedules nothing`).toBeGreaterThan(0);
          // Without its own copy the callback would reuse the original event's
          // text, which reads as the same event happening twice.
          expect(e.scheduleTitleKey, `${ev.id}/${c.id} has no callback title`).toBeTruthy();
          expect(e.scheduleBodyKey, `${ev.id}/${c.id} has no callback body`).toBeTruthy();
        }
      }
    }
  });

  it('runs the whole ledger chain end to end and leaves the intended mark', () => {
    const { engine } = engineAt(0, openTheBuilding);
    engine.state.resources.nuts = 50_000;
    engine.triggerEvent('ledger-discrepancy');
    // Step into the accountant conversation, then pay the favour.
    expect(engine.resolveEventChoice('quiet')).toBe(true);
    expect(engine.activeEvent).not.toBeNull();
    expect(engine.resolveEventChoice('pay')).toBe(true);
    expect(engine.activeEvent).toBeNull();
    expect('accountant-favour' in engine.state.flags).toBe(true);
    // And the callback is now reachable.
    expect(engine.eligibleEventIds()).toContain('accountant-remembers');
  });

  it('makes the greedy branch of the ledger chain bill the company later', () => {
    const h = engineAt(0, openTheBuilding);
    h.engine.state.resources.reputation = 200;
    h.engine.triggerEvent('ledger-discrepancy');
    h.engine.resolveEventChoice('quiet');
    h.engine.resolveEventChoice('refuse');
    // Paid immediately in nuts, with a reputation bill outstanding.
    expect(h.engine.state.scheduled).toHaveLength(1);
    const before = h.engine.state.resources.reputation;
    h.advance(1_000_000);
    h.engine.tick(1);
    expect(h.engine.state.resources.reputation).toBeLessThan(before);
  });

  it('exposes the new events through the normalized catalogue', () => {
    for (const id of [
      'ledger-discrepancy',
      'accountant-remembers',
      'morale-petition',
      'unusually-good-week',
      'basement-requisition',
    ]) {
      expect(GAME_EVENTS_BY_ID[id], id).toBeDefined();
    }
  });
});
