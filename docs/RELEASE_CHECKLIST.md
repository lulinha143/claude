# Release Checklist

## Before every release

- [ ] `npm run validate` passes (typecheck, lint, i18n, tests, build).
- [ ] `npm run test:e2e` passes locally or in CI.
- [ ] `CHANGELOG.md` updated with the new version and date.
- [ ] Version bumped in `package.json`.
- [ ] Save migrations added if `SAVE_VERSION` changed, with tests
      (`tests/save.test.ts`) covering the upgrade path.
- [ ] Localization: `npm run check:i18n` shows 0 hard errors; EN + PT-BR complete.
- [ ] Manual smoke test: new game → collect → buy upgrade → hire employee →
      trigger an event → complete a focus session → prestige → reload.

## Desktop packaging

- [ ] `npm run package:win` / `:linux` / `:mac` produce artifacts in `release/`.
- [ ] Frameless/transparent window, tray, always-on-top, click-through, corner
      docking, and scale presets verified on each target OS.
- [ ] Window position/scale persist across restart.
- [ ] Global show/hide hotkey works; single-instance lock works.

## Code signing (commercial releases)

- [ ] Windows: sign the NSIS installer and portable exe with an EV/OV cert.
- [ ] macOS: sign + notarize; enable hardened runtime; staple the ticket.
- [ ] Provide signing material to CI as **encrypted secrets**
      (`CSC_LINK`, `CSC_KEY_PASSWORD`, Apple notarization creds). Never commit them.
- [ ] Development/CI builds remain unsigned by design.

## Steam (if applicable)

- [ ] Steamworks achievement ids match `STEAM_ACHIEVEMENT_IDS` (extend to all 41).
- [ ] Steam Auto-Cloud configured for the userData save path (see `docs/STEAM.md`).
- [ ] Depot built from `dist/` + `dist-electron/` + packaged binary.
- [ ] Store page assets, capsule art, and system requirements finalized.
- [ ] EULA reviewed by counsel (`docs/EULA_TEMPLATE.md` is only a placeholder).
- [ ] Confirm the game runs correctly with **and without** Steam running.

## Web demo

- [ ] GitHub Pages deploy succeeds; desktop-only options gracefully disabled.
- [ ] `base: './'` keeps asset paths working under the Pages subpath.

## Legal / privacy

- [ ] `PRIVACY.md` accurate; no telemetry, ads, or tracking added.
- [ ] No secrets, certificates, personal paths, or real App IDs committed.
- [ ] `LICENSE` and any bundled-asset licenses present and correct.
