import { describe, expect, it } from 'vitest';

import en from '../src/i18n/locales/en.json';
import pt from '../src/i18n/locales/pt-BR.json';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import { migrate } from '../src/save/migrations';
import { gameStateSchema } from '../src/save/schema';
import { performPrestige } from '../src/sim/prestige';
import { createRng } from '../src/sim/rng';
import { ROOMS } from '../src/content/rooms';
import { EMPLOYEES } from '../src/content/employees';
import { GAME_EVENTS, GAME_EVENTS_BY_ID } from '../src/content/events';
import { INCIDENT_EVENTS } from '../src/content/incidents';
import {
  ANOMALY_THREAD_FLAG,
  EVENT_MEMORIES,
  HAPPENINGS,
  HOOKS,
  WORLD_MOMENTS,
  WORLD_MOMENTS_BY_ID,
} from '../src/content/happenings';
import { ODDITIES, ODDITIES_BY_ID, fileOddities, roomFileFlag } from '../src/content/roomPlay';
import {
  eligibleMoments,
  eventCast,
  eventPlace,
  happenedSince,
  memoriesFor,
  pickIncident,
  rarityOdds,
  remarksDue,
} from '../src/sim/happenings';
import {
  activeModeEffects,
  curiosityProgress,
  curiosityTotals,
  isNight,
  oddityAvailable,
} from '../src/sim/roomPlay';
import { employeesInRoom } from '../src/sim/rooms';
import { eventChoicesForState } from '../src/sim/eventChoices';
import type { EventRarity, GameState } from '../src/sim/types';

/**
 * Gameplay chapter 4: events happen in the office.
 *
 * A roll never opens a popup. Something starts happening in a room and waits
 * there (an incident), or a small moment plays out; rarity is chosen first so
 * rare things are rare but reachable; a choice changes things now, later, and
 * in what people remember; curiosities lead to one another and to secrets.
 * These drive all of it through the engine the way the office does.
 */

const T0 = Date.UTC(2026, 8, 30, 12, 0, 0);
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

/** A company with every room open and nobody on the payroll but the founder. */
function office(mutate?: (s: GameState) => void, seed = 1) {
  let clock = T0;
  const state = createInitialState(T0);
  state.resources.reputation = 5_000;
  state.resources.nuts = 5_000_000;
  state.resources.goldenNuts = 50;
  state.resources.morale = 60;
  for (const room of ROOMS) if (room.unlock.upgradeId) state.upgrades[room.unlock.upgradeId] = 1;
  state.stats.playTimeSeconds = 10_000;
  mutate?.(state);
  const engine = new GameEngine(state, { deterministic: true, seed, now: () => clock });
  return {
    engine,
    get state() {
      return engine.state;
    },
    now: () => clock,
    /** Time passes without the office rolling for anything new. */
    wait(seconds: number) {
      clock += seconds * 1000;
      engine.tick(0.1);
    },
    /** Let the office run for a while, as the game loop would. */
    run(seconds: number) {
      clock += seconds * 1000;
      engine.tick(seconds);
    },
  };
}

/** Put `ids` to work in `roomId`. */
function staff(s: GameState, roomId: string, ids: string[], friendship = 30) {
  for (const id of ids) {
    s.employees[id] = { ...s.employees[id], hired: true, level: 3, friendship, room: roomId };
  }
}

/** The whole roster, spread over the building the way a mature company is. */
function everyone(s: GameState) {
  const rooms = ROOMS.map((room) => room.id);
  EMPLOYEES.forEach((employee, index) => {
    staff(s, employee.id === 'pip' ? 'founder-desk' : rooms[index % rooms.length], [employee.id]);
  });
}

/** Look into whatever is waiting for `eventId` and take `choices` in turn. */
function decide(w: ReturnType<typeof office>, eventId: string, ...choices: string[]) {
  const incident = w.engine.pendingIncidents().find((item) => item.eventId === eventId);
  if (incident) expect(w.engine.openIncident(incident.id)).toBe(true);
  else expect(w.engine.triggerEvent(eventId)).toBe(true);
  for (const choice of choices) expect(w.engine.resolveEventChoice(choice)).toBe(true);
  return w.engine.lastConsequence;
}

