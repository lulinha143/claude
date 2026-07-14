# How to Publish on Steam (Beginner Guide)

> **Facts verified against the official Steamworks documentation in July 2026.**
> Steam changes details over time — always confirm on the official pages linked
> below before you rely on a number. This guide never invents credentials or fees.

Key official pages:
- Getting started / fee: https://partner.steamgames.com/doc/gettingstarted
- Steam Direct fee: https://partner.steamgames.com/doc/gettingstarted/appfee
- Store assets: https://partner.steamgames.com/doc/store/assets
- Uploading builds (SteamPipe): https://partner.steamgames.com/doc/sdk/uploading
- App review / launch: https://partner.steamgames.com/doc/store/application

Words explained once:
- **Steamworks** — Valve's website where developers set up and manage games.
- **AppID** — the unique number Steam gives your game (e.g. `1234567`).
- **Depot** — a container of files for a platform (e.g. your Windows files).
- **Build** — one uploaded version of those files.
- **Branch** — a channel players can be on. `default` is the public one; you can
  make private ones like `beta`.
- **SteamPipe** — Valve's tool for uploading your build.
- **SteamCMD** — the command-line uploader included with the Steamworks SDK.

---

## Part 1 — Prepare before you make the store page
Have these ready (write them in a document):
- Final game name: **Working My Nuts Off!**
- Developer/Publisher name (a person or company you legally are).
- Confirmation you own all assets. This game's art/audio are original and
  generated in code (see `assets/audio/LICENSES.md`, `docs/ASSET_REPLACEMENT.md`).
- Privacy info (see `PRIVACY.md` — no tracking, offline, no ads).
- System requirements (see the suggested list in `docs/STEAM.md`).
- Supported languages (English + Brazilian Portuguese are complete; others are
  drafts — say so honestly).
