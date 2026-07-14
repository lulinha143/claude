# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added — 0.1.0 vertical slice
- Technical foundation: typed autoload services (logging, event bus, service
  locator, platform adapter, settings, save, localization, audio, networking,
  app router, dev tools), input map, Forward+ rendering config.
- Save system: multiple profiles, versioning + migrations (v1→v3), schema
  validation/sanitisation, rotating backups, atomic writes, export/import.
- Localization: runtime CSV loader, English + Brazilian Portuguese fully
  authored, 10 more locales scaffolded, pseudo-localization, completeness check.
- Data-driven furniture system: `FurnitureData` resource, `EmotionMachine` FSM,
  84 traits, 20 furniture definitions, procedural visuals, and full behaviour for
  the Clingy Sofa, Hungry Refrigerator, Shy Wardrobe, and Anxious Lamp.
- Physics: force-based multi-grab carrying, breakable hinged doors, van loading
  zone, velocity clamping, out-of-bounds recovery, physics-assist setting.
- Contract loop: deterministic contract generator, objectives, Property
  Instability escalation, reward + insurance calculation, incident reports.
- Solo AI assistants with a command FSM; ENet dev networking with a version
  handshake, typed validated messages, and lightweight state sync.
- Warehouse hub + Boxy mascot; functional screens: main menu, settings (tabs +
  rebinding), contract board, loadout, customization, encyclopedia, upgrades,
  achievements, incident report (PNG export), credits, HUD, pause.
- Content: 32 equipment, 40 achievements, 93 cosmetics, 56 contract modifiers,
  25 warehouse upgrades, 100+ incident lines, 8 locations, relationship matrix.
- Tooling: headless test runner + unit/integration tests, content & localization
  validators, dev overlay, Makefile, CI + release GitHub Actions, export presets.
- Documentation suite and marketing/store materials.

### Changed — player-facing visual & feel overhaul
- **Lighting/atmosphere:** the suburban house is now a warm, dressed interior
  (wood floor, area rug, bookshelf with books, cardboard boxes, wall pictures,
  kitchen counter, fridge, glowing ceiling panels) with readable day and
  cozy-dim night variants — replacing the previous dark empty box.
- **Third-person mover:** the player is now a stylised chunky character (boots,
  company uniform, oversized gloves, helmet, face) with a raised carry pose and
  walk bob, viewed through a collision-aware spring-arm camera (third person is
  now the default).
- **Furniture characters:** every object shows an always-visible cartoon face
  (eyes + pupils + a mouth that reacts to emotion), a floating name tag, and a
  brief emotion "speech" label. The piano gained a real mesh.
- **HUD:** rebuilt into clean styled cards with no overlapping text, correct
  key-prompt labels (e.g. "[E] Interact"), and a contextual carry panel.
- **Main menu:** now an enclosed warm 3D room with furniture actors and the Boxy
  mascot, instead of a flat panel.
- **Fix:** floor/rug planes were accidentally vertical (a rotation bug) leaving a
  blown-out white floor; floors are now correct horizontal slabs with flat
  diffuse materials.

### Known limitations
See `docs/KNOWN_LIMITATIONS.md`.