describe('rarity decides what happens', () => {
  it('picks a rarity first, so rare events are rare but always within reach', () => {
    const odds = rarityOdds(0, 0);
    expect(odds).toEqual(HAPPENINGS.tierOdds);
    const rng = createRng(11);
    const counts: Record<EventRarity, number> = { common: 0, uncommon: 0, rare: 0, legendary: 0 };
    const rolls = 20_000;
    for (let i = 0; i < rolls; i += 1) {
      const def = pickIncident(GAME_EVENTS, odds, () => rng.next());
      counts[def!.rarity] += 1;
    }
    const total = Object.values(HAPPENINGS.tierOdds).reduce((sum, value) => sum + value, 0);
    for (const tier of Object.keys(counts) as EventRarity[]) {
      expect(counts[tier] / rolls).toBeCloseTo(HAPPENINGS.tierOdds[tier] / total, 1);
    }
    // The old pure-weight pick made a quarter of all events rare.
    expect((counts.rare + counts.legendary) / rolls).toBeLessThan(0.18);
    expect(counts.legendary).toBeGreaterThan(0);
  });

  it('uses the events’ own weights within a rarity, and never picks a follow-up', () => {
    const pool = INCIDENT_EVENTS.filter((def) => def.rarity === 'uncommon');
    const rng = createRng(5);
    const seen = new Map<string, number>();
    for (let i = 0; i < 6000; i += 1) {
      const def = pickIncident(pool, rarityOdds(0, 0), () => rng.next())!;
      seen.set(def.id, (seen.get(def.id) ?? 0) + 1);
    }
    // A follow-up (weight 0) only ever arrives as a consequence.
    expect(seen.has('minutes-disputed')).toBe(false);
    // Weight 8 turns up more often than weight 6.
    expect(seen.get('scarf-off-schedule')!).toBeGreaterThan(seen.get('vault-sleeper')!);
    // Nothing eligible in a tier: that tier is skipped, not stalled on.
    const commons = GAME_EVENTS.filter((def) => def.rarity === 'common');
    expect(pickIncident(commons, rarityOdds(0, 50), () => 0.99)?.rarity).toBe('common');
    expect(pickIncident([], rarityOdds(0, 0), () => 0.5)).toBeNull();
  });

  it('makes a rare event likelier after a dry spell, and luckier companies luckier', () => {
    // A few ordinary incidents in a row is just the office; a long run is a drought.
    expect(rarityOdds(0, HAPPENINGS.droughtAfter)).toEqual(HAPPENINGS.tierOdds);
    const dry = rarityOdds(0, HAPPENINGS.droughtAfter + 4);
    expect(dry.rare).toBeCloseTo(HAPPENINGS.tierOdds.rare * (1 + 4 * HAPPENINGS.droughtStep));
    expect(dry.common).toBe(HAPPENINGS.tierOdds.common);
    expect(rarityOdds(0.1, 0).rare).toBeCloseTo(
      HAPPENINGS.tierOdds.rare * (1 + 0.1 * HAPPENINGS.luckScale),
    );
    // The engine counts the drought: ordinary incidents grow it, a rare one ends it.
    const w = office((s) => {
      staff(s, 'meeting', ['hazel', 'nino']);
      staff(s, 'research', ['moss']);
      staff(s, 'lab', ['echo']);
    });
    w.state.happenings.sinceRare = HAPPENINGS.droughtAfter;
    w.engine.queueIncident('the-minutes');
    expect(w.state.happenings.sinceRare).toBe(HAPPENINGS.droughtAfter + 1);
    expect(w.engine.rarityOdds().rare).toBeGreaterThan(rarityOdds(0, 0).rare);
    w.engine.queueIncident('night-shift-report');
    expect(w.state.happenings.sinceRare).toBe(0);
  });

  it('over a long stretch of play, turns up rare things now and then, never mostly', () => {
    const w = office(everyone);
    let rare = 0;
    let total = 0;
    let sinceRare = 0;
    let longestDrySpell = 0;
    for (let i = 0; i < 600; i += 1) {
      w.engine.maybeRollEvent(true);
      expect(w.engine.activeEvent).toBeNull();
      for (const incident of w.engine.pendingIncidents()) {
        const rarity = GAME_EVENTS_BY_ID[incident.eventId].rarity;
        total += 1;
        sinceRare += 1;
        if (rarity === 'rare' || rarity === 'legendary') {
          rare += 1;
          sinceRare = 0;
        }
        longestDrySpell = Math.max(longestDrySpell, sinceRare);
      }
      w.state.happenings.incidents = [];
    }
    expect(total).toBeGreaterThan(250);
    expect(rare / total).toBeGreaterThan(0.08);
    expect(rare / total).toBeLessThan(0.28);
    // A run of ordinary days always ends.
    expect(longestDrySpell).toBeLessThan(25);
  });
});

