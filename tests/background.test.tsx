// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { initI18n } from '../src/i18n';
import { getGameState } from '../src/state/store';
import { OfficeBackground } from '../src/art/OfficeBackground';

function render(visible = true) {
  return renderToStaticMarkup(<OfficeBackground visible={visible} />);
}

describe('OfficeBackground', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(() => {
    // restore defaults
    const s = getGameState().settings;
    s.reducedMotion = false;
    s.background.enabled = true;
    s.background.quality = 'high';
  });

  it('plays the optimized video when animation is allowed', () => {
    const html = render(true);
    expect(html).toContain('<video');
    expect(html).toContain('office-main-loop.mp4');
    expect(html).toContain('office-bg'); // container present
  });

  it('is decorative and never intercepts clicks', () => {
    // pointer-events:none comes from the .office-bg class (styles.css)
    const html = render(true);
    expect(html).toContain('class="office-bg is-visible"');
    expect(html).toContain('aria-hidden');
  });

  it('shows the static poster (not the video) in Reduced Motion', () => {
    getGameState().settings.reducedMotion = true;
    const html = render(true);
    expect(html).not.toContain('<video');
    expect(html).toContain('office-main-poster.jpg');
  });

  it('shows the static poster in the Battery-Saver (static) quality preset', () => {
    getGameState().settings.background.quality = 'static';
    const html = render(true);
    expect(html).not.toContain('<video');
    expect(html).toContain('office-main-poster.jpg');
  });

  it('shows the poster when the animated background is disabled', () => {
    getGameState().settings.background.enabled = false;
    const html = render(true);
    expect(html).not.toContain('<video');
    expect(html).toContain('office-main-poster.jpg');
  });

  it('hides (opacity) when not on the Office tab but stays mounted', () => {
    const html = render(false);
    expect(html).toContain('class="office-bg "'); // not is-visible
    expect(html).toContain('office-bg__media');
  });
});
