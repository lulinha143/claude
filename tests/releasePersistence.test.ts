import { describe, expect, it } from 'vitest';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import { performPrestige } from '../src/sim/prestige';
import { gameStateSchema } from '../src/save/schema';
import { migrate } from '../src/save/migrations';
import { EMPLOYEES } from '../src/content/employees';
import { KEEPSAKE_TALKS } from '../src/content/employeeKeepsakes';
import en from '../src/i18n/locales/en.json';
import pt from '../src/i18n/locales/pt-BR.json';
import type { GameState } from '../src/sim/types';
import { MICRO_CALIBRATION } from '../src/sim/minigames';

const start = 1_000_000;
const COFFEE_MASTERY = MICRO_CALIBRATION.coffeeRescue.mastery;
const roundtrip = (state: GameState) =>
  gameStateSchema.parse(migrate(JSON.parse(JSON.stringify(state)))) as GameState;
function engineAt(state = createInitialState(start), now = start) {
  state.settings.autoResolveEvents = false;
  return new GameEngine(state, { deterministic: true, now: () => now });
}
function translated(object: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (value, part) => (value as Record<string, unknown> | undefined)?.[part],
      object,
    );
}

describe('release progression survives a closed window', () => {
  it('resumes the exact event step without applying its first choice twice', () => {
    const engine = engineAt();
    engine.state.resources.nuts = 500;
    engine.triggerEvent('building-replies');
    expect(engine.resolveEventChoice('read')).toBe(true);
    const saved = roundtrip(engine.state);
    const reloaded = engineAt(saved, start + 1000);
    expect(reloaded.activeEvent?.step).toBe('request');
    expect(reloaded.resolveEventChoice('read')).toBe(false);
    expect(reloaded.resolveEventChoice('quiet')).toBe(true);
    expect(reloaded.state.resources.nuts).toBe(380);
    expect(reloaded.state.eventInProgress).toBeNull();
    expect(engineAt(roundtrip(reloaded.state)).activeEvent).toBeNull();
  });

  it('expires boosts by wall clock after reload and discards invalid event references', () => {
    const engine = engineAt();
    engine.rewardMicrogame('coffeeRescue', 25);
    const state = roundtrip(engine.state);
    expect(state.boosts).toHaveLength(1);
    state.eventInProgress = { eventId: 'removed-event', step: null };
    const reloaded = engineAt(state, start + 100_000);
    reloaded.tick(0.1);
    expect(reloaded.state.boosts).toHaveLength(0);
    expect(reloaded.state.eventInProgress).toBeNull();
  });

  it('does not pay for an empty round, duplicate completion, or repeated mastery', () => {
    const engine = engineAt();
    expect(engine.rewardMicrogame('coffeeRescue', 0)?.nuts).toBe(0);
    const second = engineAt(roundtrip(engine.state), start + 31_000);
    const gold = second.state.resources.goldenNuts;
    expect(second.rewardMicrogame('coffeeRescue', COFFEE_MASTERY)?.mastered).toBe(true);
    const paid = second.state.resources.nuts;
    const reloaded = engineAt(roundtrip(second.state), start + 32_000);
    expect(reloaded.rewardMicrogame('coffeeRescue', COFFEE_MASTERY)).toBeUndefined();
    expect(reloaded.state.resources.nuts).toBe(paid);
    const later = engineAt(roundtrip(reloaded.state), start + 70_000);
    expect(later.rewardMicrogame('coffeeRescue', COFFEE_MASTERY + 5)?.mastered).toBe(false);
    expect(later.state.resources.goldenNuts).toBe(gold + 1);
    expect(later.state.microgames.coffeeRescue).toMatchObject({
      best: COFFEE_MASTERY + 5,
      plays: 3,
    });
  });

  it('preserves personal decisions and records through prestige without aliasing them', () => {
    const engine = engineAt();
    engine.state.employees.pip.friendship = 40;
    engine.state.resources.nuts = 500;
    engine.openTalk('pip', 'keepsake-pip');
    engine.chooseTalkOption('care');
    engine.rewardMicrogame('bugSquash', 35);
    engine.state.stats.totalNutsEarned = 1_000_000;
    const next = performPrestige(engine.state, 'cooperative', start + 60_000);
    expect(next.flags['favorite.pip.cared']).toBe(start);
    expect(next.employees.pip.talks?.seen['keepsake-pip']).toBeTruthy();
    expect(next.microgames.bugSquash.best).toBe(35);
    next.microgames.bugSquash.best = 99;
    expect(engine.state.microgames.bugSquash.best).toBe(35);
  });

  it('cannot spam coffee after reloading, but allows another cup after cooldown', () => {
    const engine = engineAt();
    expect(engine.giveCoffee('pip')).toBe(true);
    expect(engine.giveCoffee('marlow')).toBe(false);
    const reloaded = engineAt(roundtrip(engine.state), start + 1000);
    expect(reloaded.giveCoffee('pip')).toBe(false);
    expect(reloaded.coffeeCooldownRemaining('pip')).toBe(119);
    expect(engineAt(roundtrip(engine.state), start + 120_000).giveCoffee('pip')).toBe(true);
  });
});

describe('every employee has an authored, reachable personal object', () => {
  for (const employee of EMPLOYEES) {
    it(employee.id, () => {
      const topic = KEEPSAKE_TALKS.find((entry) => entry.employeeId === employee.id)!;
      expect(topic).toBeDefined();
      for (const locale of [en, pt]) {
        for (const key of [
          employee.favoriteItemKey,
          topic.titleKey,
          topic.blurbKey,
          ...Object.values(topic.nodes).flatMap((node) => [
            node.promptKey,
            ...node.choices.flatMap((choice) => [choice.labelKey, choice.replyKey]),
          ]),
        ]) {
          expect(translated(locale, key), key).toBeTruthy();
        }
      }
      for (const choice of ['care', 'other']) {
        const engine = engineAt();
        engine.state.resources.nuts = 500;
        engine.state.employees[employee.id].hired = true;
        engine.state.employees[employee.id].friendship = 40;
        expect(engine.openTalk(employee.id, topic.id)).toBe(true);
        expect(engine.chooseTalkOption(choice)).toBe(true);
        expect(engine.state.resources.nuts).toBeGreaterThanOrEqual(0);
        expect(
          engine.state.flags[
            `favorite.${employee.id}.${choice === 'care' ? 'cared' : 'discussed'}`
          ],
        ).toBe(start);
      }
    });
  }
});