describe('things wait in the office instead of interrupting', () => {
  it('never opens a card on its own: it starts happening in a room and waits there', () => {
    const w = office(everyone);
    for (let i = 0; i < 60; i += 1) {
      w.engine.maybeRollEvent(true);
      expect(w.engine.activeEvent).toBeNull();
      const incidents = w.engine.pendingIncidents();
      // A couple at most, never two in the same room.
      expect(incidents.length).toBeLessThanOrEqual(HAPPENINGS.maxIncidents);
      expect(new Set(incidents.map((item) => item.roomId)).size).toBe(incidents.length);
    }
    expect(w.engine.pendingIncidents().length).toBe(HAPPENINGS.maxIncidents);
    // The office says where, once: whoever noticed it points it out.
    const news = w.engine.drainOfficeNews().filter((item) => item.kind === 'incident');
    expect(news.length).toBeGreaterThanOrEqual(HAPPENINGS.maxIncidents);
    expect(news.every((item) => typeof item.hookKey === 'string')).toBe(true);
  });

  it('gives a new founder a few quiet minutes first', () => {
    const w = office((s) => {
      everyone(s);
      s.stats.playTimeSeconds = 0;
    });
    for (let i = 0; i < HAPPENINGS.firstAfterSeconds - 10; i += 1) w.run(1);
    expect(w.engine.pendingIncidents()).toEqual([]);
    expect(w.state.happenings.diary).toEqual([]);
  });

  it('holds everything while a conversation or a card is open', () => {
    const w = office(everyone);
    expect(w.engine.openTalk('pip')).toBe(true);
    for (let i = 0; i < 20; i += 1) w.engine.maybeRollEvent(true);
    expect(w.state.happenings.diary).toEqual([]);
    w.engine.closeTalk();
    expect(w.engine.triggerEvent('the-minutes')).toBe(true);
    for (let i = 0; i < 20; i += 1) w.engine.maybeRollEvent(true);
    expect(w.state.happenings.diary).toEqual([]);
    // ...and a waiting incident cannot be opened over another card.
    w.state.happenings.incidents.push({
      id: 'x',
      eventId: 'bug-bounty',
      roomId: 'lab',
      at: w.now(),
      until: w.now() + 60_000,
    });
    expect(w.engine.openIncident('x')).toBe(false);
  });

  it('opens a waiting incident where it is happening, with whoever noticed it', () => {
    const w = office((s) => staff(s, 'meeting', ['hazel', 'nino']));
    expect(w.engine.queueIncident('the-minutes')).toBe(true);
    // Not twice.
    expect(w.engine.queueIncident('the-minutes')).toBe(false);
    const [incident] = w.engine.pendingIncidents();
    expect(incident).toMatchObject({
      eventId: 'the-minutes',
      roomId: 'meeting',
      employeeId: 'hazel',
    });
    expect(w.engine.eligibleEventIds()).not.toContain('the-minutes');
    expect(w.engine.openIncident(incident.id)).toBe(true);
    expect(w.engine.activeEvent?.def.id).toBe('the-minutes');
    expect(w.engine.activeEvent?.place).toEqual({ roomId: 'meeting', employeeId: 'hazel' });
    expect(w.engine.pendingIncidents()).toEqual([]);
    expect(w.state.happenings.diary.map((entry) => entry.kind)).toEqual(['incident', 'opened']);
  });

  it('lets the team handle an ordinary one that waited too long; a rare one simply passes', () => {
    const w = office((s) => {
      staff(s, 'lab', ['axel']);
      staff(s, 'research', ['moss']);
      staff(s, 'broadcast', ['echo']);
    });
    w.engine.queueIncident('centrifuge-wont-stop');
    w.engine.queueIncident('night-shift-report');
    w.wait(HAPPENINGS.lingerSeconds.common + 1);
    // Handled: decided by the department, recorded and reported like any auto-resolve.
    expect(w.engine.pendingIncidents().map((item) => item.eventId)).toEqual(['night-shift-report']);
    expect(w.state.eventHistory.map((entry) => entry.eventId)).toContain('centrifuge-wont-stop');
    expect(w.engine.lastAutoResolved?.titleKey).toBe(
      GAME_EVENTS_BY_ID['centrifuge-wont-stop'].titleKey,
    );
    w.wait(HAPPENINGS.lingerSeconds.rare);
    // Passed: nothing decided, and it will not come straight back.
    expect(w.engine.pendingIncidents()).toEqual([]);
    expect(w.state.eventHistory.map((entry) => entry.eventId)).not.toContain('night-shift-report');
    expect(w.state.eventCooldowns['night-shift-report']).toBeGreaterThan(w.now());
    const told = ['incident', 'handled', 'faded'];
    expect(
      w.state.happenings.diary.map((entry) => entry.kind).filter((kind) => told.includes(kind)),
    ).toEqual(['incident', 'incident', 'handled', 'faded']);
  });

  it('decides on the spot, as before, for a player who asked not to be asked', () => {
    const w = office((s) => {
      staff(s, 'lab', ['quincy']);
      staff(s, 'procurement', ['nixie']);
      s.settings.autoResolveEvents = true;
    });
    expect(w.engine.queueIncident('bug-bounty')).toBe(true);
    expect(w.engine.pendingIncidents()).toEqual([]);
    expect(w.engine.activeEvent).toBeNull();
    expect(w.state.eventHistory.map((entry) => entry.eventId)).toContain('bug-bounty');
    expect(w.engine.lastAutoResolved).not.toBeNull();
    // Nothing piles up while away either.
    expect(w.engine.catchUpHappenings(8 * 3600)).toBe(0);
  });

  it('keeps small moments small: a line or two, a little good, and no card', () => {
    const w = office((s) => {
      staff(s, 'founder-desk', ['marlow']);
      staff(s, 'meeting', ['nino']);
    });
    const now = w.now();
    const ids = eligibleMoments(w.state, now).map((def) => def.id);
    expect(ids).toContain('breathing-exercise'); // Marlow and Pip share the desk
    expect(ids).toContain('nap-on-the-agenda');
    expect(ids).not.toContain('lunch-bet'); // only ever the payoff of a bet
    expect(ids.includes('fridge-at-night')).toBe(false); // Echo is not on the payroll
    const morale = w.state.resources.morale;
    w.engine.playMoment(WORLD_MOMENTS_BY_ID['breathing-exercise']);
    expect(w.engine.activeEvent).toBeNull();
    expect(w.state.resources.morale).toBeGreaterThan(morale);
    expect(eligibleMoments(w.state, now).map((def) => def.id)).not.toContain('breathing-exercise');
    const news = w.engine.drainOfficeNews().find((item) => item.kind === 'moment');
    expect(news).toMatchObject({ roomId: 'founder-desk', momentId: 'breathing-exercise' });
    // Apart, they do not do the breathing exercise together.
    const apart = office((s) => staff(s, 'meeting', ['marlow']));
    expect(eligibleMoments(apart.state, now).map((def) => def.id)).not.toContain(
      'breathing-exercise',
    );
  });

  it('only lets the night shift happen at night', () => {
    const w = office((s) => staff(s, 'broadcast', ['echo']));
    const noon = new Date(T0);
    noon.setHours(12, 0, 0, 0);
    const late = new Date(T0);
    late.setHours(3, 0, 0, 0);
    const has = (at: number) =>
      eligibleMoments(w.state, at).some((d) => d.id === 'fridge-at-night');
    expect(isNight(late.getTime())).toBe(true);
    expect(has(noon.getTime())).toBe(false);
    expect(has(late.getTime())).toBe(true);
  });
});

