// Per-employee species + accessory definitions. Each employee is drawn as a
// genuinely different animal (distinct head, body, ears, tail, limbs) by the
// Critter component, not a recoloured template.

export type CritterSpecies =
  | 'squirrel'
  | 'capybara'
  | 'raccoon'
  | 'beaver'
  | 'crow'
  | 'mole'
  | 'mouse'
  | 'otter'
  | 'hedgehog'
  | 'rabbit'
  | 'owl'
  | 'fox'
  // third wave — new roster animals (fallback silhouettes; some also have
  // final animated workstation sprites registered in employeeSprites.ts).
  | 'penguin'
  | 'redpanda'
  | 'cat'
  | 'bear'
  | 'frog'
  | 'sloth'
  | 'octopus'
  | 'bat'
  | 'flamingo'
  | 'platypus'
  | 'axolotl';

export interface CritterShape {
  species: CritterSpecies;
  hasGlasses: boolean;
}

export const CRITTER_SHAPES: Record<string, CritterShape> = {
  pip: { species: 'squirrel', hasGlasses: true },
  marlow: { species: 'capybara', hasGlasses: false },
  rizzo: { species: 'raccoon', hasGlasses: false },
  bea: { species: 'beaver', hasGlasses: false },
  corvus: { species: 'crow', hasGlasses: false },
  mina: { species: 'mole', hasGlasses: true },
  // second wave
  nixie: { species: 'mouse', hasGlasses: true },
  otto: { species: 'otter', hasGlasses: false },
  hazel: { species: 'hedgehog', hasGlasses: true },
  junie: { species: 'rabbit', hasGlasses: false },
  moss: { species: 'owl', hasGlasses: true },
  fenn: { species: 'fox', hasGlasses: false },
  // third wave — Pingo (penguin) and Canela (red panda) also have final
  // animated sprites; the rest use the code-drawn fallback silhouette.
  pingo: { species: 'penguin', hasGlasses: false },
  canela: { species: 'redpanda', hasGlasses: true },
  nino: { species: 'cat', hasGlasses: false },
  bia: { species: 'bear', hasGlasses: false },
  quincy: { species: 'frog', hasGlasses: false },
  dorm: { species: 'sloth', hasGlasses: false },
  inky: { species: 'octopus', hasGlasses: false },
  echo: { species: 'bat', hasGlasses: false },
  rosa: { species: 'flamingo', hasGlasses: false },
  perry: { species: 'platypus', hasGlasses: false },
  axel: { species: 'axolotl', hasGlasses: false },
};

export function shapeFor(id: string): CritterShape {
  return CRITTER_SHAPES[id] ?? { species: 'squirrel', hasGlasses: false };
}
