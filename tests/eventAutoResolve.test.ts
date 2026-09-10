import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import { chooseAutoResolution, scoreChoice } from '../src/sim/eventAutoResolve';
import { GAME_EVENTS, GAME_EVENTS_BY_ID } from '../src/content/events';
import { defaultSettings } from '../src/sim/state';
import { gameStateSchema } from '../src/save/schema';
import { migrate } from '../src/save/migrations';

function engineWith(autoResolve: boolean) {
  const state = createInitialState(0);
  state.settings.autoResolveEvents = autoResolve;
  return new GameEngine(state, { deterministic: true });
}

describe('the choice-popup setting', () => {
  it('defaults to showing choice popups', () => {
    expect(defaultSettings().autoResolveEvents).toBe(false);
  });

  it('survives a save/load round trip', () => {
    const state = createInitialState(0);
    state.settings.autoResolveEvents = true;
    const parsed = gameStateSchema.parse(JSON.parse(JSON.stringify(state)));
    expect(parsed.settings.autoResolveEvents).toBe(true);
  });

  it('is filled in for an older save that predates it', () => {
    // A v7 save shaped like the real thing, but with a settings object from
    // before this option existed.
    const old = JSON.parse(JSON.stringify(createInitialState(0))) as Record<string, unknown>;
    old.version = 7;
    old.settings = { reducedMotion: true };
    const parsed = gameStateSchema.parse(migrate(old));
    // Missing => default, and the setting that WAS stored is preserved.
    expect(parsed.settings.autoResolveEvents).toBe(false);
    expect(parsed.settings.reducedMotion).toBe(true);
  });

  it('persists through the engine settings path', () => {
    const engine = engineWith(false);
    engine.updateSettings({ autoResolveEvents: true });
    expect(engine.state.settings.autoResolveEvents).toBe(true);
  });
});

describe('choice scoring', () => {
  it('prefers a reward over a penalty', () => {
    const good = scoreChoice({ id: 'g', labelKey: 'g', effects: [{ type: 'morale', value: 8 }] });
    const bad = scoreChoice({ id: 'b', labelKey: 'b', effects: [{ type: 'morale', value: -8 }] });
    expect(good).toBeGreaterThan(bad);
    expect(bad).toBeLessThan(0);
  });

  it('treats morale and reputation as worth more than a few nuts', () => {
    const nuts = scoreChoice({ id: 'n', labelKey: 'n', effects: [{ type: 'nuts', value: 50 }] });
    const rep = scoreChoice({
      id: 'r',
      labelKey: 'r',
      effects: [{ type: 'reputation', value: 5 }],
    });
    expect(rep).toBeGreaterThan(nuts);
  });

  it('values a longer, stronger production boost more', () => {
    const small = scoreChoice({
      id: 's',
      labelKey: 's',
      effects: [{ type: 'productionBoost', value: 1.2, durationSeconds: 30 }],
    });
    const big = scoreChoice({
      id: 'b',
      labelKey: 'b',
      effects: [{ type: 'productionBoost', value: 2, durationSeconds: 180 }],
    });
    expect(big).toBeGreaterThan(small);
  });

  it('scores a negative emotion below a positive one', () => {
    const happy = scoreChoice({
      id: 'h',
      labelKey: 'h',
      effects: [{ type: 'emotion', emotion: 'inspired' }],
    });
    const sad = scoreChoice({
      id: 's',
      labelKey: 's',
      effects: [{ type: 'emotion', emotion: 'frustrated' }],
    });
    expect(happy).toBeGreaterThan(sad);
  });

  it('sums a mixed bag of effects', () => {
    const mixed = scoreChoice({
      id: 'm',
      labelKey: 'm',
      effects: [
        { type: 'nuts', value: 200 },
        { type: 'morale', value: -4 },
      ],
    });
    expect(Number.isFinite(mixed)).toBe(true);
  });
});