describe('the people and places it happens to', () => {
  it('happens wherever the teammate it is about works, and they present it', () => {
    const w = office((s) => {
      staff(s, 'lab', ['quincy']);
      staff(s, 'procurement', ['nixie']);
    });
    expect(eventPlace(w.state, GAME_EVENTS_BY_ID['bug-bounty'])).toEqual({
      roomId: 'lab',
      employeeId: 'quincy',
    });
    w.state.employees.quincy.room = 'research';
    expect(eventPlace(w.state, GAME_EVENTS_BY_ID['bug-bounty']).roomId).toBe('research');
    // The card shows everyone it is about who is on the payroll.
    expect(eventCast(w.state, GAME_EVENTS_BY_ID['bug-bounty'])).toEqual(['quincy', 'nixie']);
  });

  it('needs its whole cast, its room, its people in the room, and its history', () => {
    const w = office((s) => staff(s, 'lab', ['quincy']));
    expect(w.engine.eligibleEventIds()).not.toContain('bug-bounty'); // no Nixie
    w.state.employees.nixie = { ...w.state.employees.nixie, hired: true, room: 'lab' };
    expect(w.engine.eligibleEventIds()).toContain('bug-bounty');
    // A lab that is staffed has a centrifuge to worry about; an empty one does not.
    expect(w.engine.eligibleEventIds()).toContain('centrifuge-wont-stop');
    const empty = office();
    expect(empty.engine.eligibleEventIds()).not.toContain('centrifuge-wont-stop');
    // Enough deliveries and one comes for the building.
    expect(w.engine.eligibleEventIds()).not.toContain('parcel-for-the-tree');
    w.state.office.rooms.mailroom = { done: 3 };
    expect(w.engine.eligibleEventIds()).toContain('parcel-for-the-tree');
    // The soup only comes back for someone who noticed it in the first place.
    staff(w.state, 'cafeteria', ['marlow']);
    expect(w.engine.eligibleEventIds()).not.toContain('soup-week-two');
    w.state.flags['oddity.soup-week'] = T0;
    expect(w.engine.eligibleEventIds()).toContain('soup-week-two');
  });

  it('puts the ones not about anybody in the room they belong to, shown by someone there', () => {
    const w = office((s) => staff(s, 'vault', ['bia']));
    const place = eventPlace(w.state, GAME_EVENTS_BY_ID['nut-audit']);
    expect(place.roomId).toBe('vault');
    expect(employeesInRoom(w.state, 'vault')).toContain(place.employeeId);
    // A room nobody works in still has it happen; it is pinned up there.
    const bare = office();
    expect(eventPlace(bare.state, GAME_EVENTS_BY_ID['nut-audit'])).toEqual({ roomId: 'vault' });
  });

  it('gives every incident a hook to be pointed out with, by its rarity or its own', () => {
    for (const def of GAME_EVENTS) {
      const hook = def.hookKey ?? HOOKS[def.rarity][0];
      for (const locale of ['en', 'pt-BR']) expect(text(locale, hook), hook).toBeTruthy();
    }
  });
});

