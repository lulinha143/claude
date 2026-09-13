import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  CHARACTER_ART,
  CHARACTER_ART_BY_EMPLOYEE,
  activeArtVersion,
  characterArt,
} from '../src/art/characterAssets';
import { EMPLOYEE_SPRITES, employeeSprite } from '../src/art/employeeSprites';
import { EMPLOYEES_BY_ID } from '../src/content/employees';
import { CRITTER_SHAPES } from '../src/art/critterShapes';
import {
  CHARACTER_PRESENCE_SCALE,
  VECTOR_CRITTER_CARD_SIZE,
  VECTOR_CRITTER_FIGURE_FRACTION,
  VECTOR_CRITTER_OFFICE_SIZE,
  presenceSize,
} from '../src/content/characterScale';

const PUBLIC = join(__dirname, '..', 'public');
const CHARACTER_SOURCES = join(__dirname, '..', 'assets', 'sources', 'characters');
const MANIFEST = join(CHARACTER_SOURCES, 'manifest.json');

interface MeasuredFigure {
  canvasWidth: number;
  canvasHeight: number;
  figureHeight: number;
  figureHeightFraction: number;
  bottomPadFraction: number;
  figureCentreX: number;
}

/** Measured by `scripts/measure-character-figures.py` off the shipped artwork. */
const FIGURE_METRICS: {
  reference: string;
  characters: Record<string, MeasuredFigure>;
  derived: Record<string, { officeHeight: number; baseline: number; anchorX: number }>;
} = JSON.parse(readFileSync(join(CHARACTER_SOURCES, 'figure-metrics.json'), 'utf8'));

/**
 * How tall the animal itself renders in the office, in CSS px. This — not the
 * canvas height — is what a player compares between two characters standing
 * next to each other.
 */
function renderedFigureHeight(employee: string): number {
  return (
    EMPLOYEE_SPRITES[employee].officeHeight *
    FIGURE_METRICS.characters[employee].figureHeightFraction
  );
}

/** Read a PNG's IHDR dimensions and whether it carries an animation chunk. */
function pngInfo(rel: string): { width: number; height: number; animated: boolean } {
  const buf = readFileSync(join(PUBLIC, rel));
  expect(buf.readUInt32BE(0), `${rel} PNG signature`).toBe(0x89504e47);
  // IHDR is always the first chunk: 8-byte signature + 4 length + 4 type.
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height, animated: buf.includes(Buffer.from('acTL')) };
}

