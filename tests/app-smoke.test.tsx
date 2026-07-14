// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { initI18n } from '../src/i18n';

describe('App renders without throwing', () => {
  beforeAll(async () => {
    await initI18n('en');
  });

  it('mounts the header, nav and office scene', async () => {
    // Import after i18n init so react-i18next has the instance ready.
    const { App } = await import('../src/App');
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