describe('a choice changes things now, later, and in what people remember', () => {
  it('reaches back into ordinary play straight away', () => {
    const w = office((s) => staff(s, 'marketing', ['corvus', 'rosa']));
    decide(w, 'the-rebrand', 'neon');
    // The marketing floor now runs the campaign the decision called for.
    expect(w.state.office.rooms.marketing.mode).toBe('buzz');
    expect(activeModeEffects(w.state).some(({ mode }) => mode.effect.kind === 'clickPower')).toBe(
      true,
    );
    expect(w.state.employees.rosa.emotion?.id).toBe('sad');
    // A decided rebrand does not come round again.
    expect(w.engine.eligibleEventIds()).not.toContain('the-rebrand');
  });

  it('turns up later, in the world, without a notice: a curiosity, a remark, a follow-up', () => {
    const w = office((s) => {
      staff(s, 'marketing', ['corvus', 'rosa']);
      staff(s, 'vault', ['bia', 'dorm']);
    });
    const both = decide(w, 'the-rebrand', 'both');
    // Something was set in motion; it is not said what.
    expect(both?.setInMotion).toBe(true);
    expect(w.state.collections.moments.length).toBe(1);
    w.engine.clearConsequence();
    const carry = decide(w, 'vault-sleeper', 'carry');
    expect(carry?.setInMotion).toBe(true);
    w.engine.clearConsequence();
    w.wait(301);
    // The neon pink sign is up on the marketing wall...
    expect(w.state.office.oddities.map((item) => item.id)).toContain('neon-pink-sign');
    // ...and Sonny has something to say about last night.
    expect(remarksDue(w.state, w.now())).toContainEqual(
      expect.objectContaining({ employeeId: 'dorm', key: 'incident.vaultSleeper.carryLater' }),
    );
    expect(w.engine.takeRemark('dorm')).toBe('incident.vaultSleeper.carryLater');
    expect(w.engine.takeRemark('dorm')).toBeNull();
    // None of it came as a notice.
    expect(w.engine.settledConsequences).toEqual([]);
  });

  it('brings the consequence of a forged signature back as an incident of its own', () => {
    const w = office((s) => staff(s, 'meeting', ['hazel', 'nino']));
    decide(w, 'the-minutes', 'sign');
    w.engine.clearConsequence();
    w.wait(400);
    expect(w.engine.pendingIncidents()).toEqual([]);
    w.wait(30);
    const [incident] = w.engine.pendingIncidents();
    expect(incident).toMatchObject({ eventId: 'minutes-disputed', roomId: 'meeting' });
    expect(incident.employeeId).toBe('nino');
    decide(w, 'minutes-disputed', 'strike');
    expect('minutes.clause3' in w.state.flags).toBe(true);
  });

  it('lets a follow-up wait its turn rather than pile on', () => {
    const w = office((s) => {
      staff(s, 'meeting', ['hazel', 'nino']);
      staff(s, 'lab', ['axel', 'quincy']);
      staff(s, 'procurement', ['nixie', 'rizzo', 'perry']);
    });
    decide(w, 'the-minutes', 'sign');
    w.engine.clearConsequence();
    w.engine.queueIncident('centrifuge-wont-stop');
    w.engine.queueIncident('bidding-war');
    w.wait(421);
    expect(w.engine.pendingIncidents().map((item) => item.eventId)).not.toContain(
      'minutes-disputed',
    );
    expect(w.state.scheduled.some((item) => item.effects[0]?.eventId === 'minutes-disputed')).toBe(
      true,
    );
    w.state.happenings.incidents = [];
    w.wait(HAPPENINGS.followUpRetrySeconds + 1);
    expect(w.engine.pendingIncidents().map((item) => item.eventId)).toEqual(['minutes-disputed']);
  });

  it('is remembered: the teammate brings it up a few minutes later, and now and then after', () => {
    const w = office((s) => staff(s, 'security', ['bia']));
    const result = decide(w, 'bia-guard', 'take-her-word');
    expect(result?.remembered).toBe('bia');
    w.engine.clearConsequence();
    expect(w.engine.takeRemark('bia')).toBeNull(); // not yet
    const [min, max] = HAPPENINGS.memoryDelay;
    const [remark] = w.state.happenings.remarks;
    expect(remark.at - w.now()).toBeGreaterThanOrEqual(min * 1000);
    expect(remark.at - w.now()).toBeLessThanOrEqual(max * 1000);
    w.wait(max + 1);
    expect(w.engine.takeRemark('bia')).toBe('memory.trustedBia');
    // ...and it stays part of what she says when the player pokes her.
    expect(memoriesFor(w.state, 'bia').map((memory) => memory.key)).toContain('trustedBia');
    // A choice nobody remembers says so too.
    const plain = office((s) => staff(s, 'meeting', ['hazel', 'nino']));
    expect(decide(plain, 'the-minutes', 'wake')?.remembered).toBeUndefined();
  });

  it('only remembers marks a choice can set, about people who exist, in both languages', () => {
    const settable = new Set<string>();
    for (const def of GAME_EVENTS) {
      for (const choice of [
        ...def.choices,
        ...Object.values(def.steps ?? {}).flatMap((step) => step.choices),
      ]) {
        for (const effect of choice.effects) {
          if (effect.type === 'setFlag' && effect.flagId) settable.add(effect.flagId);
        }
      }
    }
    const ids = new Set(EMPLOYEES.map((employee) => employee.id));
    for (const memory of EVENT_MEMORIES) {
      expect(settable, memory.flag).toContain(memory.flag);
      expect(ids, memory.employeeId).toContain(memory.employeeId);
      for (const locale of ['en', 'pt-BR']) {
        expect(text(locale, `memory.${memory.key}`), `${locale} memory.${memory.key}`).toBeTruthy();
      }
    }
  });

  it('files a Moment Card only for the genuinely memorable outcome', () => {
    const laminated = office((s) => staff(s, 'meeting', ['hazel', 'nino']));
    decide(laminated, 'the-minutes', 'laminate');
    expect(laminated.state.collections.moments.length).toBe(1);
    const woken = office((s) => staff(s, 'meeting', ['hazel', 'nino']));
    decide(woken, 'the-minutes', 'wake');
    expect(woken.state.collections.moments.length).toBe(0);
  });

  it('plays the bet out on its own, in the lab, a few minutes after it was made', () => {
    const w = office((s) => staff(s, 'lab', ['quincy', 'nixie']));
    decide(w, 'bug-bounty', 'contest');
    w.engine.clearConsequence();
    w.engine.drainOfficeNews();
    w.wait(481);
    expect(w.engine.drainOfficeNews()).toContainEqual(
      expect.objectContaining({ kind: 'moment', momentId: 'lunch-bet', roomId: 'lab' }),
    );
  });
});