describe('character art registry integrity', () => {
  it('registers every animal against a real employee', () => {
    for (const entry of CHARACTER_ART) {
      expect(EMPLOYEES_BY_ID[entry.employee], `${entry.employee} is not an employee`).toBeDefined();
    }
  });

  it('uses unique employee ids', () => {
    const ids = CHARACTER_ART.map((e) => e.employee);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // This is the guard against the failure mode the brief called out explicitly:
  // the cat wearing the owl's artwork because two files sorted next to each other.
  it('matches the species recorded in the critter registry', () => {
    for (const entry of CHARACTER_ART) {
      const shape = CRITTER_SHAPES[entry.employee];
      expect(shape, `${entry.employee} has no critter shape`).toBeDefined();
      expect(shape.species, `${entry.employee} art/species mismatch`).toBe(entry.species);
    }
  });

  it('names its asset files after the employee, so a mismatch is visible', () => {
    for (const entry of CHARACTER_ART) {
      const files = entry.variants[entry.activeVersion];
      expect(files, `${entry.employee} has no active variant`).toBeDefined();
      expect(files!.src, `${entry.employee} src`).toContain(entry.employee);
      expect(files!.poster, `${entry.employee} poster`).toContain(entry.employee);
    }
  });

  it('always has a usable variant for its active version', () => {
    for (const entry of CHARACTER_ART) {
      expect(entry.variants[entry.activeVersion], entry.employee).toBeDefined();
      expect(characterArt(entry.employee)).toBeDefined();
      expect(activeArtVersion(entry.employee)).toBeTruthy();
    }
  });

  it('reports nothing for an unknown employee', () => {
    expect(characterArt('not-an-animal')).toBeUndefined();
    expect(activeArtVersion('not-an-animal')).toBeUndefined();
  });

  // THE COMPLETENESS GUARD.
  //
  // The cast is 23 animals and every one of them has real artwork; the bear was the
  // last to land. The failure mode this exists to catch is an animal being quietly
  // dropped — an employee added without art, or an art entry deleted — because the
  // consequence is not a crash but a character who silently degrades to the vector
  // critter and stands out against a photographic cast. That is exactly what the
  // bear did for the whole of 2.0, and it went unnoticed because nothing failed.
  //
  // Deliberately asserted BOTH ways: every employee has art, and every art entry has
  // an employee. A count alone would let an addition and a removal cancel out.
  it('gives every single employee real artwork, with nobody left on the fallback', () => {
    const employees = Object.keys(EMPLOYEES_BY_ID).sort();
    const registered = CHARACTER_ART.map((e) => e.employee).sort();
    expect(registered).toEqual(employees);
    for (const id of employees) {
      expect(characterArt(id), `${id} has no registered artwork`).toBeDefined();
    }
  });
});

describe('character art files on disk', () => {
  it('ships every registered animation and poster', () => {
    for (const entry of CHARACTER_ART) {
      const files = entry.variants[entry.activeVersion]!;
      for (const rel of [files.src, files.src1x, files.poster].filter(Boolean) as string[]) {
        expect(existsSync(join(PUBLIC, rel)), `missing ${rel}`).toBe(true);
      }
    }
  });

  // The geometry contract: frameWidth/frameHeight are the ONLY source of a
  // sprite's aspect ratio, and EmployeeSprite derives width from height through
  // them. If they drift from the real @1x file, characters render distorted.
  it('declares frame dimensions that match the real @1x file', () => {
    for (const entry of CHARACTER_ART) {
      const files = entry.variants[entry.activeVersion]!;
      if (!files.src1x) continue;
      const info = pngInfo(files.src1x);
      expect(info.width, `${entry.employee} frameWidth`).toBe(files.frameWidth);
      expect(info.height, `${entry.employee} frameHeight`).toBe(files.frameHeight);
    }
  });

  // The @2x animation used to be exactly twice the @1x frame size, and that is no
  // longer true by design: @1x is now encoded at the character's real display height
  // (officeHeight * presence) while the @2x build is left untouched at twice
  // officeHeight. So what must hold is that the registry states the @2x file's REAL
  // size — that is what the renderer divides to declare its srcSet density, and a
  // wrong number there talks the browser into the wrong candidate.
  it('declares the @2x animation at its real size on disk', () => {
    for (const entry of CHARACTER_ART) {
      const files = entry.variants[entry.activeVersion]!;
      const two = pngInfo(files.src);
      expect(two.width, `${entry.employee} srcWidth`).toBe(files.srcWidth);
      expect(two.height, `${entry.employee} srcHeight`).toBe(files.srcHeight);
      // It must still be the denser of the two candidates, or serving it to a HiDPI
      // display would be pointless.
      expect(files.srcHeight, `${entry.employee} @2x density`).toBeGreaterThan(files.frameHeight);
    }
  });

  // The sharpness contract: the @1x asset is encoded at the size it is actually drawn
  // at, so a DPR-1 display resamples nothing. See tests/spriteResampling.test.ts.
  it('encodes @1x at exactly the rendered height', () => {
    for (const entry of CHARACTER_ART) {
      const files = entry.variants[entry.activeVersion]!;
      expect(files.frameHeight, `${entry.employee} @1x height`).toBe(
        presenceSize(files.officeHeight),
      );
    }
  });

  it('keeps every animation animated and every poster still', () => {
    for (const entry of CHARACTER_ART) {
      const files = entry.variants[entry.activeVersion]!;
      expect(pngInfo(files.src).animated, `${files.src} must stay animated`).toBe(true);
      if (files.src1x) expect(pngInfo(files.src1x).animated, files.src1x).toBe(true);
      expect(pngInfo(files.poster).animated, `${files.poster} must be a still`).toBe(false);
    }
  });
});

describe('rendered character scale', () => {
  it('applies the presence multiplier to rendered heights only', () => {
    for (const entry of CHARACTER_ART) {
      const files = entry.variants[entry.activeVersion]!;
      const config = EMPLOYEE_SPRITES[entry.employee];
      expect(config, entry.employee).toBeDefined();
      // Rendered heights scale...
      expect(config.officeHeight).toBe(presenceSize(files.officeHeight));
      expect(config.cardHeight).toBe(presenceSize(files.cardHeight));
      // ...while the aspect-ratio source must NOT, or Pip gets squashed again.
      expect(config.frameWidth).toBe(files.frameWidth);
      expect(config.frameHeight).toBe(files.frameHeight);
    }
  });

  it('renders every character about 20% larger than its authored height', () => {
    expect(CHARACTER_PRESENCE_SCALE).toBeCloseTo(1.2, 5);
    for (const entry of CHARACTER_ART) {
      const files = entry.variants[entry.activeVersion]!;
      const config = EMPLOYEE_SPRITES[entry.employee];
      const ratio = config.officeHeight / files.officeHeight;
      expect(ratio, `${entry.employee} presence ratio`).toBeGreaterThan(1.15);
      expect(ratio, `${entry.employee} presence ratio`).toBeLessThan(1.25);
    }
  });

  it('keeps every character in a harmonious size band', () => {
    const heights = CHARACTER_ART.map((e) => EMPLOYEE_SPRITES[e.employee].officeHeight);
    const min = Math.min(...heights);
    const max = Math.max(...heights);
    // Nobody should tower over the room or vanish next to a neighbour.
    expect(max / min, 'character size spread').toBeLessThan(1.5);
  });

  // THE cast-consistency guarantee, and the reason the three figure fields exist.
  //
  // Sizing a character by its canvas height silently assumed every canvas frames
  // its animal equally tightly. They do not: Pip's fills 98.9% of her canvas and
  // Corvus' fills 89.0%, so equal canvases drew unequal animals — and made Pip,
  // the intended reference, the smallest figure on the roster. What has to hold is
  // that the VISIBLE FIGURES match, which is what this asserts.
  it('renders every animal at the reference figure height', () => {
    const target = renderedFigureHeight('pip');
    for (const entry of CHARACTER_ART) {
      const rendered = renderedFigureHeight(entry.employee);
      expect(
        Math.abs(rendered - target) / target,
        `${entry.employee} figure height ${rendered.toFixed(1)}px vs Pip's ${target.toFixed(1)}px`,
      ).toBeLessThan(0.02);
    }
  });

  // The registry is derived data. If the artwork is ever re-encoded or re-cropped,
  // re-running the measurement script is the fix — and until it is re-run, this
  // fails rather than letting the cast quietly drift out of scale again.
  it('matches the measured artwork it was derived from', () => {
    for (const entry of CHARACTER_ART) {
      const files = entry.variants[entry.activeVersion]!;
      const expected = FIGURE_METRICS.derived[entry.employee];
      expect(expected, `${entry.employee} has no measured figure metrics`).toBeDefined();
      expect(files.officeHeight, `${entry.employee} officeHeight`).toBe(expected.officeHeight);
      expect(files.baseline, `${entry.employee} baseline`).toBeCloseTo(expected.baseline, 5);
      expect(files.anchorX, `${entry.employee} anchorX`).toBeCloseTo(expected.anchorX, 5);
    }
  });

  // The figures are measured off the @2x build, not the @1x one. That is deliberate:
  // the @1x asset's height is now a FUNCTION of `officeHeight`, so deriving
  // `officeHeight` from it would close the loop and make each re-encode nudge the
  // value by a pixel forever. The @2x build is never re-encoded, so measuring it makes
  // these numbers a fixed property of the artwork (and finds the figure edge in four
  // times the pixels). Every value consumed is a FRACTION, so the resolution it was
  // measured at does not matter — only that it is stable.
  it('measures the figures against the retained @2x artwork', () => {
    expect(FIGURE_METRICS.reference).toBe('pip');
    for (const entry of CHARACTER_ART) {
      const files = entry.variants[entry.activeVersion]!;
      const measured = FIGURE_METRICS.characters[entry.employee];
      expect(measured, `${entry.employee} was not measured`).toBeDefined();
      // A measurement taken against a different canvas than the one we ship would
      // make every number above meaningless.
      expect(measured.canvasWidth, `${entry.employee} measured width`).toBe(files.srcWidth);
      expect(measured.canvasHeight, `${entry.employee} measured height`).toBe(files.srcHeight);
      // The figure must genuinely be inside its canvas.
      expect(measured.figureHeight).toBeGreaterThan(0);
      expect(measured.figureHeight).toBeLessThanOrEqual(measured.canvasHeight);
    }
  });

  // Pip's rendering is regression-sensitive: her build is hand-repaired and her
  // geometry is what everything else is normalised against. Normalising the cast
  // must not have moved her.
  it('leaves the reference character untouched', () => {
    const pip = CHARACTER_ART_BY_EMPLOYEE.pip.variants.original!;
    // The LAYOUT numbers are what "untouched" means, and they are unchanged: Pip is
    // still the 93px reference, and her canvas already hugs her so it needs no
    // baseline compensation. Her @1x frame is now 112px because that is her true
    // display height (93 * 1.2) — the display-size re-encode, which sharpened her
    // without redrawing anything and without going near her defective master.
    expect(pip.officeHeight).toBe(93);
    expect(pip.baseline).toBe(0);
    expect(pip.frameHeight).toBe(presenceSize(93));
    expect(pip.frameHeight).toBe(112);
    // Her artwork still comes from the hand-repaired @2x build, untouched at 186px.
    expect(pip.srcHeight).toBe(186);
  });

  it('sinks a sprite by exactly the dead margin under its feet', () => {
    for (const entry of CHARACTER_ART) {
      const files = entry.variants[entry.activeVersion]!;
      const measured = FIGURE_METRICS.characters[entry.employee];
      // Baseline is a downward shift, so it may never exceed the padding that is
      // actually there — overshooting would bury the animal in the floorboards.
      expect(files.baseline, `${entry.employee} baseline`).toBeGreaterThanOrEqual(0);
      expect(files.baseline, `${entry.employee} baseline`).toBeCloseTo(
        measured.bottomPadFraction,
        5,
      );
    }
  });

  // Every employee now has photographic artwork, so the code-drawn critters are no
  // longer a roster gap — but they are still the load-failure fallback (see
  // tests/spriteAvailability.test.ts), so a critter can appear beside a photographic
  // animal at any time and still has to belong to the same cast scale. Before this
  // was normalised they rendered a third smaller, which read as "some characters are
  // tiny" rather than as a fallback.
  it('draws the code-drawn fallback critters at the same figure height', () => {
    const target = renderedFigureHeight('pip');
    const vector = VECTOR_CRITTER_OFFICE_SIZE * VECTOR_CRITTER_FIGURE_FRACTION;
    expect(Math.abs(vector - target) / target, 'vector critter figure height').toBeLessThan(0.02);
  });

  it('keeps the fallback portrait in step with sprite portraits', () => {
    // Same card-to-office ratio as the sprite registry, so an employee's portrait
    // does not change size the day their artwork lands.
    const ratio = VECTOR_CRITTER_CARD_SIZE / VECTOR_CRITTER_OFFICE_SIZE;
    expect(ratio).toBeGreaterThan(1.38);
    expect(ratio).toBeLessThan(1.48);
  });

  it('resolves a sprite for every registered animal', () => {
    for (const entry of CHARACTER_ART) {
      expect(employeeSprite(entry.employee), entry.employee).toBeDefined();
    }
  });
});

describe('master artwork provenance', () => {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as {
    characters: Array<{
      employee: string;
      species: string;
      sourceFile: string;
      driveId: string;
      officeHeight: number;
      skipImport?: boolean;
      skipReason?: string;
    }>;
  };

  it('records provenance for every registered animal', () => {
    for (const entry of CHARACTER_ART) {
      const record = manifest.characters.find((c) => c.employee === entry.employee);
      expect(record, `no manifest entry for ${entry.employee}`).toBeDefined();
      expect(record!.driveId, `${entry.employee} driveId`).toMatch(/^[\w-]{20,}$/);
      expect(record!.sourceFile).toMatch(/\.png$/i);
    }
  });

  it('agrees with the registry about species', () => {
    for (const record of manifest.characters) {
      const entry = CHARACTER_ART_BY_EMPLOYEE[record.employee];
      if (!entry) continue;
      expect(record.species, `${record.employee} manifest species`).toBe(entry.species);
    }
  });

  it('explains any character whose master is deliberately not re-imported', () => {
    for (const record of manifest.characters) {
      if (!record.skipImport) continue;
      // A skip is a decision, and a decision needs its reason recorded.
      expect(record.skipReason, `${record.employee} skip needs a reason`).toBeTruthy();
      expect(record.skipReason!.length).toBeGreaterThan(40);
    }
  });

  it('keeps Pip on the repaired build rather than the raw master', () => {
    const pip = manifest.characters.find((c) => c.employee === 'pip')!;
    // The raw master still carries the alpha defect that caused the halo shimmer,
    // so re-importing it would reintroduce a bug fixed on real hardware.
    expect(pip.skipImport).toBe(true);
    expect(CHARACTER_ART_BY_EMPLOYEE.pip.variants.original?.note).toMatch(/repaired/i);
  });
});
