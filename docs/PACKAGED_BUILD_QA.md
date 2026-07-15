# Packaged Build QA Checklist

Print this and tick every box on the **packaged** `.exe` (from
`release\win-unpacked\`), with the dev server NOT running, before any release.

## Launch & basics
- [ ] `Working My Nuts Off!.exe` opens with no error dialog
- [ ] No blank/white window; the office appears
- [ ] No white flash on startup; transparent edges look clean
- [ ] No dev server or internet connection required
- [ ] No Steam client required (normal local build)

## Core gameplay
- [ ] Clicking the crate collects nuts (+X pop appears)
- [ ] Passive production increases nuts over time
- [ ] Buying an upgrade updates production and cost
- [ ] Hiring an employee works; they appear in a room (never invisible)
- [ ] All 12 employees can be unlocked/hired (use dev panel to fast-forward)
- [ ] Reassigning an employee to another room moves them in the office

## Systems
- [ ] Each of the 3 minigames starts, can be exited, grants a reward exactly once
- [ ] Events show 2–4 choices and a clear "What Changed" panel afterward
- [ ] A multi-step event chain advances correctly
- [ ] Prestige works and grants Permanent Kernels
- [ ] Daily challenges appear and can be claimed
- [ ] Decorations: buy one, it appears in its room, can be hidden/shown
- [ ] Production breakdown (Company tab) matches the header nuts/sec

## Save
- [ ] Close and reopen — progress persisted
- [ ] Offline progress summary appears after being closed a while
- [ ] Export save produces a `.json`; Import restores it
- [ ] Old save from a previous version still loads (migration)
- [ ] Reset (Settings) asks for confirmation and starts fresh

## Audio
- [ ] Music plays and loops without harsh pops
- [ ] Office ambience (typing/coffee/creak) occurs occasionally, not constantly
- [ ] Master volume + mute work; each channel volume + mute work
- [ ] Muting a channel then unmuting restores the previous volume
- [ ] Settings persist after restart
- [ ] Quiet Mode and Focus Mode reduce audio appropriately
- [ ] "Mute when unfocused" silences audio when the window loses focus

## Desktop window
- [ ] Drag the top bar to move the window anywhere
- [ ] Dock to each of the 4 corners
- [ ] Always-on-top keeps it above other windows
- [ ] Click-through can be enabled AND disabled again (recovery works)
- [ ] Hide to tray, then restore from the tray icon
- [ ] Window scale presets work and text stays readable
- [ ] Move to a second monitor, close, reopen → returns on-screen
- [ ] Change display scaling (125%/150%) → UI still readable

## Accessibility & language
- [ ] Reduced motion stops animations
- [ ] High contrast, colorblind modes, dyslexia font, font/UI scale all apply
- [ ] Switch language to Português (BR) — no missing text, no overflow
- [ ] Switch back to English

## Performance (leave it running in a corner)
- [ ] CPU stays low while idle
- [ ] No steady memory growth over ~30 minutes
- [ ] No console errors (check a dev build's F12 console)