describe('automatic resolution', () => {
  it('finds an enabled choice for every authored event', () => {
    const engine = engineWith(true);
    engine.state.resources.nuts = 1_000_000;
    engine.state.resources.goldenNuts = 500;
    engine.state.resources.reputation = 500;
    for (const def of GAME_EVENTS) {
      const picked = chooseAutoResolution(engine.state, def, null);
      expect(picked, `no auto choice for ${def.id}`).not.toBeNull();
    }
  });

  it('never picks a choice the player could not afford', () => {
    const engine = engineWith(true);
    // Broke company: any choice with a resource requirement must be skipped.
    engine.state.resources.nuts = 0;
    engine.state.resources.goldenNuts = 0;
    for (const def of GAME_EVENTS) {
      const picked = chooseAutoResolution(engine.state, def, null);
      if (!picked) continue;
      const requires = picked.choice.requires;
      if (requires?.nuts) expect(requires.nuts).toBeLessThanOrEqual(0);
      if (requires?.goldenNuts) expect(requires.goldenNuts).toBeLessThanOrEqual(0);
    }
  });

  it('picks the better of two options', () => {
    const engine = engineWith(true);
    // `nut-audit` offers reputation (comply) vs nuts + morale loss (hide).
    const def = GAME_EVENTS_BY_ID['nut-audit'];
    const picked = chooseAutoResolution(engine.state, def, null);
    expect(picked?.choice.id).toBe('comply');
  });
});

describe('engine behaviour with popups disabled', () => {
  it('shows a popup when the setting is off', () => {
    const engine = engineWith(false);
    expect(engine.triggerEvent('nut-audit')).toBe(true);
    expect(engine.activeEvent).not.toBeNull();
  });

  it('never leaves a popup open when the setting is on', () => {
    const engine = engineWith(true);
    engine.triggerEvent('nut-audit');
    expect(engine.activeEvent).toBeNull();
    // The interrupting result panel is suppressed too.
    expect(engine.lastConsequence).toBeNull();
  });

  it('still applies the real consequences', () => {
    const engine = engineWith(true);
    const before = engine.state.resources.reputation;
    engine.triggerEvent('nut-audit');
    // `comply` grants reputation; the effect must actually land.
    expect(engine.state.resources.reputation).toBeGreaterThan(before);
  });

  it('still records the decision in company history', () => {
    const engine = engineWith(true);
    engine.triggerEvent('nut-audit');
    expect(engine.state.eventHistory.at(-1)).toMatchObject({
      eventId: 'nut-audit',
      choiceId: 'comply',
    });
  });

  it('still counts the event and sets its cooldown', () => {
    const engine = engineWith(true);
    const seen = engine.state.stats.eventsSeen;
    engine.triggerEvent('nut-audit');
    expect(engine.state.stats.eventsSeen).toBe(seen + 1);
    expect(engine.state.eventCooldowns['nut-audit']).toBeGreaterThan(0);
  });

  it('reports what was decided so the player is told', () => {
    const engine = engineWith(true);
    engine.triggerEvent('nut-audit');
    expect(engine.lastAutoResolved).not.toBeNull();
    expect(engine.lastAutoResolved?.titleKey).toBe(GAME_EVENTS_BY_ID['nut-audit'].titleKey);
    expect(engine.lastAutoResolved?.choiceLabelKey).toBeTruthy();
  });

  it('runs a multi-step chain to completion without a popup', () => {
    const engine = engineWith(true);
    const chained = GAME_EVENTS.find((e) => e.steps && Object.keys(e.steps).length > 0);
    expect(chained, 'expected at least one chained event in content').toBeDefined();
    engine.triggerEvent(chained!.id);
    // No step of the chain may be left waiting for input.
    expect(engine.activeEvent).toBeNull();
  });

  it('keeps passive simulation running while popups are disabled', () => {
    const engine = engineWith(true);
    engine.state.employees.pip.hired = true;
    engine.state.employees.pip.level = 3;
    const before = engine.state.resources.nuts;
    engine.tick(5);
    expect(engine.state.resources.nuts).toBeGreaterThan(before);
  });

  it('handles every authored event without stranding a popup', () => {
    for (const def of GAME_EVENTS) {
      const engine = engineWith(true);
      engine.state.resources.nuts = 1_000_000;
      engine.state.resources.goldenNuts = 500;
      engine.state.resources.reputation = 500;
      engine.triggerEvent(def.id);
      expect(engine.activeEvent, `${def.id} left a popup open`).toBeNull();
    }
  });

  it('can be turned back on mid-game and popups return', () => {
    const engine = engineWith(true);
    engine.triggerEvent('nut-audit');
    expect(engine.activeEvent).toBeNull();

    engine.updateSettings({ autoResolveEvents: false });
    engine.state.eventCooldowns = {};
    engine.triggerEvent('printer-demands');
    expect(engine.activeEvent).not.toBeNull();
  });
});
