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

  it('mounts the header, nav and office scene', () => {
    const html = renderToStaticMarkup(<App />);
    // header + company name
    expect(html).toContain('header__company');
    expect(html).toContain('Nutshell Inc.');
    // navigation is present and localized
    expect(html).toContain('class="nav"');
    // the office diorama scene rendered
    expect(html).toContain('office diorama');
    // the redesigned tree-trunk frame is present
    expect(html).toContain('office__frame');
  });
});
