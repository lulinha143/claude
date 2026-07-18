import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';

function engineAt(t: { v: number }) {
  return new GameEngine(createInitialState(t.v), { now: () => t.v, deterministic: true, seed: 3 });
}

describe('event consequences + history', () => {
  it('records a consequence and a history entry on resolution', () => {
    const t = { v: 1000 };
    const engine = engineAt(t);
    engine.triggerEvent('casual-friday');
    engine.resolveEventChoice('ok');
    expect(engine.lastConsequence).toBeTruthy();
    expect(engine.lastConsequence?.titleKey).toBe('event.casualFriday.title');
    expect(engine.lastConsequence?.choiceLabelKey).toBe('common.ok');
    expect(engine.lastConsequence?.effects.some((e) => e.type === 'morale')).toBe(true);
    expect(engine.state.eventHistory).toHaveLength(1);
    expect(engine.state.eventHistory[0]).toMatchObject({ eventId: 'casual-friday', choiceId: 'ok' });
  });

  it('clears the consequence panel on dismiss', () => {
    const t = { v: 0 };
    const engine = engineAt(t);
    engine.triggerEvent('casual-friday');
    engine.resolveEventChoice('ok');
    engine.clearConsequence();
    expect(engine.lastConsequence).toBeNull();
  });

  it('mid-chain steps do not show a result panel, but the terminal step does', () => {
    const t = { v: 0 };
    const engine = engineAt(t);
    engine.triggerEvent('printer-demands');
    engine.resolveEventChoice('negotiate'); // -> step "peace"
    expect(engine.lastConsequence).toBeNull();
    expect(engine.activeEvent?.step).toBe('peace');
    engine.resolveEventChoice('ok');
    expect(engine.lastConsequence).toBeTruthy();
    // both decisions recorded in the timeline
    expect(engine.state.eventHistory).toHaveLength(2);
  });

  it('rejects delayed duplicate input after a chained event advances', () => {
    const t = { v: 0 };
    const engine = engineAt(t);
    expect(engine.triggerEvent('printer-demands')).toBe(true);
    const active = engine.activeEvent!;
    const context = { eventInstanceId: active.instanceId, step: active.step };

    expect(engine.resolveEventChoice('negotiate', context)).toBe(true);
    expect(engine.activeEvent?.step).toBe('peace');
    // "ok" exists in the new step, so only the stale root-step context keeps
    // this delayed activation from incorrectly resolving it.
    expect(engine.resolveEventChoice('ok', context)).toBe(false);
    expect(engine.activeEvent?.step).toBe('peace');
    expect(engine.state.eventHistory).toHaveLength(1);
  });

  it('does not overwrite an open event or accept input from an older instance', () => {
    const t = { v: 0 };
    const engine = engineAt(t);
    expect(engine.triggerEvent('casual-friday')).toBe(true);
    expect(engine.triggerEvent('printer-demands')).toBe(false);
    const first = engine.activeEvent!;
    const staleContext = { eventInstanceId: first.instanceId, step: first.step };

    expect(engine.resolveEventChoice('ok', staleContext)).toBe(true);
    expect(engine.state.eventHistory).toHaveLength(1);
    expect(engine.triggerEvent('casual-friday')).toBe(true);
    const current = engine.activeEvent!;
    const moraleBeforeStaleInput = engine.state.resources.morale;

    // The same event, step, and choice are active again. Instance identity is
    // therefore the only thing preventing a delayed old click from applying.
    expect(engine.resolveEventChoice('ok', staleContext)).toBe(false);
    expect(engine.state.resources.morale).toBe(moraleBeforeStaleInput);
    expect(engine.state.eventHistory).toHaveLength(1);
    expect(engine.activeEvent?.instanceId).toBe(current.instanceId);

    expect(
      engine.resolveEventChoice('ok', {
        eventInstanceId: current.instanceId,
        step: current.step,
      }),
    ).toBe(true);
    expect(engine.state.eventHistory).toHaveLength(2);
  });

  it('the expanded fire event exposes four strategic choices with reactions', () => {
    const t = { v: 0 };
    const engine = engineAt(t);
    engine.triggerEvent('technically-on-fire');
    const choices = engine.activeEvent?.def.choices ?? [];
    expect(choices).toHaveLength(4);
    // the "contain" choice is gated on Bea and carries a disabled explanation
    const contain = choices.find((c) => c.id === 'contain');
    expect(contain?.requires?.hiredEmployee).toBe('bea');
    expect(contain?.disabledKey).toBeTruthy();
    // choices carry team reactions
    expect(choices.some((c) => (c.reactions?.length ?? 0) > 0)).toBe(true);
    engine.resolveEventChoice('livestream');
    expect(engine.lastConsequence?.reactions.length).toBeGreaterThan(0);
  });
});
