# How to Test the Game Before Steam (Beginner Guide)

Test in levels, from quickest to most thorough. You do **not** need to do all of
them every time, but do **Levels 1 and 2** before you ever upload to Steam.

Terms: a **terminal** is the PowerShell window; a **command** is text you type
and press Enter; the **dev server** is a temporary local web server the browser
version uses while developing.

---

## Level 1 — Development test (fastest, catches most bugs)

1. Open the project in PowerShell (`cd` into the folder — see the play guide).
2. Run the automated checks:
   ```
   npm run validate
   ```
   This runs type-checking, the linter, the translation checker, all unit
   tests, and a production build. **Everything should say it passed.** If
   something fails, the message tells you which file.
3. Run the browser version and click around:
   ```
   npm run dev
   ```
   Open `localhost:5173`. Press **F12** to open the browser's developer tools →
   **Console** tab. **There should be no red errors.**
4. Run the desktop (Electron) version in development mode:
   ```
   npm run desktop:dev
   ```
5. Turn on the **Developer Panel**: add `?dev=1` to the browser address
   (`localhost:5173/?dev=1`) or use a dev build. A **DEV** button appears at the
   bottom-left. It has two tabs:
   - **Diagnostics** — version, save version, mode, nuts/sec, active boost,
     morale, reputation, hired count, rooms, active event, cooldowns, FPS,
     missing translation keys, and audio channel values.
   - **Actions** — add currency, unlock everyone, trigger any event, simulate
     offline hours, set a deterministic seed, reset window position, test audio
     channels, reset the save.

---

## Level 2 — Packaged executable test (test the REAL app)

The development server is not the shipped game. Test the packaged build.

1. Build it:
   ```
   npm run build:windows
   ```
2. Open `release\win-unpacked\` and double-click **`ZooWorkers.exe`**.
   The dev server must **not** be running — the app must work on its own.
3. Work through the **QA checklist** in
   [`PACKAGED_BUILD_QA.md`](PACKAGED_BUILD_QA.md). At minimum:
   - New save works; play a few minutes.
   - Close and reopen — progress persisted.
   - Offline progress: close for a while, reopen, see the "While You Were Away"
     summary (or use the dev panel's "simulate offline").
   - Audio: music + ambience play; each channel's volume and mute work; master
     mute silences everything; settings persist after restart.
   - Window: drag it, dock to each corner, always-on-top, hide to tray + restore.
   - Multiple monitors: move it to another monitor, close, reopen — it returns to
     a visible spot (never off-screen).
   - Every menu opens; minigames start, can be exited, and grant a reward once.
   - Events show choices and a clear "What Changed" panel afterward.
   - Prestige works (use the dev panel to add nuts, then prestige).
   - Export a save, then Import it back.

---

## Level 3 — Test on another computer

Why: your machine already has Node.js and build tools; a player's machine does
not. This proves the app is self-contained.

1. Copy the whole **`release\win-unpacked\`** folder (or the installer `.exe`) to
   a USB stick or send it to a friend.
2. On the other computer (with **no** Node.js installed), run the `.exe`.
3. Confirm: it opens, shows no missing-file errors, plays, saves, and closes.
4. If something's missing, it's usually an asset path problem — rebuild and
   re-copy the **entire** folder (not just the exe).
5. To collect logs from a tester: ask them for the folder
   `C:\Users\<Name>\AppData\Roaming\zooworkers\logs\` (if present) and
   any red text they saw.

---

## Level 4 — Closed testing through Steam (before public launch)

Steam gives you private ways to test with real players. Verify the exact steps on
the official docs (they evolve): https://partner.steamgames.com/doc/store/application

Your options:

- **Private beta branch (password-protected):** In Steamworks →
  *SteamPipe → Builds*, upload a build and set it live on a branch named e.g.
  `beta`, then set a password (*Builds → beta → password*). Give testers the
  password; they right-click the game in Steam → **Properties → Betas** → enter
  it. Great for updating fast and privately.
- **Steam keys:** Request a batch of free keys (Steamworks → *Request Product
  Keys*) and hand them to trusted testers. Keys grant the real app; use for small
  trusted groups.
- **Steam Playtest:** A separate, linked "Playtest" application so testers can
  request access from your store page **without** affecting your main game's
  reviews or wishlists. Enable it under your app's *Playtest* settings. Update
  its build the same way (SteamPipe). Turn it off when finished, then carry the
  fixes back into your main build.

How they differ: a **beta branch** is inside your main app (needs the app to be
owned or keyed); **Playtest** is a separate free app designed for public-facing
demos/tests and keeps reviews/wishlists clean.

To collect feedback: use a Steam Community discussion, a simple form link in the
game's description, or a Discord invite.

---

## Printable QA checklist
See [`PACKAGED_BUILD_QA.md`](PACKAGED_BUILD_QA.md) for a checkbox list you can
print and tick off before every release.
