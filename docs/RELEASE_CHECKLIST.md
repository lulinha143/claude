# Release Checklist

## Legal / naming (do first)
- [ ] **Trademark search** for "HEAVY BAGGAGE" (games/software classes) in target
      regions.
- [ ] **Domain** availability + registration.
- [ ] **Social-media handle** availability across platforms.
- [ ] **Steam storefront name** availability / no conflicting app.
- [ ] Replace `LICENSE` placeholder with a professionally reviewed license.
- [ ] Legal review of `PRIVACY.md` and any EULA for your jurisdiction(s).
- [ ] Confirm all shipped assets are original or licensed for commercial use;
      update `THIRD_PARTY_NOTICES.md`.

## Engine / build
- [ ] Confirm Godot version pin (currently 4.4.1; bump reminder when 4.7 ships).
- [ ] `make import` clean (no parse errors).
- [ ] `make test` and `make integration` pass.
- [ ] `make validate` (content + localization) passes.
- [ ] Windows export runs on a clean Windows 10 and 11 machine.
- [ ] Linux export runs on a clean distro.
- [ ] Demo export: restrictions verified, wishlist URLs set.

## Quality gates (Definition of Done)
- [ ] Opens without parser errors; clean clone runs.
- [ ] Tutorial / first contract completable solo.
- [ ] 2+ clients connect; shared grabbing, sync, revive, completion, disconnect
      all verified manually (see `docs/MULTIPLAYER.md`).
- [ ] Four furniture types have complete emotional behaviour.
- [ ] Van detects loaded targets; rewards persist; save/load works.
- [ ] Character customization persists; warehouse works.
- [ ] English + Brazilian Portuguese complete.
- [ ] Controller navigation of every menu; accessibility settings apply.
- [ ] Works without Steam; Steam init fails gracefully.
- [ ] No broken visible buttons; no core placeholder TODOs disguised as features.

## Signing / store
- [ ] Windows Authenticode signing (EV recommended).
- [ ] macOS Developer ID signing + Apple notarization + staple (if shipping mac).
- [ ] Steamworks: App ID set locally (never committed), 40 achievements entered
      with matching IDs (`content/steam/achievements.md`), Cloud configured for
      `user://`, depots + launch options set, capsule art uploaded.
- [ ] Age rating questionnaires (IARC etc.).

## Store page
- [ ] Copy from `docs/marketing/STORE_COPY.md` (EN + PT-BR).
- [ ] Capsule art per `docs/marketing/CAPSULE_ART_BRIEFS.md`.
- [ ] Trailer per `docs/marketing/TRAILER_STORYBOARD.md`.
- [ ] Screenshots/GIFs from real gameplay (no fakes).
- [ ] System requirements confirmed by testing.

## Post-launch
- [ ] Crash/error monitoring plan (no invasive analytics).
- [ ] Content roadmap communicated (`docs/CONTENT_ROADMAP.md`).
