import { describe, it, expect } from 'vitest';
import { DECORATIONS } from '../src/content/decorations';
import {
  DECORATION_PLACEMENT,
  placementSpec,
  auditPlacementSpecs,
} from '../src/content/placementSpecs';
import { REGION_KIND_SURFACE } from '../src/sim/placementRegions';
import { projectSurfaceType } from '../src/sim/surfaces';
import { footprint } from '../src/sim/placement';

describe('per-decoration placement specifications', () => {
  it('gives every catalogue decoration an explicit, intentional spec', () => {
    expect(auditPlacementSpecs()).toEqual([]);
    expect(Object.keys(DECORATION_PLACEMENT).length).toBe(DECORATIONS.length);
  });

  it('keeps every footprint, baseline, scale and clearance sane and normalized', () => {
    for (const def of DECORATIONS) {
      const s = placementSpec(def.id);
      expect(s.footprint.width, def.id).toBeGreaterThan(0);
      expect(s.footprint.width, def.id).toBeLessThanOrEqual(0.5);
      expect(s.footprint.height, def.id).toBeGreaterThan(0);
      expect(s.footprint.height, def.id).toBeLessThanOrEqual(0.4);
      expect(s.baseline, def.id).toBeGreaterThanOrEqual(0);
      expect(s.baseline, def.id).toBeLessThanOrEqual(1);
      expect(s.scale, def.id).toBeGreaterThan(0.5);
      expect(s.scale, def.id).toBeLessThanOrEqual(1.5);
      expect(s.minClearance, def.id).toBeGreaterThanOrEqual(0);
      expect(['base', 'center', 'hanging'], def.id).toContain(s.anchor);
    }
  });

  it('aligns each item anchor with its single placement surface', () => {
    for (const def of DECORATIONS) {
      const s = placementSpec(def.id);
      const surface = projectSurfaceType(REGION_KIND_SURFACE[def.defaultRegionKind]);
      // Wall pieces mount at their centre, ceiling pieces hang, floor pieces
      // (including flat rugs) stand on a base.
      if (surface === 'wall') expect(s.anchor, def.id).toBe('center');
      if (surface === 'ceiling') expect(s.anchor, def.id).toBe('hanging');
      if (surface === 'floor') expect(s.anchor, def.id).toBe('base');
    }
  });

  it('drives footprint() from the spec (large items are bigger than small ones)', () => {
    expect(footprint('safe').w).toBe(DECORATION_PLACEMENT['safe'].footprint.width);
    expect(footprint('billboard').w).toBeGreaterThan(footprint('security-cam').w);
    expect(footprint('nut-statue').h).toBeGreaterThan(footprint('label-maker').h);
  });

  it('marks flat rugs as scenery-overlapping and gives them a low baseline', () => {
    for (const id of ['tiny-rug', 'gold-carpet']) {
      const s = placementSpec(id);
      expect(s.allowSceneryOverlap, id).toBe(true);
      expect(s.footprint.width, id).toBeGreaterThan(0.3);
      expect(s.footprint.height, id).toBeLessThan(0.1);
    }
  });
});
