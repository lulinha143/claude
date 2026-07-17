# Local Windows Verification Checklist

A focused, by-hand checklist for the two areas that only misbehave in the real
packaged Windows build (audio + window management), plus the decoration and
save flows. Run it on Windows after building locally — the automated suite
already covers the logic, but the mute and resize behaviours depend on the
native OS window, which can't be verified on the Linux CI box.

---

## 1. Build the app (Windows)

From the project root in **PowerShell** (or any Windows terminal):

```powershell
npm install
npm run build:windows:folder
```

`build:windows:folder` runs `npm run build:desktop` (web bundle + Electron main)
and then `electron-builder --win dir`, which produces an **unpacked folder**
build — the fastest option for local testing (no installer, no signing).

### Expected executable location

```
release\win-unpacked\Working My Nuts Off!.exe
```

Double-click that `.exe` to launch. (There is no installer with the `dir`
target; the whole runnable app lives in `release\win-unpacked\`.)

Other targets, if you want them:

| Command | Output |
| --- | --- |
| `npm run build:windows` | `release\Working My Nuts Off! Setup 1.0.0.exe` (NSIS installer) |
| `npm run build:portable` | `release\Working My Nuts Off!-1.0.0-portable.exe` (single portable exe) |

> Note: these builds must be run **on Windows**. Building the Windows target on
> Linux/macOS fails at the executable-signing step with `wine is required` — an
> electron-builder cross-compile limitation, not a code problem.

Where things live at runtime (useful for the audio/window checks below):

- Game save + settings: browser-style `localStorage`, which Electron persists
  under `%APPDATA%\Working My Nuts Off!\`.
- Window position/size/state: `%APPDATA%\Working My Nuts Off!\window-settings.json`.
- Launch/crash log: `%APPDATA%\Working My Nuts Off!\startup.log`.

---

## 2. Mute / audio (the previously-broken flow)

Do this with the app window **focused** and your system volume up.

- [ ] **Mute** — click the speaker button in the header. Its icon changes to the
      muted glyph and all sound stops **immediately** (music, ambience, clicks).
- [ ] **New sound stays silent** — while muted, click around (collect a crate,
      open Upgrades, buy something). No sound should play.
- [ ] **Minigame stays silent** — while muted, open **Focus** and start a
      micro-game (Coffee Rescue / Bug Squash / Cable Untangle). Play a few
      seconds: still completely silent.
- [ ] **Unmute** — click the speaker again. Music/ambience fade back in at the
      same volumes as before.
- [ ] **Audio after restart** — mute, then fully **close** the app and relaunch
      the `.exe`. It should come back **muted** (the speaker shows the muted
      state and no sound plays until you unmute).
- [ ] **Per-channel volumes** — in Settings, confirm the Master / Music /
      Ambience / UI / SFX sliders each change the right sound, and that Master
      Mute overrides all of them.

If any sound leaks while muted, capture `startup.log` and note which action
produced it.

---

## 3. Window controls & resizing (frameless title bar)

The window is frameless with a custom title bar (the header). It is now
**opaque**, so Windows draws its normal resize border right at the visible edge.

- [ ] **Minimize** — the ⎯ button sends the window to the taskbar; clicking the
      taskbar icon restores it.
- [ ] **Maximize / Restore** — the ▢ button fills the screen; clicking again
      (now the restore glyph) returns to the previous size.
- [ ] **Close** — the ✕ button saves the game + window size and **quits**
      (unless "Close minimizes to tray" is on — see below).
- [ ] **Drag** — dragging the header (not on a button) moves the window; the
      buttons and resource readouts never trigger a drag.
- [ ] **Resize from every edge** — top, bottom, left, right: the resize cursor
      appears **right at the visible border**, not several pixels away, and the
      grab zone does **not** overlap the header buttons or room content.
- [ ] **Resize from every corner** — all four corners resize on both axes.
- [ ] **Minimum size** — shrink as far as it allows: it should stop around
      **320 × 420** and never clip the header or nav into an unusable state.
- [ ] **Compact / horizontal / vertical proportions** — at a small square, a
      wide short strip, and a tall narrow strip, the UI stays readable (nav
      wraps/scrolls, popups scroll internally, nothing is cut off).
- [ ] **Resize persistence** — resize + move the window, close, relaunch: it
      reopens at the **same size and position** (check `window-settings.json`).
- [ ] **Display scaling** — on a 125% / 150% display, the window and text scale
      cleanly with no blur or clipped controls.

### Tray behaviour (only if you opt in)

- [ ] In **Settings → Desktop**, the app does **not** hide to the tray on close
      by default.
- [ ] Enable **"Close minimizes to tray"**. Now the ✕ button hides the app to
      the system tray; the tray icon restores it, and its menu can quit.
- [ ] Disable it again → ✕ quits normally.

---

## 4. Decorations (placement, collision, persistence)

- [ ] **Enter Decorate/Arrange mode** from the office toolbar.
- [ ] **Drag a floor decoration** (plant, lamp, rug) — it follows the pointer
      with a full-size ghost, a "Floor" surface label, and a highlighted floor
      guide; on drop it settles with a small dust puff + soft sound (silent if
      muted).
- [ ] **Drag a wall decoration** (poster, window, clock) — it only lands on the
      wall band; the guide/label read "Wall".
- [ ] **Collision rejection** — try to drop one piece directly on top of another,
      or a big piece onto a teammate: the drop is **refused**, the piece stays
      where it was, and a short message explains why ("already something right
      there", "would cover a teammate", "move it farther inside").
- [ ] **Interact** — outside Decorate mode, click a lamp/screen/aquarium (turns
      on/off), a poster (art changes), a plant (wobble). Sounds obey Mute.
- [ ] **Save & reload** — move a few decorations, then close + relaunch: every
      piece is exactly where you left it.

---

## 5. Accessibility / performance toggles

- [ ] **Reduced Motion** (Settings) — ambient animation (dust, blinking,
      decoration motion) stops; drag still works, just without the flourishes.
- [ ] **Battery-friendly mode** (Settings → Desktop) — ambient animation pauses
      to save power.
- [ ] **Minimize the window** — ambient animation pauses while hidden and
      resumes when you bring it back.

---

If anything fails, grab `%APPDATA%\Working My Nuts Off!\startup.log` and note the
exact step; that log captures load, render and window events for diagnosis.
