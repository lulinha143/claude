# Fonts

The game uses a deliberate **two-font** system for a handmade animal-office identity: an expressive display face paired with a readable body face. Both are bundled locally, require no runtime/CDN request, and work offline in the browser and packaged Electron app.

## Display typeface — DynaPuff

DynaPuff gives the brand, prominent titles, events, and primary actions an irregular hand-lettered voice without sacrificing the four-step display hierarchy.

- **Source:** [`@fontsource/dynapuff`](https://www.npmjs.com/package/@fontsource/dynapuff); its `.woff2` files are emitted with the production bundle.
- **License:** SIL Open Font License 1.1 (OFL), permitting commercial use, embedding, bundling, and redistribution with the application.
- **Weights bundled:** Latin 400, 500, 600, and 700.

DynaPuff is intentionally not used for dense body copy, numeric data, or the smallest control labels.

## Body typeface — Nunito

Nunito is used for descriptions, tooltips, instructions, compact labels, statistics, and numbers. Numeric roles enable tabular figures so changing counters do not jitter.

- **Source:** [`@fontsource/nunito`](https://www.npmjs.com/package/@fontsource/nunito).
- **License:** SIL Open Font License 1.1 (OFL).
- **Weights bundled:** Latin 400, 600, 700, and 800.

## How it is wired

- `src/main.tsx` imports only the Latin DynaPuff and Nunito production stylesheets. The Latin subset includes the accents needed by Portuguese, including `á`, `ã`, `ç`, `ê`, and `õ`.
- `src/ui/tokens.css` owns the family stacks, weights, fluid scale, and semantic caption/small/body/button/section/panel/event/hero/numeric roles.
- `src/styles.css` maps UI elements to those roles. Tiny labels use Nunito 700 because DynaPuff becomes crowded at compact sizes.
- `src/ui/fontStacks.ts` mirrors the same stacks for canvas-generated office photos and moment cards, where CSS custom properties are unavailable.
- The dyslexia-friendly setting replaces every semantic family with its accessible system stack.

## Comparison and decision record

`typography.html` is an internal, separate Vite entry used to compare real English and Portuguese UI roles at desktop and compact widths. It keeps rejected candidates out of the normal production entry bundle.

The comparison covered:

1. Fredoka + Nunito Sans (previous production baseline)
2. Baloo 2 + Nunito Sans
3. DynaPuff + Nunito (**selected**)
4. Sniglet + Atkinson Hyperlegible

DynaPuff + Nunito was selected because it best supports the warm, handmade, cute-animal-office identity while retaining readable dense UI and Portuguese accents. Baloo 2 remained too close to a generic mascot application; Sniglet felt toy-like and only provided 400/800, which did not fit the existing four-step display hierarchy.

Rejected candidates remain development-only dependencies solely for the comparison page. They must not be imported by the production entry.

## Accessibility fallback

The dyslexia-friendly option (`[data-dyslexia='true']`) overrides logo, display, body, compact, and numeric family tokens with the existing OpenDyslexic/Comic Sans/Trebuchet/Verdana system fallback stack.

## Adding or changing weights

1. Install or verify the relevant Fontsource package.
2. Import only the needed Latin weight in `src/main.tsx`.
3. Map it through the semantic tokens in `src/ui/tokens.css`; do not hard-code a component-only font stack.
4. Keep canvas exports synchronized through `src/ui/fontStacks.ts`.

Do not commit raw font binaries outside Fontsource packages, and do not fetch fonts from a CDN at runtime.

## History

Quicksand was the original single identity font. Fredoka + Nunito Sans introduced a display/body split, but remained visually generic. The rendered internal comparison then selected DynaPuff + Nunito for a more authored identity.
