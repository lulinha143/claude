# Localization Guide

All user-facing text uses keys resolved by `Loc.t("KEY")`. No hardcoded UI
strings in gameplay scripts.

## Where strings live

`content/localization/strings.csv` — first column is the key, then one column per
locale:

```
keys,en,pt_BR,es,fr,de,it,pl,ru,ja,ko,zh_CN,zh_TW
MENU_SETTINGS,Settings,Opções,,,,,,,,,,
```

Empty cells fall back to English at runtime (and `Loc.t` returns the key itself
if even English is missing, logging a dev-only warning).

## Using strings in code

```gdscript
label.text = Loc.t("WAREHOUSE_CONTRACTS")
hud.text = Loc.t("HUD_TARGETS_LOADED", {"loaded": 2, "total": 5})  # {name} args
Loc.t_plural("COUNT_FURNITURE", n)      # expects COUNT_FURNITURE.one/.other
Loc.format_int(12345)                    # locale-aware thousands separators
Loc.format_money(1200)                   # "$1,200" / "$1.200" etc.
```

## Launch languages

English and **Brazilian Portuguese are fully authored**. Spanish, French,
German, Italian, Polish, Russian, Japanese, Korean, Simplified & Traditional
Chinese are scaffolded (columns present) and fall back to English until
translated. CJK uses Godot's font fallback; long DE/RU strings are handled by
autowrap and UI scaling.

## Runtime switching & detection

Settings → Language. `"auto"` detects the system locale (`OS.get_locale()`),
matching exact then language-only. Changing locale re-emits
`EventBus.locale_changed` and screens rebuild their text.

## Translator workflow

1. Open `strings.csv` in a spreadsheet (UTF-8). Fill your locale's column.
2. Keep `{placeholders}` intact; localize by **meaning**, not literally —
   especially the comedy (incident lines, Boxy tips).
3. Run `make validate-localization` to see completeness per locale.
4. Enable **pseudo-localization** (Settings → Language) to catch overflow and
   untranslated strings during layout testing.

## Validation

`make validate-localization` fails CI if English or Brazilian Portuguese drops
below 100% and reports every other locale's percentage.
