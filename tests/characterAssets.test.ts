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
import { CHARACTER_PRESENCE_SCALE, presenceSize } from '../src/content/characterScale';

const PUBLIC = join(__dirname, '..', 'public');
const MANIFEST = join(__dirname, '..', 'assets', 'sources', 'characters', 'manifest.json');

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

  it('keeps the @2x animation at twice the @1x frame size', () => {
    for (const entry of CHARACTER_ART) {
      const files = entry.variants[entry.activeVersion]!;
      const two = pngInfo(files.src);
      // Encoders round, so allow a pixel of slack on each axis.
      expect(
        Math.abs(two.width - files.frameWidth * 2),
        `${entry.employee} @2x width`,
      ).toBeLessThanOrEqual(2);
      expect(
        Math.abs(two.height - files.frameHeight * 2),
        `${entry.employee} @2x height`,
      ).toBeLessThanOrEqual(2);
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

  it('anchors every character on its bottom edge so feet stay on the floor', () => {
    for (const entry of CHARACTER_ART) {
      const files = entry.variants[entry.activeVersion]!;
      expect(files.baseline, `${entry.employee} baseline`).toBe(0);
      expect(files.anchorX, `${entry.employee} anchorX`).toBe(0.5);
    }
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