describe('discoveries lead somewhere', () => {
  const now = T0;

  it('chains curiosities: one has to be noticed before the next can turn up', () => {
    const w = office();
    for (const [first, next] of [
      ['missing-stapler', 'stapler-return'],
      ['equation', 'hello-tremor'],
      ['item-four', 'future-minutes'],
    ]) {
      expect(ODDITIES_BY_ID[first].lead, first).toBe(true);
      expect(oddityAvailable(w.state, ODDITIES_BY_ID[next], now), next).toBe(false);
      w.state.flags[`oddity.${first}`] = now;
      expect(oddityAvailable(w.state, ODDITIES_BY_ID[next], now), next).toBe(true);
    }
  });

  it('notices the building noticing back, and opens the way to its legendary', () => {
    const w = office();
    const strange = ODDITIES.filter((def) => def.tone === 'paranormal' && !def.extra).slice(0, 3);
    expect(w.engine.eligibleEventIds()).not.toContain('thirteenth-button');
    strange.forEach((def, index) => {
      w.state.office.oddities = [{ id: def.id, roomId: def.roomId, at: w.now() }];
      const result = w.engine.noticeOddity(def.id)!;
      expect(Boolean(result.thread)).toBe(index === 2);
    });
    expect(ANOMALY_THREAD_FLAG in w.state.flags).toBe(true);
    expect(w.engine.eligibleEventIds()).toContain('thirteenth-button');
  });

  it('counts the aftermath of a choice as a bonus, so no choice can block a room file', () => {
    const w = office((s) => staff(s, 'meeting', ['hazel']));
    const extras = ODDITIES.filter((def) => def.extra);
    expect(extras.length).toBeGreaterThanOrEqual(8);
    expect(curiosityTotals(w.state).total).toBe(ODDITIES.length - extras.length);
    // Notice everything in the meeting room except the laminated minutes...
    for (const def of fileOddities('meeting')) {
      w.state.office.oddities = [{ id: def.id, roomId: def.roomId, at: w.now() }];
      w.engine.noticeOddity(def.id);
    }
    // ...and the file is complete without them.
    expect(roomFileFlag('meeting') in w.state.flags).toBe(true);
    expect(curiosityProgress(w.state, 'meeting')).toEqual({
      noticed: fileOddities('meeting').length,
      total: fileOddities('meeting').length,
    });
    // An aftermath only exists after its choice.
    expect(oddityAvailable(w.state, ODDITIES_BY_ID['laminated-minutes'], now)).toBe(false);
    w.state.flags['minutes.laminated'] = now;
    expect(oddityAvailable(w.state, ODDITIES_BY_ID['laminated-minutes'], now)).toBe(true);
  });

  it('turns up a secret for the player who keeps the night shift’s secret', () => {
    const w = office((s) => {
      staff(s, 'research', ['moss']);
      staff(s, 'broadcast', ['echo']);
    });
    decide(w, 'night-shift-report', 'secret');
    expect(w.state.collections.secrets).toContain('anomaly.hum');
    for (const secret of ['anomaly_hum', 'anomaly_floorZero', 'anomaly_thirteenth']) {
      for (const locale of ['en', 'pt-BR']) {
        expect(text(locale, `secretFile.${secret}.title`)).toBeTruthy();
        expect(text(locale, `secretFile.${secret}.body`)).toBeTruthy();
      }
    }
  });
});

