// Achievement platform adapter. The game unlocks achievements locally (in the
// save) regardless; this adapter mirrors unlocks to an external platform when
// one is present. Three implementations:
//   - LocalAchievements: always active, no-op mirror (default in browser/dev)
//   - SteamAchievements: boundary that would call the Steamworks API via the
//     desktop bridge. It fails safe when Steam is unavailable so the game runs
//     normally without Steam. See docs/STEAM.md for the API id mapping.

export interface AchievementAdapter {
  readonly name: string;
  unlock(achievementId: string): void;
  isAvailable(): boolean;
}

export class LocalAchievements implements AchievementAdapter {
  readonly name = 'local';
  private unlocked = new Set<string>();
  unlock(id: string): void {
    this.unlocked.add(id);
  }
  isAvailable(): boolean {
    return true;
  }
  has(id: string): boolean {
    return this.unlocked.has(id);
  }
}

// Steam API ids are conventionally uppercase snake case. This maps our internal
// ids to the ids configured in the Steamworks partner site.
export const STEAM_ACHIEVEMENT_IDS: Record<string, string> = {
  'first-day': 'ACH_FIRST_DAY',
  'working-nuts-off': 'ACH_WORKING_NUTS_OFF',
  'going-nuts': 'ACH_GOING_COMPLETELY_NUTS',
  'nice': 'ACH_NICE',
  'one-nutillion': 'ACH_ONE_NUTILLION',
  'full-staff': 'ACH_FULL_STAFF',
};

export class SteamAchievements implements AchievementAdapter {
  readonly name = 'steam';
  // In a shipped build this would hold a handle to a steamworks binding loaded
  // in the Electron main process and exposed over IPC. We keep it optional so
  // the code compiles and runs without the native module present.
  constructor(private backend?: { setAchievement(id: string): boolean }) {}
  isAvailable(): boolean {
    return !!this.backend;
  }
  unlock(id: string): void {
    if (!this.backend) return; // fail safe — never throws when Steam is absent
    const steamId = STEAM_ACHIEVEMENT_IDS[id];
    if (steamId) this.backend.setAchievement(steamId);
  }
}

export function createAchievementAdapter(): AchievementAdapter {
  // Steam backend wiring happens in the desktop build; default to local.
  return new LocalAchievements();
}
