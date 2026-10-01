# Localization Guide

The game ships with complete **English** and **Brazilian Portuguese**, plus draft
files for Spanish, French, German, Italian, Polish, Russian, Japanese, Korean,
Simplified Chinese, and Traditional Chinese. Draft locales translate metadata and
key UI strings and **fall back to English** for everything else.

## How it works

- Powered by **i18next** + **react-i18next** with a browser language detector
  (`src/i18n/index.ts`).
- `fallbackLng: 'en'`, `load: 'currentOnly'` so region tags like `pt-BR` are kept.
- Every user-facing string is a key. There is **no hardcoded text** in gameplay
  components. Numbers/dates are formatted with `Intl` (locale-aware); pluralization
  uses i18next's plural rules.
- Language auto-detects on first run; the player can switch instantly in
  **Settings → Language**, and the choice persists (`localStorage: wmno.lang`).

## Files

```
src/i18n/locales/
  en.json      ← source of truth (complete)
  pt-BR.json   ← complete
  es|fr|de|it|pl|ru|ja|ko|zh-CN|zh-TW.json  ← draft, English fallback
```

Each file starts with `_meta`:

```json
{ "_meta": { "name": "Español", "complete": false, "note": "Draft / machine-assisted." } }
```

Set `complete: true` only when the file has every English key.

## Dialogue

Character/idle/event dialogue is stored as arrays under `dialogue.<category>`. The
number of lines per category is declared in `src/content/dialogue.ts`
(`DIALOGUE_COUNTS`) so the checker can verify every complete locale has the right
count. The selector (`src/sim/dialogue.ts`) picks an index with recency avoidance;
the UI resolves the localized string.

## Completeness checker

```bash
npm run check:i18n
```

- **Fails** if a locale marked `complete` is missing any English key, or if a
  complete locale has the wrong dialogue line counts.
- **Warns** (non-fatal) for draft locales, reporting a coverage percentage.

In development, missing keys simply fall back to English (i18next default) and are
surfaced by the checker rather than crashing the UI.

## Adding a new language

1. Copy `en.json` to `src/i18n/locales/<lang>.json` and translate.
2. Import and register it in `src/i18n/index.ts` (`resources` + `SUPPORTED_LANGUAGES`).
3. Set `_meta.complete` appropriately.
4. Run `npm run check:i18n`.

## pt-BR glossary

Use these terms everywhere (HUD, dock, sheets, events, tooltips). Sentence case for
titles and buttons; curly quotes (“ ”) in prose.

| English                                           | pt-BR                                               | Notes                                              |
| ------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------- |
| Nuts                                              | castanhas                                           | lower case in prose; the HUD shows only the number |
| Golden Nuts                                       | Castanhas Douradas                                  | premium currency, always capitalised               |
| Permanent Kernels                                 | Grãos Permanentes                                   | prestige currency                                  |
| Morale                                            | Ânimo                                               |                                                    |
| Reputation                                        | Reputação                                           |                                                    |
| Team · Upgrades · Decorate · Activities · Archive | Equipe · Melhorias · Decorar · Atividades · Arquivo | the dock                                           |
| Settings                                          | Ajustes                                             | the HUD gear                                       |
| Focus Harvest                                     | Colheita de Foco                                    |                                                    |
| minigames                                         | minijogos                                           |                                                    |
| Prestige                                          | Prestígio                                           |                                                    |

Characters keep one localized name each (`employee.<id>.name`): Pip is **Tico** in
pt-BR, Marlow is Bento, Rizzo is Nino, Bea is Bia, and so on. Never mix the English
and Portuguese name inside the pt-BR file. Known clash to resolve in the pt-BR
editorial pass: `rizzo`/`nino` are both “Nino” and `bea`/`bia` are both “Bia”.

## Notes for translators

- German and Russian strings can be long — UI layouts use wrapping/flex and were
  built to tolerate this; still, prefer concise phrasing for small-window buttons.
- CJK languages render via the system font stack (CJK-capable fallback).
- Keep humor understandable after translation; localize jokes rather than
  translating literally where needed.
