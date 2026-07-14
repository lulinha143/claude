# Furniture Creation Guide

Furniture is fully data-driven. To add a new sentient object you edit **data**,
not gameplay scripts.

## 1. Add a definition to `content/furniture/furniture.json`

```json
{
  "id": "grandfather_clock",
  "name_key": "FURNITURE_CLOCK",
  "family": "decor",
  "weight": 60.0,
  "dimensions": [0.6, 2.0, 0.4],
  "fragility": 0.5,
  "value": 500,
  "min_carriers": 2,
  "mesh_kind": "box",
  "base_color": "#5a4326",
  "grip_points": [[-0.2, 0.9, 0], [0.2, 0.9, 0]],
  "mood_bias": 10,
  "traits": ["melancholic", "musical"],
  "paranormal": ["local_time_warp", "repeat_mistakes"],
  "hidden_traits": ["completely_unhinged"],
  "likes": ["punctuality"],
  "dislikes": ["being_late"],
  "calming_actions": ["comfort"],
  "escalating_actions": ["scold"],
  "audio_profile": "musical"
}
```

Field reference lives in `game/furniture/furniture_data.gd`. `mood_bias` values
are the `Emotions.E` enum indices (0 = Calm … 11 = Unhinged).

## 2. Reference only existing trait ids

Trait ids must exist in `content/traits/traits.json` or content validation
fails. Add new traits there first (id, category, name, description). Run:

```bash
make validate-content
```

## 3. (Optional) Add a distinct visual

`mesh_kind` selects a builder in `game/furniture/furniture_mesh_factory.gd`.
Unknown kinds fall back to a coloured, correctly-proportioned block with a face
(never a plain gray box). To add a real silhouette, add a `_build_<kind>` method
composing primitives, or later swap in an imported mesh (see
`docs/ASSET_REPLACEMENT_GUIDE.md`) — gameplay scripts don't change.

## 4. Behaviour

Generic behaviour (emotion decay, calming/escalation from `calming_actions` /
`escalating_actions` / likes/dislikes, faces at high arousal, agitation raising
instability) works automatically. For bespoke supernatural behaviour, add a
trait tag and a small handler in `FurnitureController._run_behaviours()` keyed by
`_has_trait("your_tag")` — this is where clingy/hungry/shy/afraid-of-dark live.
Keep it emergent and readable.

## 5. Localize the name/description

Add `FURNITURE_*` keys to `content/localization/strings.csv` (English + pt_BR
required). See `docs/LOCALIZATION_GUIDE.md`.

## 6. Test

Add an emotion/behaviour assertion to `test/unit` if the object introduces new
pure logic, then `make test`.
