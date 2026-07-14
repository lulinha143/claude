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

### Known limitations
See `docs/KNOWN_LIMITATIONS.md`.
