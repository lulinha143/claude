import { describe, expect, it } from 'vitest';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import { DECORATIONS, DECORATIONS_BY_ID } from '../src/content/decorations';
import { decorationRoom, isDecorationOwned } from '../src/sim/decorations';
import { isRoomIdUnlocked } from '../src/sim/rooms';
import type { GameState } from '../src/sim/types';

/**
 * Chapter 8: the catalogue's purchase is one step in the engine. Every check
 * that can refuse runs before anything is charged; a purchase charges the price
 * once, owns the piece once, puts it on its home room's surface (or in storage)
 * and saves; a refusal changes nothing and says why.
 */

function engineWith(mutate: (s: GameState) => void = () => undefined) {
  const s = createInitialState(0);
  s.onboardingComplete = true;
  s.resources.nuts = 1_000;
  s.resources.goldenNuts = 3;
  mutate(s);
  return new GameEngine(s, { deterministic: true, now: () => 0 });
}

const snapshot = (e: GameEngine) =>
  JSON.stringify({
    resources: e.state.resources,
    secrets: e.state.collections.secrets,
    instances: e.state.decorationInstances,
    placements: e.state.placements,
  });

describe('buying a decoration from the catalogue', () => {
  it('charges the price once, owns it once, puts it in its room and saves', () => {
    const e = engineWith();
    let saves = 0;
    e.onSave(() => (saves += 1));
    const morale = e.state.resources.morale;
    const result = e.purchaseDecoration('motivational-poster');
    expect(result).toEqual({ ok: true, roomId: 'founder-desk' });
    expect(e.state.resources.nuts).toBe(1_000 - 300);
    expect(
      e.state.collections.secrets.filter((k) => k === 'deco:motivational-poster'),
    ).toHaveLength(1);
    expect(decorationRoom(e.state, 'motivational-poster')).toBe('founder-desk');
    expect(
      e.state.decorationInstances.find((i) => i.decorationId === 'motivational-poster'),
    ).toMatchObject({ roomId: 'founder-desk', surfaceType: 'wall' });
    // Its morale comes once, with the purchase.
    expect(e.state.resources.morale).toBeGreaterThan(morale);
    expect(saves).toBeGreaterThanOrEqual(1);
  });

  it('refuses a second purchase of the same piece without charging again', () => {
    const e = engineWith();
    expect(e.purchaseDecoration('potted-fern').ok).toBe(true);
    const after = snapshot(e);
    expect(e.purchaseDecoration('potted-fern')).toEqual({ ok: false, reason: 'owned' });
    expect(snapshot(e)).toBe(after);
  });

  it('says what is missing when short, and changes nothing', () => {
    const e = engineWith((s) => (s.resources.nuts = 250));
    const before = snapshot(e);
    expect(e.purchaseDecoration('motivational-poster')).toEqual({
      ok: false,
      reason: 'short',
      missing: 50,
    });
    expect(snapshot(e)).toBe(before);
    expect(isDecorationOwned(e.state, 'motivational-poster')).toBe(false);
  });

  it('charges a golden price in golden nuts', () => {
    const e = engineWith();
    const window = DECORATIONS_BY_ID['window-view'];
    expect(window.cost.resource).toBe('goldenNuts');
    expect(e.purchaseDecoration('window-view').ok).toBe(true);
    expect(e.state.resources.goldenNuts).toBe(3 - window.cost.amount);
    expect(e.state.resources.nuts).toBe(1_000);
  });

  it('refuses a piece whose room is not open yet, and changes nothing', () => {
    const e = engineWith((s) => (s.resources.nuts = 1_000_000));
    const closed = DECORATIONS.find(
      (d) => d.cost.resource === 'nuts' && !isRoomIdUnlocked(e.state, d.room),
    )!;
    const before = snapshot(e);
    expect(e.purchaseDecoration(closed.id)).toEqual({ ok: false, reason: 'locked' });
    expect(snapshot(e)).toBe(before);
  });

  it('refuses an unknown piece and never files it as owned', () => {
    const e = engineWith();
    const before = snapshot(e);
    expect(e.purchaseDecoration('not-a-piece')).toEqual({ ok: false, reason: 'unknown' });
    // The free hand-over (set-up, rewards) refuses it too.
    expect(e.buyDecoration('not-a-piece')).toBe(false);
    expect(snapshot(e)).toBe(before);
    expect(e.state.collections.secrets).not.toContain('deco:not-a-piece');
  });

  it('keeps a bought piece through a save and a reload, owned once', () => {
    const e = engineWith();
    e.purchaseDecoration('tiny-rug');
    const reloaded = new GameEngine(JSON.parse(JSON.stringify(e.state)) as GameState, {
      deterministic: true,
      now: () => 0,
    });
    expect(isDecorationOwned(reloaded.state, 'tiny-rug')).toBe(true);
    expect(reloaded.state.collections.secrets.filter((k) => k === 'deco:tiny-rug')).toHaveLength(1);
    expect(decorationRoom(reloaded.state, 'tiny-rug')).toBe('founder-desk');
  });
});
