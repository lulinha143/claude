# Fonts

## Primary typeface — Quicksand

The game's cozy, rounded visual identity uses **Quicksand**.

- **Source:** bundled locally through the [`@fontsource/quicksand`](https://www.npmjs.com/package/@fontsource/quicksand)
  npm package (v5.x). Nothing is fetched at runtime — the `.woff2` files are part
  of the production bundle, so the game renders identically offline, in the
  browser, and in the packaged Electron app.
- **License:** SIL Open Font License 1.1 (OFL). This explicitly permits
  **commercial use, embedding, bundling and redistribution** as part of an
  application, which is exactly how it is used here.
- **Designer:** Andrew Paglinawan (and contributors).
- **Weights bundled:** 400 (body), 500 (emphasis), 600 (headings), 700 (display).
  Imported in `src/main.tsx`; the full OFL text ships inside
  `node_modules/@fontsource/quicksand/LICENSE`.

### How it's wired

- `src/main.tsx` imports the four weight stylesheets.
- `src/ui/tokens.css` sets `--font-display`, `--font-body`, and `--font-num` to
  prefer `'Quicksand'`, then falls back to a rounded system stack (Baloo 2,
  Fredoka, SF Pro Rounded, Segoe UI, system-ui) so text is always readable even
  before the webfont paints.
- Weight tokens cap at `--fw-heavy: 700` because Quicksand's heaviest weight is
  700 (no faux-bold is used).

### Accessibility fallback

The dyslexia-friendly option (`[data-dyslexia='true']`) overrides the family to a
system font stack (OpenDyslexic / Comic Sans MS / Verdana) and is unaffected by
Quicksand.

## Adding or changing weights

1. `npm install @fontsource/quicksand` is already a dependency.
2. Import the desired weight in `src/main.tsx`, e.g. `@fontsource/quicksand/300.css`.
3. Reference it via the weight tokens in `src/ui/tokens.css`.

Do not commit raw font binaries outside the Fontsource package, and do not fetch
fonts from a CDN at runtime (the app's CSP is `self`-only and the game must work
fully offline).
