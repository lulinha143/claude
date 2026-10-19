import { describe, it, expect } from 'vitest';
import { getPlatform } from '../src/platform/adapter';
import {
  LocalAchievements,
  SteamAchievements,
  STEAM_ACHIEVEMENT_IDS,
} from '../src/platform/achievements';

describe('platform adapter (browser fallback)', () => {
  it('falls back to a browser adapter when no desktop bridge is present', async () => {
    const p = getPlatform();
    expect(p.isDesktop).toBe(false);
    // browser-safe no-ops must not throw
    await expect(p.hideToTray()).resolves.toBeUndefined();
    await expect(p.getIdleSeconds()).resolves.toBe(0);
    const info = await p.getPlatformInfo();
    expect(info.isDesktop).toBe(false);
    expect(info.platform).toBe('browser');
  });

  it('window setting mutations are remembered in-memory', async () => {
    const p = getPlatform();
    const next = await p.setAlwaysOnTop(true);
    expect(next.alwaysOnTop).toBe(true);
    const now = await p.getWindowSettings();
    expect(now.alwaysOnTop).toBe(true);
  });
});

describe('achievement adapters', () => {
  it('local achievements always available and record unlocks', () => {
    const a = new LocalAchievements();
    expect(a.isAvailable()).toBe(true);
    a.unlock('first-day');
    expect(a.has('first-day')).toBe(true);
  });

  it('steam adapter fails safe when no backend is present', () => {
    const s = new SteamAchievements();
    expect(s.isAvailable()).toBe(false);
    expect(() => s.unlock('first-day')).not.toThrow();
  });

  it('steam adapter forwards mapped ids when a backend exists', () => {
    const seen: string[] = [];
    const s = new SteamAchievements({ setAchievement: (id) => (seen.push(id), true) });
    s.unlock('going-nuts');
    expect(seen).toContain(STEAM_ACHIEVEMENT_IDS['going-nuts']);
  });
});
