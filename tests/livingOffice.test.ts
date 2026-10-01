import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import { GameEngine } from '../src/sim/engine';
import { employeeMood } from '../src/sim/mood';
import { decorationInstance } from '../src/sim/decorations';
import { gameStateSchema } from '../src/save/schema';
import { migrate } from '../src/save/migrations';
import { STICKER_FOR_MOOD, steadyMood } from '../src/art/EmotionSticker';
import { EMOTIONS } from '../src/sim/mood';

describe('front/back for placed pieces', () => {
  it('swaps a wall piece in front of the team, persists the choice and undoes it', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    expect(engine.buyDecoration('motivational-poster')).toBe(true);
    const instance = decorationInstance(engine.state, 'motivational-poster')!;
    expect(instance.layer).toBeUndefined(); // natural side: behind the team

    expect(engine.setDecorationLayer('motivational-poster', 'back')).toBe(false); // already there
    expect(engine.setDecorationLayer('motivational-poster', 'front')).toBe(true);
    expect(decorationInstance(engine.state, 'motivational-poster')!.layer).toBe('front');

    expect(engine.undoDecoration()).toBe(true);
    expect(decorationInstance(engine.state, 'motivational-poster')!.layer).toBeUndefined();
    expect(engine.redoDecoration()).toBe(true);
    expect(decorationInstance(engine.state, 'motivational-poster')!.layer).toBe('front');
  });

  it('never moves a rug off the floor or a stored piece', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    engine.buyDecoration('tiny-rug');
    expect(engine.setDecorationLayer('tiny-rug', 'front')).toBe(false);
    engine.buyDecoration('potted-fern');
    engine.removeDecoration('potted-fern');
    expect(engine.setDecorationLayer('potted-fern', 'back')).toBe(false);
  });

  it('round-trips through the save schema, and old saves load without it', () => {
    const engine = new GameEngine(createInitialState(0), { deterministic: true });
    engine.buyDecoration('potted-fern');
    engine.setDecorationLayer('potted-fern', 'back');
    const load = (raw: unknown) => gameStateSchema.parse(migrate(JSON.parse(JSON.stringify(raw))));
    const reloaded = load(engine.state);
    expect(reloaded.decorationInstances.find((i) => i.decorationId === 'potted-fern')?.layer).toBe(
      'back',
    );
    const old = JSON.parse(JSON.stringify(engine.state));
    for (const item of old.decorationInstances) delete item.layer;
    expect(load(old).decorationInstances.every((i) => i.layer === undefined)).toBe(true);
    // A corrupted value falls back to the natural side instead of failing the load.
    old.decorationInstances[0].layer = 'sideways';
    expect(load(old).decorationInstances[0].layer).toBeUndefined();
  });
});

describe('each teammate has their own mood', () => {
  it('gives roommates different faces in an ordinary company', () => {
    const s = createInitialState(0);
    s.resources.morale = 72;
    for (const id of ['pip', 'marlow', 'nino', 'junie']) {
      s.employees[id].hired = true;
      s.employees[id].level = 2;
      s.employees[id].friendship = 45;
      s.employees[id].room = 'founder-desk';
    }
    const moods = ['pip', 'marlow', 'nino', 'junie'].map((id) => employeeMood(s, id, 1_000));
    expect(new Set(moods).size).toBeGreaterThan(1);
  });

  it('smiles for a while after a conversation', () => {
    const s = createInitialState(0);
    s.resources.morale = 72;
    s.employees.marlow.hired = true;
    s.employees.marlow.friendship = 45;
    s.employees.marlow.talks = { count: 1, lastAt: 10_000, seen: {} };
    expect(employeeMood(s, 'marlow', 20_000)).toBe('happy');
    expect(employeeMood(s, 'marlow', 10_000 + 11 * 60_000)).not.toBe('happy');
  });

  it('maps every mood to a sticker, nine distinct ones in all', () => {
    for (const mood of EMOTIONS) expect(STICKER_FOR_MOOD[mood]).toBeTruthy();
    expect(new Set(Object.values(STICKER_FOR_MOOD)).size).toBe(9);
  });

  it('holds a sticker steady when a mood flickers at a threshold', () => {
    expect(steadyMood('test-a', 'relaxed', 0)).toBe('relaxed');
    // A one-tick wobble never shows.
    expect(steadyMood('test-a', 'tired', 7_000)).toBe('relaxed');
    expect(steadyMood('test-a', 'relaxed', 7_100)).toBe('relaxed');
    // A real change shows once it has lasted.
    expect(steadyMood('test-a', 'tired', 8_000)).toBe('relaxed');
    expect(steadyMood('test-a', 'tired', 11_000)).toBe('tired');
    // An event's emotion shows at once.
    expect(steadyMood('test-a', 'angry', 11_100, true)).toBe('angry');
  });
});
