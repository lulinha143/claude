import type { EarType } from './Critter';

// Per-employee silhouette parameters so each has a distinct outline while
// sharing one drawing component.
export interface CritterShape {
  earType: EarType;
  hasTail: boolean;
  hasGlasses: boolean;
  hasBeak: boolean;
}

export const CRITTER_SHAPES: Record<string, CritterShape> = {
  pip: { earType: 'pointy', hasTail: true, hasGlasses: true, hasBeak: false },
  marlow: { earType: 'flat', hasTail: false, hasGlasses: false, hasBeak: false },
  rizzo: { earType: 'round', hasTail: true, hasGlasses: false, hasBeak: false },
  bea: { earType: 'round', hasTail: true, hasGlasses: false, hasBeak: false },
  corvus: { earType: 'flat', hasTail: false, hasGlasses: false, hasBeak: true },
  mina: { earType: 'round', hasTail: false, hasGlasses: true, hasBeak: false },
};

export function shapeFor(id: string): CritterShape {
  return CRITTER_SHAPES[id] ?? { earType: 'round', hasTail: false, hasGlasses: false, hasBeak: false };
}
