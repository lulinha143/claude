// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { initI18n } from '../src/i18n';

describe('App renders without throwing', () => {
  let App: (typeof import('../src/App'))['App'];
  beforeAll(async () => {
    await initI18n('en');
    // Module transformation is setup, not part of the rendering assertion's budget.
    App = (await import('../src/App')).App;
  });

  it('mounts the HUD, the dock and the office scene', () => {
    const html = renderToStaticMarkup(<App />);
    // the HUD shelf with the company's logo sticker and the nut counter
    expect(html).toContain('class="hud"');
    expect(html).toContain('data-testid="company-logo"');
    expect(html).toContain('data-testid="hud-nuts"');
    // the dock is present and localized
    expect(html).toContain('class="dock"');
    expect(html).toContain('aria-label="Team"');
    expect(html).toContain('aria-label="Archive"');
    // the office diorama scene is the screen, inside the tree-trunk tower
    expect(html).toContain('office diorama');
    expect(html).toContain('office__trunk');
    expect(html).toContain('tree-canopy');
  });
});
