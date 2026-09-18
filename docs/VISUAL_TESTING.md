# Visual & Interaction Testing

Unit tests and a green build are **not** sufficient evidence that a user-facing
screen is correct. This project uses Playwright to render the real production
build in a headless browser, drive it to each key screen, and capture PNGs for
inspection.

## Running

```bash
npx playwright install chromium          # one-time (browser binary)
npx playwright test tests/e2e/visual.spec.ts --project=chromium
```

Screenshots are written to `visual-artifacts/` (git-ignored). The harness uses
manual `page.screenshot()` calls (not `toHaveScreenshot`), so it needs no stored
baselines to run — it produces images a reviewer (or the agent) opens and
inspects directly.

On non-Ubuntu hosts the Chromium headless shell needs native libraries
(`nss`, `nspr`, `atk`, `at-spi2`, `libdrm`, `mesa-libgbm`, `libxkbcommon`,
`alsa-lib`, `cups-libs`, …). On Amazon Linux / Fedora: `dnf install` them (the
`nss` libs can be extracted from the RPM if the package scriptlet fails).

## Coverage

`tests/e2e/visual.spec.ts` seeds a rich save (deliberately an **old** schema
version, so it also exercises the v3→v5 migration on load) and captures:

- **Office** at 420×720, 480×800, 720×720, 960×720, 1280×720, 1920×1080,
  ultrawide 2560×1080, and a narrow 380×900.
- **Every major view** (Upgrades, Team, Company, Focus, Settings, Decorate) at a
  desktop and a compact size.
- **pt-BR** Office + Settings (localized-text layout check).

`tests/e2e/smoke.spec.ts` covers real interaction flows (onboarding, collect,
buy an upgrade, switch language, persistence, desktop-only controls disabled in
the browser).

## Findings from the first visual pass (and their fixes)

| Finding (seen in a screenshot)                                                                                         | Status                                                                  |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Team view rendered as a black frame** — crash on old saves missing later-added employees (`undefined.level`).        | **Fixed** — `repairEmployees` backfills on load; regression test added. |
| **"While You Were Away" modal fired for 0–6s reloads**, blocking the office every launch.                              | **Fixed** — `minModalSeconds` threshold; nuts still banked silently.    |
| `frame-ancestors` in the `<meta>` CSP logged a console warning.                                                        | **Fixed** — removed from meta (header-only directive).                  |
| Compact header wraps and the nav becomes horizontally scrollable.                                                      | Good.                                                                   |
| Ultrawide uses a centered max-width column (intentional cap) rather than stretching.                                   | By design.                                                              |
| Team profiles show portrait, bio, goal, friendship, **mood chip (emotion + ±% productivity)**, outfits, room dropdown. | Good — validates §13/§18 UI.                                            |
| Decorate catalog: room/type/currency filters, search, cards with morale, owned/placed/comfort summary.                 | Good.                                                                   |

## Known visual issue still open (needs a dedicated art/layout pass)

The **main Office** renders a rich pre-rendered isometric background image with
flat, dark translucent "room band" strips overlaid on top, and employees/props
drawn as comparatively small 2D sprites on those bands. The two layers do not
visually reconcile (the bands don't line up with the background's depicted
rooms), which reads as "assets pasted together." Making rooms feel like one
cohesive diorama — with characters and furniture at a scale that matches the
background — is a larger art + layout task tracked separately; it was **not**
attempted in this pass to avoid destabilizing a working scene without the art
pipeline to do it properly.
