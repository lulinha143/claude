# Steam Release Checklist

A quick, ordered checklist for shipping on Steam. Details for each step are in
[`HOW_TO_PUBLISH_ON_STEAM.md`](HOW_TO_PUBLISH_ON_STEAM.md).

## Before building
- [ ] `npm run validate` passes (typecheck, lint, i18n, tests, web build)
- [ ] `PACKAGED_BUILD_QA.md` completed on the packaged `.exe`
- [ ] Version bumped in `package.json`
- [ ] `CHANGELOG.md` updated
- [ ] Save migration added + tested if the save format changed

## Build
- [ ] `npm run build:steam` (on Windows) → `release/steam/windows/`
- [ ] `npm run verify:steam` reports OK (no secrets, saves, or source leaked)
- [ ] Confirmed the folder has `ZooWorkers.exe`
- [ ] No `steam_appid.txt` in the public build

## Steamworks setup
- [ ] Partner account complete: legal, tax, bank, Steam Guard
- [ ] Steam Direct fee paid ($100 USD/app, recoupable — verify current amount)
- [ ] AppID + Windows Depot ID recorded
- [ ] Launch executable set to `ZooWorkers.exe`

## Store page
- [ ] Name, short + long descriptions
- [ ] Genres, tags, languages, accessibility features
- [ ] System requirements
- [ ] All capsule art + ≥5 screenshots + trailer (`STEAM_ASSET_CHECKLIST.md`)
- [ ] Content survey answered truthfully
- [ ] Price + release date set

## Upload & test
- [ ] Uploaded via SteamPipe to a private `beta` branch
- [ ] Installed + tested through the Steam client
- [ ] Runs correctly launched OUTSIDE Steam too
- [ ] (If wired) achievements + Cloud saves verified

## Review & launch
- [ ] Store page submitted for review
- [ ] Build submitted for review; every advertised feature exists in it
- [ ] All Steamworks checklist items green
- [ ] Reviewed build moved to `default`
- [ ] Released; verified a real download works
- [ ] Monitoring community + crash reports; hotfix build ready
