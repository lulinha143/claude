# Content Status — authored vs. 1.0 targets

Counts are verified by `make validate-content` (fails CI if below minimum).

| Category | Authored | 1.0 target | Notes |
|----------|----------|-----------|-------|
| Furniture types | 20 | 20 | 4 with bespoke behaviour; 16 data-defined + generic behaviour |
| Traits (personality/paranormal/fear) | 84 | 60+ | all furniture-referenced ids covered |
| Equipment items/upgrades | 32 | 30+ | tools, consumables, upgrades |
| Warehouse upgrades | 25 | 25+ | `content/upgrades/` |
| Achievements | 40 | 40+ | mirrored in `content/steam/achievements.md` |
| Cosmetics | 93 | 80+ | 13 slots across categories |
| Contract modifiers | 56 | 50+ | daily/weekly draw from these |
| Incident-report lines | 102 | 100+ | across 7 categories |
| Locations | 8 | 8 | one procedural assembler used for all today |
| Localization keys | 110 | grows | EN + PT-BR 100% |
| Relationship rules | 10 | — | family-to-family reactions |

## Still to author (see CONTENT_ROADMAP.md)
- Bespoke behaviour for 16 furniture types.
- Unique per-location modules/hazards/secret rooms.
- 20 campaign milestones; 15+ secret interactions.
- Cosmetics toward 150+; furniture reaction lines toward 150+ vocal events.
- Remaining language translations to 100%.

> This file is the honest source of truth. Do not claim unimplemented content
> exists; update counts here when data is added.
