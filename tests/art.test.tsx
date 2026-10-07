import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Critter } from '../src/art/Critter';
import type { CritterSpecies } from '../src/art/critterShapes';
import { CRITTER_SHAPES } from '../src/art/critterShapes';
import { Icon, type IconName } from '../src/art/UiIcon';
import type { CritterState } from '../src/art/animation';
import { CompanySign, TreeBranches } from '../src/art/TreeWorld';

const SPECIES: CritterSpecies[] = [
  'squirrel',
  'capybara',
  'raccoon',
  'beaver',
  'crow',
  'mole',
  'mouse',
  'otter',
  'hedgehog',
  'rabbit',
  'owl',
  'fox',
];
const STATES: CritterState[] = [
  'idle',
  'sorting',
  'typing',
  'celebrate',
  'panic',
  'sleep',
  'talk',
  'coffee',
];

describe('Critter art', () => {
  it('renders a valid, labelled SVG for every species without throwing', () => {
    for (const species of SPECIES) {
      const html = renderToStaticMarkup(
        <Critter species={species} color="#c65b3c" accent="#3f7d4f" state="idle" title="Test" />,
      );
      expect(html).toContain('<svg');
      expect(html).toContain(`critter--${species}`);
      expect(html).toContain('<title>Test</title>');
      // contact shadow grounds every character
      expect(html).toContain('critter__shadow');
    }
  });

  it('renders every animation state for every species', () => {
    for (const species of SPECIES) {
      for (const state of STATES) {
        const html = renderToStaticMarkup(
          <Critter species={species} color="#9b7653" accent="#d8b48a" state={state} />,
        );
        expect(html).toContain(`critter--${state}`);
      }
    }
  });

  it('reduced motion pins the state to idle and omits blink timing', () => {
    const html = renderToStaticMarkup(
      <Critter
        species="squirrel"
        color="#c65b3c"
        accent="#3f7d4f"
        state="celebrate"
        reducedMotion
      />,
    );
    expect(html).toContain('critter--idle');
    expect(html).not.toContain('--blink-delay');
  });

  it('every configured employee species is renderable', () => {
    for (const shape of Object.values(CRITTER_SHAPES)) {
      const html = renderToStaticMarkup(
        <Critter
          species={shape.species}
          color="#4a3f35"
          accent="#ffb14e"
          state="idle"
          hasGlasses={shape.hasGlasses}
        />,
      );
      expect(html).toContain('<svg');
    }
  });
});

describe('UI icons', () => {
  const NAMES: IconName[] = [
    'nut',
    'paw',
    'golden',
    'kernel',
    'morale',
    'reputation',
    'production',
    'automation',
    'employees',
    'rooms',
    'shop',
    'decorate',
    'company',
    'coffee',
    'focus',
    'quiet',
    'sound',
    'music',
    'ambience',
    'sfx',
    'save',
    'import',
    'export',
    'achievements',
    'stats',
    'encyclopedia',
    'prestige',
    'settings',
    'accessibility',
    'photo',
    'moment',
    'daily',
    'minigame',
    'notification',
    'warning',
    'success',
    'error',
    'lock',
    'hidden',
    'close',
    'back',
  ];

  it('renders every named icon as an svg using currentColor', () => {
    for (const name of NAMES) {
      const html = renderToStaticMarkup(<Icon name={name} />);
      expect(html).toContain('<svg');
      expect(html).toContain('stroke="currentColor"');
    }
  });

  it('exposes an accessible label when a title is provided', () => {
    const html = renderToStaticMarkup(<Icon name="settings" title="Settings" />);
    expect(html).toContain('role="img"');
    expect(html).toContain('<title>Settings</title>');
  });
});

describe('Tree around the company', () => {
  const branchCount = (html: string) => (html.match(/class="tree-branch /g) ?? []).length;

  it('grows one branch per floor along the trunk, up to seven', () => {
    expect(branchCount(renderToStaticMarkup(<TreeBranches floors={1} />))).toBe(1);
    expect(branchCount(renderToStaticMarkup(<TreeBranches floors={2} />))).toBe(2);
    expect(branchCount(renderToStaticMarkup(<TreeBranches floors={12} />))).toBe(7);
  });

  it('keeps a young tree’s branches on its trunk instead of up in the sky', () => {
    const html = renderToStaticMarkup(<TreeBranches floors={2} />);
    // Spread over the trunk's own height: centred on halves of it, not 6%…84% of the window.
    expect(html).toContain('top:calc(25.0% - 60px)');
    expect(html).toContain('top:calc(75.0% - 60px)');
    expect(html).toContain('tree-branch--left');
    expect(html).toContain('tree-branch--right');
  });

  it('puts the player’s own company name on the rooftop sign', () => {
    const html = renderToStaticMarkup(
      <CompanySign
        name="Acorn Holdings"
        department="Behavioural Research"
        label="Acorn Holdings: open the company file"
        onOpen={() => undefined}
      />,
    );
    expect(html).toContain('Acorn Holdings');
    expect(html).toContain('Behavioural Research');
    expect(html).toContain('aria-label="Acorn Holdings: open the company file"');
  });
});