describe('persistence', () => {
  it('keeps what is waiting, who has something to say, and the diary through a save', () => {
    const w = office((s) => {
      staff(s, 'meeting', ['hazel', 'nino']);
      staff(s, 'security', ['bia']);
      staff(s, 'marketing', ['corvus', 'rosa']);
    });
    decide(w, 'bia-guard', 'take-her-word');
    w.engine.clearConsequence();
    decide(w, 'the-rebrand', 'both');
    w.engine.clearConsequence();
    w.engine.queueIncident('the-minutes');
    const raw = JSON.parse(JSON.stringify(w.state));
    const loaded = gameStateSchema.parse(migrate(raw)) as GameState;
    expect(loaded.happenings).toEqual(w.state.happenings);
    // The quiet promises survive too, and still land after the reload.
    expect(loaded.scheduled).toEqual(w.state.scheduled);
    let clock = w.now();
    const again = new GameEngine(loaded, { deterministic: true, now: () => clock });
    clock += 301_000;
    again.tick(0.1);
    expect(again.state.office.oddities.map((item) => item.id)).toContain('neon-pink-sign');
    // And the incident can still be looked into.
    const incident = again.pendingIncidents().find((item) => item.eventId === 'the-minutes')!;
    expect(again.openIncident(incident.id)).toBe(true);
    expect(again.activeEvent?.def.id).toBe('the-minutes');
  });

  it('opens an old save with nothing happening, and drops a broken entry rather than the save', () => {
    const old = JSON.parse(JSON.stringify(createInitialState(T0))) as Record<string, unknown>;
    delete old.happenings;
    expect((gameStateSchema.parse(migrate(old)) as GameState).happenings).toEqual({
      incidents: [],
      remarks: [],
      diary: [],
      sinceRare: 0,
    });
    const messy = JSON.parse(JSON.stringify(createInitialState(T0))) as Record<string, unknown>;
    messy.happenings = {
      incidents: [
        { id: 'a', eventId: 'the-minutes' },
        { id: 'b', eventId: 'the-minutes', roomId: 'meeting', at: T0, until: T0 + 1 },
      ],
      remarks: [{ employeeId: 'bia', key: 'memory.trustedBia', at: 'later' }],
      diary: [
        { at: T0, kind: 'teleported' },
        { at: T0, kind: 'moment', momentId: 'leaf-count' },
      ],
      sinceRare: -4,
    };
    const parsed = (gameStateSchema.parse(migrate(messy)) as GameState).happenings;
    expect(parsed.incidents.map((item) => item.id)).toEqual(['b']);
    expect(parsed.remarks).toEqual([]);
    expect(parsed.diary).toEqual([{ at: T0, kind: 'moment', momentId: 'leaf-count' }]);
    expect(parsed.sinceRare).toBe(0);
    // An incident for an event this build does not know is let go, not opened.
    const w = office();
    w.state.happenings.incidents.push({
      id: 'z',
      eventId: 'not-an-event',
      roomId: 'lab',
      at: T0,
      until: T0 + 1e6,
    });
    expect(w.engine.openIncident('z')).toBe(false);
    expect(w.engine.pendingIncidents()).toEqual([]);
    // An engine on a state that never had happenings at all copes too.
    const bare = createInitialState(T0) as Partial<GameState>;
    delete bare.happenings;
    const engine = new GameEngine(bare as GameState, { deterministic: true, now: () => T0 });
    expect(engine.pendingIncidents()).toEqual([]);
  });

  it('gives a save that already noticed enough of the strange side its thread', () => {
    const state = createInitialState(T0);
    const strange = ODDITIES.filter((def) => def.tone === 'paranormal' && !def.extra).slice(0, 3);
    strange.forEach((def, index) => (state.flags[`oddity.${def.id}`] = T0 + index));
    const engine = new GameEngine(state, { deterministic: true, now: () => T0 + 10 });
    expect(engine.state.flags[ANOMALY_THREAD_FLAG]).toBe(T0 + 2);
    // Two are not enough.
    const fewer = createInitialState(T0);
    for (const def of strange.slice(0, 2)) fewer.flags[`oddity.${def.id}`] = T0;
    expect(ANOMALY_THREAD_FLAG in new GameEngine(fewer, { deterministic: true }).state.flags).toBe(
      false,
    );
  });

  it('starts a restructured company afresh, but the building remembers being noticed', () => {
    const w = office((s) => staff(s, 'meeting', ['hazel', 'nino']));
    w.engine.queueIncident('the-minutes');
    w.state.flags[ANOMALY_THREAD_FLAG] = T0;
    w.state.flags['oddity.memo'] = T0;
    w.state.stats.totalNutsEarned = 1e15;
    const after = performPrestige(w.state, 'cooperative', w.now() + 1000);
    expect(after.happenings).toEqual({ incidents: [], remarks: [], diary: [], sinceRare: 0 });
    expect(ANOMALY_THREAD_FLAG in after.flags).toBe(true);
    expect('oddity.memo' in after.flags).toBe(true);
  });

  it('has a few things waiting after time away, and keeps a diary to tell it from', () => {
    const w = office(everyone);
    const before = w.now();
    // Under a quarter of an hour: nothing.
    expect(w.engine.catchUpHappenings(HAPPENINGS.awaySecondsPerIncident - 1)).toBe(0);
    // A night away: at most what can wait at once, and nobody announces them.
    const started = w.engine.catchUpHappenings(10 * 3600);
    expect(started).toBe(HAPPENINGS.maxIncidents);
    expect(w.engine.drainOfficeNews().some((item) => item.kind === 'incident')).toBe(false);
    const since = happenedSince(w.state, before - 1);
    expect(since.started).toBe(started);
    expect(since.waiting).toBe(started);
    // The diary stays bounded however long the company runs.
    for (let i = 0; i < HAPPENINGS.diarySize + 10; i += 1) {
      w.engine.playMoment(WORLD_MOMENTS[i % 3]);
    }
    expect(w.state.happenings.diary.length).toBe(HAPPENINGS.diarySize);
  });
});

