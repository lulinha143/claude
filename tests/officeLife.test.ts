import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import { GameEngine } from '../src/sim/engine';
import { createRng } from '../src/sim/rng';
import { pickOfficeInteraction } from '../src/sim/officeLife';

describe('office life interactions', () => {
  it('returns null when no decorations are placed near anyone', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    const res = pickOfficeInteraction(engine.state, new Set(), createRng(1));
    expect(res).toBeNull();
  });

  it('pairs a founder with a decoration placed near their slot', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    // Pip is at founder-desk (centre). Place a decoration on the central anchor.
    engine.buyDecoration('potted-fern');
    engine.moveDecoration('potted-fern', 0.5, 0.06); // floor prop at Pip's centre slot
    const res = pickOfficeInteraction(engine.state, new Set(), createRng(3));
    expect(res).not.toBeNull();
    expect(res!.employeeId).toBe('pip');
    expect(res!.decorationId).toBe('potted-fern');
    expect(res!.targetX).toBeGreaterThan(0);
  });

  it('never picks a decoration that is already reserved', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    engine.buyDecoration('potted-fern');
    const reserved = new Set<string>(['potted-fern']);
    const res = pickOfficeInteraction(engine.state, reserved, createRng(3));
    // only one decoration exists and it's reserved → nothing available
    expect(res).toBeNull();
  });

  it('is deterministic for a given seed and state', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    engine.buyDecoration('potted-fern');
    engine.moveDecoration('potted-fern', 0.5, 0.06);
    const a = pickOfficeInteraction(engine.state, new Set(), createRng(7));
    const b = pickOfficeInteraction(engine.state, new Set(), createRng(7));
    expect(a).toEqual(b);
  });
});