- Save location (Windows: `%APPDATA%\working-my-nuts-off\`).
- Version number (start at `1.0.0`).
- A support email.
- Store text: short description (≤ ~300 chars) + long description.
- Screenshots, a trailer, and capsule art (see `docs/STEAM_ASSET_CHECKLIST.md`).

---

## Part 2 — Create a Steamworks partner account
1. Go to https://partner.steamgames.com and sign in with a Steam account (make a
   new one for your company if you prefer).
2. Complete the **Steam Direct** onboarding: company/individual legal details,
   **tax** forms, and **bank/payee** info. Take your time — mistakes here delay
   payments.
3. Pay the **Steam Direct fee: $100 USD per app** (or local equivalent). Per the
   official docs this fee is **recoupable** — Steam credits it back against your
   earnings once the game passes a sales threshold. *(Verified July 2026 — confirm
   the current amount on the fee page above.)*
4. Turn on **Steam Guard** (two-factor) on the account. Never share your login.
5. Wait for any required verification (bank/tax checks can take a few days).

---

## Part 3 — Create the application
1. In Steamworks, create your app. Steam assigns your **AppID** — write it down;
   you'll use it everywhere as `<YOUR_APP_ID>`.
2. Steam creates a default **depot** for you; note its number as
   `<YOUR_WINDOWS_DEPOT_ID>` (often `<AppID>+1`).
3. Concepts, using this game as the example:
   - **Package** = what a customer buys that grants the app.
   - **Depot** = your Windows files (`release/steam/windows/`).
   - **Build** = one upload of those files.
   - **Branch** = `default` (public) or a private one like `beta` for testing.
   - **Launch option** = tells Steam which file to run:
     `Working My Nuts Off!.exe`.

---

## Part 4 — Configure the store page
In Steamworks → your app → **Store Presence → Store Page**, fill in:
- Store **name**, **short description**, **long description**
- **Genres** (Simulation, Casual, Indie) and **tags** (Idle, Cozy, Cute,
  Management, Singleplayer)
- **Supported languages** (mark interface/subtitles per language honestly)
- **Accessibility features** (reduced motion, high contrast, colorblind modes,
  font/UI scaling, remappable audio, subtitles for audio cues)
- **System requirements** (from `docs/STEAM.md`)
- **Price** and **release date**
- **Capsules, screenshots, trailer, library assets** (sizes in
  `docs/STEAM_ASSET_CHECKLIST.md`)
- **Content survey** (this game: no violence/adult content — answer truthfully)
- Legal/company info

The exact list of visual assets and their pixel sizes is in
[`STEAM_ASSET_CHECKLIST.md`](STEAM_ASSET_CHECKLIST.md).

---

## Part 5 — Prepare the Steam build (on Windows)
On a Windows machine with Node.js installed (see `HOW_TO_PLAY_THE_GAME.md`):
```
npm install
npm run build:steam
npm run verify:steam
```
- `build:steam` assembles a clean folder: **`release\steam\windows\`** with the
  `.exe`, the packaged app, and license docs — no source, no saves, no secrets.
- `verify:steam` scans that folder and fails if anything unsafe is present.

The public build **does not** include `steam_appid.txt` (that file is only for
local SDK testing, per the docs). Never hardcode another game's AppID and never
use Spacewar / AppID 480 as a shipping app.

---

## Part 6 — Steamworks integration (optional, game runs without Steam)
This game is designed to run fine **without** Steam; Steam features sit behind
adapters (`src/platform/achievements.ts`, `docs/STEAM.md`) and fail safe when
Steam is absent. When you're ready to wire real Steam features:
- **Achievements / stats:** map the internal ids to Steamworks achievement ids
  (`STEAM_ACHIEVEMENT_IDS`) and call them from the Electron main process via a
  Steamworks binding, exposed over the existing IPC bridge.
- **Cloud saves:** point Steam Auto-Cloud at `%APPDATA%\working-my-nuts-off\`.
- **Steam Deck / language detection / overlay / Rich Presence:** optional; keep
  graceful fallbacks so launching outside Steam never crashes.

---

## Part 7 — Upload with SteamPipe (SteamCMD)
1. Download the **Steamworks SDK** (Steamworks → *SDK Download*). Inside it is the
   content builder (`tools/ContentBuilder/`) with `steamcmd`.
2. In this repo, copy the templates and fill in your numbers:
   - `steam/app_build.example.vdf` → `steam/app_build.vdf`
   - `steam/depot_windows.example.vdf` → `steam/depot_windows.vdf`
   - Replace `<YOUR_APP_ID>`, `<YOUR_WINDOWS_DEPOT_ID>`, `<YOUR_STEAM_USERNAME>`.
   - These real `.vdf` files are git-ignored — do not commit them.
3. Point `contentroot` at your Steam-ready folder (already set to
   `..\..\release\steam\windows\` relative to the `steam/` folder).
4. Upload (from a terminal), leaving `setlive` empty so it uploads **without**
   publishing:
   ```
   steamcmd +login <YOUR_STEAM_USERNAME> +run_app_build C:\full\path\to\steam\app_build.vdf +quit
   ```
5. In Steamworks → **SteamPipe → Builds**, find the new build. Assign it to a
   branch (start with a private `beta`), not `default`.
6. In **Installation → General**, set the **launch option** executable to
   `Working My Nuts Off!.exe`.
7. Never put your password in a script or in git. Type it when prompted, or use
   Steam Guard-backed cached login.

To update later: rebuild, upload again, assign the new build to the branch.

---

## Part 8 — Test through the Steam client
1. Set your new build live on a private **`beta`** branch and give it a password.
2. In Steam → your library → the game → **Properties → Betas** → enter the
   password → let it download.
3. Launch from the Steam library. Confirm Steam installed the correct files, the
   game runs, saves work, and it also still runs when launched **outside** Steam
   (double-clicking the exe).
4. Test uninstall/reinstall, and (if wired) achievements + Cloud saves.
5. Check the build's logs in Steamworks if anything looks off.

---

## Part 9 — Steam Playtest (optional public testing)
- Playtest is a **separate, linked app** so people can request access from your
  store page without affecting your main game's reviews or wishlists.
- Enable it in your app's **Playtest** settings, upload a build to it via
  SteamPipe (same process, its own AppID/depot), and grant access.
- Close it when done and fold useful changes back into your main build.

---

## Part 10 — Submit for review
1. Submit the **store page** for review and the **build** for review (Steam
   checks the default-branch build runs and matches what you advertise).
2. Complete every required checklist item in Steamworks (they highlight what's
   missing).
3. Every feature you advertise must exist in the submitted build.
4. If something is rejected, fix it, re-upload/re-submit. Review timing varies —
   confirm current expectations on the official application page.

---

## Part 11 — Release
1. Set the final **price** and **release date/time**.
2. Publish approved store changes.
3. Move the reviewed, tested build to the **`default`** branch.
4. Release through Steamworks when the date arrives.
5. Immediately buy/download your own copy and confirm it works.
6. Watch the Community hub and any crash reports; keep a hotfix build ready.

---

## Part 12 — Update the game later
1. Bump the version in `package.json` (e.g. `1.0.1`).
2. `npm run build:steam` → `npm run verify:steam`.
3. Upload to a `beta` branch, test it there.
4. When happy, set that build live on `default`.
5. Protect save compatibility: if the save format changes, add a migration and a
   test (see `src/save/migrations.ts` and `tests/save.test.ts`). Never wipe a
   player's save.
6. Write short patch notes. If a build is bad, set an older good build live on
   `default` to roll back.

---

See also: [`STEAM_ASSET_CHECKLIST.md`](STEAM_ASSET_CHECKLIST.md),
[`STEAM_RELEASE_CHECKLIST.md`](STEAM_RELEASE_CHECKLIST.md), and the technical
`STEAM.md`.