describe('words', () => {
  it('has every incident line, hook, moment and aftermath in both languages', () => {
    const keys: string[] = [];
    for (const def of INCIDENT_EVENTS) {
      keys.push(def.titleKey, def.bodyKey, def.hookKey!);
      for (const step of Object.values(def.steps ?? {})) keys.push(step.bodyKey);
      for (const choice of [
        ...def.choices,
        ...Object.values(def.steps ?? {}).flatMap((step) => step.choices),
      ]) {
        keys.push(choice.labelKey, ...(choice.reactions ?? []));
        if (choice.disabledKey) keys.push(choice.disabledKey);
        // What someone says later, because of this choice.
        for (const effect of choice.effects) {
          for (const later of effect.scheduled ?? []) if (later.lineKey) keys.push(later.lineKey);
        }
      }
    }
    for (const hooks of Object.values(HOOKS)) keys.push(...hooks);
    for (const moment of WORLD_MOMENTS) {
      keys.push(`scene.${moment.id}.title`);
      for (let line = 1; line <= moment.lines; line += 1)
        keys.push(`scene.${moment.id}.line${line}`);
    }
    for (const def of ODDITIES) {
      if (def.extra)
        keys.push(`oddity.${def.id}.title`, `oddity.${def.id}.hint`, `oddity.${def.id}.found`);
      if (def.lead) keys.push(`oddity.${def.id}.lead`);
    }
    keys.push('incident.look', 'incident.inMotion', 'incident.remembered', 'scene.heard');
    for (const tier of ['common', 'uncommon', 'rare', 'legendary'])
      keys.push(`incident.stamp.${tier}`);
    for (const key of keys) {
      const english = text('en', key);
      const portuguese = text('pt-BR', key);
      expect(typeof english, `en ${key}`).toBe('string');
      expect(typeof portuguese, `pt-BR ${key}`).toBe('string');
      // Written, not copied across.
      if ((english as string).length > 24) expect(portuguese, key).not.toBe(english);
    }
  });

  it('calls everyone by their Portuguese name in Portuguese', () => {
    const renamed = EMPLOYEES.map((employee) => ({
      english: text('en', employee.nameKey) as string,
      portuguese: text('pt-BR', employee.nameKey) as string,
    })).filter((names) => names.english !== names.portuguese);
    expect(renamed.length).toBeGreaterThan(5);
    const strings: Array<[string, string]> = [];
    const walk = (node: unknown, path: string) => {
      if (typeof node === 'string') strings.push([path, node]);
      else if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) walk(value, path ? `${path}.${key}` : key);
      }
    };
    walk(pt, '');
    for (const { english } of renamed) {
      const word = new RegExp(`\\b${english}\\b`);
      const found = strings.filter(([, value]) => word.test(value)).map(([path]) => path);
      expect(found, `"${english}" in pt-BR`).toEqual([]);
    }
  });

  it('says what each option on a new card needs when it cannot be taken', () => {
    const w = office((s) => {
      staff(s, 'procurement', ['rizzo', 'perry']);
    });
    decide(w, 'bidding-war');
    const choices = eventChoicesForState(w.state, GAME_EVENTS_BY_ID['bidding-war'], null).choices;
    const audit = choices.find((entry) => entry.choice.id === 'audit')!;
    expect(audit.enabled).toBe(false);
    expect(text('pt-BR', audit.choice.disabledKey!)).toBeTruthy();
  });
});
