import { describe, expect, it } from 'vitest';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import { evaluateTalkNode, pickTopic } from '../src/sim/talks';
import { gameStateSchema } from '../src/save/schema';
import { migrate } from '../src/save/migrations';
import type { GameState } from '../src/sim/types';
import type { TalkChoice } from '../src/content/employeeTalks';

function setup() {
  let now = 1_000_000;
  const state = createInitialState(now);
  state.resources.morale = 80;
  state.resources.nuts = 10_000;
  state.resources.goldenNuts = 5;
  state.employees.pip.friendship = 10;
  const engine = new GameEngine(state, { deterministic: true, now: () => now });
  return {
    engine,
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('conversation integrity', () => {
  it('keeps every locked option locked and provides a separate free exit', () => {
    const { engine, now } = setup();
    const choices: TalkChoice[] = [
      {
        id: 'buy',
        labelKey: 'buy',
        replyKey: 'bought',
        requires: { nuts: 50_000 },
        effects: [{ type: 'friendship', value: 30 }],
      },
      {
        id: 'secret',
        labelKey: 'secret',
        replyKey: 'revealed',
        requires: { flag: 'not-earned' },
        effects: [{ type: 'goldenNuts', value: 50 }],
      },
    ];
    const results = evaluateTalkNode(engine.state, 'pip', choices, now());
    expect(results.filter((r) => choices.includes(r.choice)).every((r) => !r.enabled)).toBe(true);
    const exit = results.find((r) => r.enabled)!;
    expect(exit.choice.effects).toEqual([]);
    expect(exit.choice.requires).toBeUndefined();
    engine.openTalk('pip');
    engine.activeTalk!.topic = {
      ...engine.activeTalk!.topic,
      nodes: { open: { id: 'open', promptKey: 'prompt', choices } },
    };
    engine.activeTalk!.nodeId = 'open';
    const before = { ...engine.state.resources };
    expect(engine.chooseTalkOption('buy')).toBe(false);
    expect(engine.chooseTalkOption('secret')).toBe(false);
    expect(engine.chooseTalkOption(exit.choice.id)).toBe(true);
    expect(engine.state.resources).toEqual(before);
    expect(engine.activeTalk!.nodeId).toBe('');
  });

  it('lets lower-priority recurring topics appear after check-in', () => {
    const { engine, now, advance } = setup();
    expect(pickTopic(engine.state, 'pip', now())?.id).toBe('check-in');
    engine.openTalk('pip');
    engine.chooseTalkOption('praise');
    engine.closeTalk();
    advance(121_000);
    expect(pickTopic(engine.state, 'pip', now())?.id).toBe('gift');
  });

  it("rejects selecting another employee's or a locked topic", () => {
    const { engine } = setup();
    expect(engine.openTalk('pip', 'rizzo-inventory')).toBe(false);
    expect(engine.openTalk('pip', 'pip-doubt')).toBe(false);
    expect(engine.openTalk('pip', 'gift')).toBe(true);
  });

  it('delivers a delayed promise to its original employee after save and reload', () => {
    const { engine, now, advance } = setup();
    engine.state.employees.marlow.hired = true;
    engine.state.employees.marlow.friendship = 40;
    engine.openTalk('marlow', 'check-in');
    engine.chooseTalkOption('listen');
    engine.chooseTalkOption('promise');
    const trust = engine.state.employees.marlow.friendship;
    const pipTrust = engine.state.employees.pip.friendship;
    const saved = gameStateSchema.parse(
      migrate(JSON.parse(JSON.stringify(engine.state))),
    ) as GameState;
    expect(saved.scheduled[0].effects.find((e) => e.type === 'friendship')?.employeeId).toBe(
      'marlow',
    );
    advance(601_000);
    const reloaded = new GameEngine(saved, { deterministic: true, now });
    reloaded.tick(0.1);
    expect(reloaded.state.employees.marlow.friendship).toBe(trust - 9);
    expect(reloaded.state.employees.pip.friendship).toBe(pipTrust);
    expect(reloaded.state.scheduled).toHaveLength(0);
    reloaded.tick(0.1);
    expect(reloaded.state.employees.marlow.friendship).toBe(trust - 9);
  });

  it('preserves explicit recipients inside nested scheduled effects', () => {
    const { engine } = setup();
    engine.applyEffect(
      {
        type: 'schedule',
        scheduled: [
          {
            type: 'schedule',
            scheduled: [
              { type: 'friendship', value: 3 },
              { type: 'emotion', employeeId: 'marlow', emotion: 'happy' },
            ],
          },
        ],
      },
      {
        id: 'test',
        titleKey: 'test',
        bodyKey: 'test',
        employeeId: 'pip',
        choices: [],
        rarity: 'common',
        weight: 0,
        cooldownSeconds: 0,
      },
    );
    const nested = engine.state.scheduled[0].effects[0].scheduled!;
    expect(nested[0].employeeId).toBe('pip');
    expect(nested[1].employeeId).toBe('marlow');
  });

  it('clamps trust before saving after a negative relationship consequence', () => {
    const { engine } = setup();
    engine.applyEffect({ type: 'friendship', employeeId: 'pip', value: -99 });
    expect(engine.state.employees.pip.friendship).toBe(0);
  });
});

describe('bounded temporary rewards', () => {
  it('ten thousand pets refresh one encouragement and cannot inflate production', () => {
    const { engine } = setup();
    const before = engine.currentBoostMultiplier();
    for (let i = 0; i < 10_000; i++) engine.petPip();
    expect(engine.tempBoosts).toHaveLength(1);
    expect(engine.currentBoostMultiplier()).toBeCloseTo(before + 0.05);
  });

  it('combines distinct rewards additively within a cap and expires them', () => {
    const { engine, advance } = setup();
    engine.addBoost(1.2, 10);
    engine.addBoost(1.5, 10);
    expect(engine.currentBoostMultiplier()).toBeCloseTo(1.7);
    engine.addBoost(10, 10);
    expect(engine.currentBoostMultiplier()).toBe(3);
    advance(11_000);
    expect(engine.currentBoostMultiplier()).toBe(1);
  });
});
