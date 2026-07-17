# Fonts

The game uses a deliberate **two-font** system for a handcrafted, cozy-office
identity — a chunky rounded display face paired with a highly readable body face.
Both are bundled locally (no runtime/CDN fetch; the CSP is `self`-only and the
game must work fully offline in the browser and the packaged Electron app).

## Display typeface — Fredoka

Brand/logo, popup and section titles, navigation, HUD, and buttons.

- **Source:** [`@fontsource/fredoka`](https://www.npmjs.com/package/@fontsource/fredoka)
  npm package. The `.woff2` files are part of the production bundle.
- **License:** SIL Open Font License 1.1 (OFL) — permits commercial use,
  embedding, bundling and redistribution as part of an application.
- **Designers:** Milena Brandão, Hafontia (and contributors).
- **Weights bundled:** 400, 500 (buttons), 600, 700 (titles/brand). Full OFL text
  ships in `node_modules/@fontsource/fredoka/LICENSE`.

## Body typeface — Nunito Sans

Descriptions, tooltips, labels, statistics and numbers (with tabular figures so
counters never jitter).

- **Source:** [`@fontsource/nunito-sans`](https://www.npmjs.com/package/@fontsource/nunito-sans).
- **License:** SIL Open Font License 1.1 (OFL).
- **Designers:** Vernon Adams, Jacques Le Bailly (and contributors).
- **Weights bundled:** 400 (body), 600, 700, 800. Full OFL text ships in
  `node_modules/@fontsource/nunito-sans/LICENSE`.

### How it's wired

- `src/main.tsx` imports the Fredoka + Nunito Sans weight stylesheets.
- `src/ui/tokens.css` sets `--font-display` (Fredoka first), `--font-body`
  (Nunito Sans first) and `--font-num` (Nunito Sans + tabular figures), each with
  a rounded/system fallback stack so text is readable before the webfont paints.
- `src/styles.css`: headings use `--font-head` (display) at `--fw-heavy`; buttons
  use the display face at `--fw-medium`; body copy, inputs and numbers use the
  body face.
- The Fontsource `latin` subset includes Latin-1 accents, so Portuguese
  (á ã ç ê õ …) and other supported locales render correctly.

### Accessibility fallback

The dyslexia-friendly option (`[data-dyslexia='true']`) overrides the family to a
system stack (OpenDyslexic / Comic Sans MS / Verdana) and is unaffected by the
display/body faces.

## Adding or changing weights

1. Install/verify the Fontsource package (`@fontsource/fredoka`,
   `@fontsource/nunito-sans` — both already dependencies).
2. Import the desired weight in `src/main.tsx` (e.g. `@fontsource/fredoka/300.css`).
3. Reference it via the weight tokens in `src/ui/tokens.css`.

Do not commit raw font binaries outside the Fontsource packages, and do not fetch
fonts from a CDN at runtime.

## History

Quicksand was the original single identity font; it was replaced by the
Fredoka + Nunito Sans pairing to give the UI a clearer, more art-directed
personality (display vs. body hierarchy).
