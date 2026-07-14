# Steam Preparation Guide

The game is **prepared for Steam without requiring Steam to run**. All Steam
touchpoints sit behind adapters that fail safe when Steam is absent, so local
development and the browser demo work unchanged. **No real Steam App ID or secret
is needed for development or testing.**

## Integration boundaries

| Concern | Where | Fallback |
| --- | --- | --- |
| Achievements | `src/platform/achievements.ts` (`SteamAchievements`) | `LocalAchievements` (no-op mirror; game unlocks locally regardless) |
| Stats | Same adapter pattern | Local `stats` in the save |
| Rich Presence | Wire in Electron main via a Steamworks binding, expose over IPC | Omitted |
| Cloud saves | Save to userData (see paths below) | Local file / localStorage |
| Steam Deck detection | `electron/main.ts` (`SteamDeck`/`SteamOS` env) + `getPlatformInfo()` | `isSteamDeck: false` |
| Overlay awareness | Electron `web-contents` events | No-op |
| Shutdown callbacks | `app.on('will-quit')`, `beforeunload` save hook | Autosave on hide/unload |

To enable real Steamworks: add a native binding (e.g. `steamworks.js`) in the
**main process only**, construct `new SteamAchievements(backend)` where `backend`
forwards `setAchievement` over IPC, and select it in
`createAchievementAdapter()`. Keep it optional so builds without the binding still
run.

## Achievement API id mapping

Internal ids map to Steamworks ids in `STEAM_ACHIEVEMENT_IDS`. Configure matching
ids on the Steamworks partner site. Starter mapping (extend to all 41):

| Internal | Steam id |
| --- | --- |
| first-day | ACH_FIRST_DAY |
| working-nuts-off | ACH_WORKING_NUTS_OFF |
| going-nuts | ACH_GOING_COMPLETELY_NUTS |
| nice | ACH_NICE |
| one-nutillion | ACH_ONE_NUTILLION |
| full-staff | ACH_FULL_STAFF |

## Recommended Steam Cloud save paths

Electron stores saves in `app.getPath('userData')`:

- Windows: `%APPDATA%/working-my-nuts-off/`
- macOS: `~/Library/Application Support/working-my-nuts-off/`
- Linux: `~/.config/working-my-nuts-off/`

Configure Steam Auto-Cloud to sync `*.json` (the save + window settings) from
that directory.

## Store page — feature summary (draft)

- Cozy desktop idle game that lives in a corner of your screen.
- One squirrel, a growing animal team, and a nut empire that runs while you work.
- Automation, prestige branches, collections, daily challenges, and funny events.
- Optional supportive Focus companion. No ads, no microtransactions, fully offline.
- Shareable Moment Cards and Photo Mode. 12 languages (EN/PT-BR complete at launch).

## Suggested system requirements

- **Minimum:** Windows 10 / macOS 11 / modern Linux; dual-core CPU; 4 GB RAM;
  integrated graphics; ~300 MB disk.
- **Recommended:** any machine from the last decade. The game targets low idle
  CPU/GPU and offers a Battery-friendly / Quiet Mode.

## Suggested launch options

- `--dev` style flags are not needed for players. Steam Deck is auto-detected.
- Consider offering "start minimized to tray" via the in-game
  **Launch on system startup** option.

## Capsule art briefs (for a commissioned artist)

- **Main capsule:** Pip mid-celebration on a desk buried in acorns, tree-trunk
  office cutaway behind, warm amber lighting, cozy palette. Title lockup with the
  playful subtitle.
- **Small capsule:** Pip's face + glasses + green tie, one golden acorn.
- **Library hero:** the multi-floor office diorama with all six employees at work.

## Documents

- EULA template (**must be reviewed by a lawyer before use**): see
  `docs/EULA_TEMPLATE.md`.
- Privacy statement: `PRIVACY.md`.
- Release checklist: `docs/RELEASE_CHECKLIST.md`.

> Do not commit real Steam App IDs, secrets, or signing certificates. This repo
> intentionally contains none.
