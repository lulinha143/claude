import { describe, it, expect } from 'vitest';
import { gameStateSchema } from '../src/save/schema';
import { createInitialState } from '../src/sim/state';

// Window/desktop settings live in the persisted GameState.settings and in the
// Electron-side window-settings.json. Here we verify the game settings survive
// a serialize/parse round trip via the Zod schema (which fills defaults).
describe('settings serialization', () => {
  it('round-trips settings through the schema', () => {
    const s = createInitialState(0);
    s.settings.language = 'pt-BR';
    s.settings.fpsLimit = 30;
    s.settings.quietMode = true;
    const json = JSON.parse(JSON.stringify(s));
    const parsed = gameStateSchema.safeParse(json);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.settings.language).toBe('pt-BR');
      expect(parsed.data.settings.fpsLimit).toBe(30);
      expect(parsed.data.settings.quietMode).toBe(true);
    }
  });

  it('fills default settings when absent', () => {
    const parsed = gameStateSchema.safeParse({ version: 3, resources: { nuts: 1 } });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.settings.fpsLimit).toBe(60);
      expect(parsed.data.settings.offlineCapHours).toBe(8);
    }
  });

  it('clamps an invalid fpsLimit to a valid literal', () => {
    const parsed = gameStateSchema.safeParse({
      version: 3,
      resources: { nuts: 1 },
      settings: { fpsLimit: 144 },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect([30, 60]).toContain(parsed.data.settings.fpsLimit);
  });
});
