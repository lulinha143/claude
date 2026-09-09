import { describe, it, expect } from 'vitest';
import { GameEngine } from '../src/sim/engine';
import { createInitialState } from '../src/sim/state';
import { chooseVoice } from '../src/sim/employeeVoice';
import { DIALOGUE_COUNTS } from '../src/content/dialogue';
import { EMPLOYEES } from '../src/content/employees';
import { ROOMS_BY_ID } from '../src/content/rooms';
import { roomAffinity } from '../src/sim/affinity';
import type { GameState } from '../src/sim/types';
import en from '../src/i18n/locales/en.json';
import ptBR from '../src/i18n/locales/pt-BR.json';

function fresh(mutate?: (s: GameState) => void) {
  const state = createInitialState(0);
  mutate?.(state);
  return new GameEngine(state, { deterministic: true });
}

function openTheBuilding(state: GameState) {
  state.resources.reputation = 100_000;
  for (const room of Object.values(ROOMS_BY_ID)) {
    if (room.unlock.upgradeId) state.upgrades[room.unlock.upgradeId] = 1;
  }
}

/** Put an employee in a room and make sure they are actually hired. */
function place(state: GameState, id: string, room: string) {
  const rt = state.employees[id];
  rt.hired = true;
  if (rt.level < 1) rt.level = 1;
  rt.room = room;
}

const CONTEXTUAL = ['highMorale', 'roomPride', 'roomGrumble'] as const;

describe('contextual dialogue content', () => {
  it('registers a line count for every contextual category', () => {
    for (const category of CONTEXTUAL) {
      expect(DIALOGUE_COUNTS[category], category).toBeGreaterThan(0);
    }
  });

  it('has exactly the registered number of lines in both complete locales', () => {
    for (const [name, bundle] of [
      ['en', en],
      ['pt-BR', ptBR],
    ] as const) {
      const dialogue = (bundle as { dialogue: Record<string, string[]> }).dialogue;
      for (const category of CONTEXTUAL) {
        expect(dialogue[category], `${name}.${category} missing`).toBeDefined();
        expect(dialogue[category].length, `${name}.${category} count`).toBe(
          DIALOGUE_COUNTS[category],
        );
      }
    }
  });

  it('writes distinct, non-empty lines', () => {
    const dialogue = (en as { dialogue: Record<string, string[]> }).dialogue;
    for (const category of CONTEXTUAL) {
      const lines = dialogue[category];
      expect(new Set(lines).size, `${category} has duplicates`).toBe(lines.length);
      for (const line of lines) expect(line.trim().length).toBeGreaterThan(8);
    }
  });
});

describe('a teammate comments on what is actually happening', () => {
  it('talks about morale first when the company is struggling', () => {
    const engine = fresh((s) => {
      openTheBuilding(s);
      s.resources.morale = 15;
      place(s, 'bea', 'construction'); // her favourite room
    });
    // Company mood outranks personal circumstance, even a good assignment.
    expect(chooseVoice(engine.state, 'bea')).toEqual({
      category: 'lowMorale',
      reason: 'lowMorale',
    });
  });

  it('notices when the company is doing unusually well', () => {
    const engine = fresh((s) => {
      s.resources.morale = 95;
      place(s, 'pip', 'founder-desk');
    });
    expect(chooseVoice(engine.state, 'pip').reason).toBe('highMorale');
  });

  it('complains about a department that clashes with their work', () => {
    const engine = fresh((s) => {
      openTheBuilding(s);
      s.resources.morale = 60;
      // Bea is a construction beaver; the lab is on her dislike list.
      place(s, 'bea', 'lab');
    });
    expect(roomAffinity('bea', 'lab')).toBe('disliked');
    expect(chooseVoice(engine.state, 'bea').reason).toBe('roomGrumble');
  });

  it('is proud of their own department', () => {
    const engine = fresh((s) => {
      openTheBuilding(s);
      s.resources.morale = 60;
      place(s, 'bea', 'construction');
    });
    expect(roomAffinity('bea', 'construction')).toBe('favorite');
    expect(chooseVoice(engine.state, 'bea').reason).toBe('roomPride');
  });

  it('falls back to their own voice in an ordinary situation', () => {
    const engine = fresh((s) => {
      openTheBuilding(s);
      s.resources.morale = 60;
      // Marlow in the meeting room: neither favourite nor disliked.
      place(s, 'marlow', 'meeting');
    });
    expect(roomAffinity('marlow', 'meeting')).toBe('acceptable');
    const voice = chooseVoice(engine.state, 'marlow');
    expect(voice.reason).toBe('personal');
    expect(voice.category).toBe('marlow');
  });

  it('never returns a category with no authored lines, for anyone, anywhere', () => {
    const engine = fresh(openTheBuilding);
    for (const def of EMPLOYEES) {
      place(engine.state, def.id, def.room);
      for (const room of Object.keys(ROOMS_BY_ID)) {
        engine.state.employees[def.id].room = room;
        for (const morale of [0, 20, 40, 60, 80, 100]) {
          engine.state.resources.morale = morale;
          const voice = chooseVoice(engine.state, def.id);
          expect(
            DIALOGUE_COUNTS[voice.category] ?? 0,
            `${def.id} in ${room} at morale ${morale} -> ${voice.category}`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it('degrades safely for an unknown employee', () => {
    const engine = fresh();
    engine.state.resources.morale = 60;
    expect(chooseVoice(engine.state, 'not-an-animal').category).toBe('idle');
  });

  it('changes what the same teammate says when their assignment changes', () => {
    const engine = fresh((s) => {
      openTheBuilding(s);
      s.resources.morale = 60;
      place(s, 'bea', 'construction');
    });
    const happy = chooseVoice(engine.state, 'bea').reason;
    engine.state.employees.bea.room = 'lab';
    const unhappy = chooseVoice(engine.state, 'bea').reason;
    // The click is informative: moving someone changes what they tell you.
    expect(happy).not.toBe(unhappy);
  });
});
