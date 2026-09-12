// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { EmployeeSprite } from '../src/art/EmployeeSprite';
import { employeeSprite } from '../src/art/employeeSprites';
import { presenceSize } from '../src/content/characterScale';

/**
 * Which FILE a sprite serves, at which drawn size.
 *
 * This is subtle enough to be worth pinning, because the obvious implementation is
 * wrong in a way that only shows up in a real browser: handing the browser densities
 * that make the denser file win for a big render does not reliably work, because
 * Chromium will not DOWNGRADE to a smaller candidate once a denser one is in its
 * cache. Measured directly — an `<img>` moved from `0.700x/1.160x` to `1.035x/1.739x`
 * keeps serving the 1.160x file, so a character drawn once at card proportions would
 * keep the big file in the office too.
 *
 * So the size-dependent choice is made explicitly in the component, and the density
 * labels stay a fixed property of the files. These tests hold that arrangement.
 */

const sprite = employeeSprite('pip')!;

/** Render the sprite at a height and read back the attributes that decide the pixels. */
function renderAt(height: number, reducedMotion = false) {
  const html = renderToStaticMarkup(
    <EmployeeSprite config={sprite} reducedMotion={reducedMotion} height={height} />,
  );
  const attr = (name: string) => {
    const m = html.match(new RegExp(`${name}="([^"]*)"`));
    return m ? m[1] : null;
  };
  return {
    html,
    src: attr('src'),
    srcSet: attr('srcSet') ?? attr('srcset'),
    width: Number(attr('width')),
    height: Number(attr('height')),
  };
}

describe('employee sprite source choice', () => {
  it('serves the display-size asset in the office, and offers the denser build to HiDPI', () => {
    const at = renderAt(sprite.frameHeight);
    expect(at.src).toContain(sprite.src1x!);
    expect(at.srcSet).toBeTruthy();
    // The small candidate is exactly 1x here — that is the pixel-exact case.
    expect(at.srcSet).toContain(`${sprite.src1x} 1x`);
    // ...and the denser one carries its real ratio, not a flat "2x".
    const density = sprite.srcHeight / sprite.frameHeight;
    expect(at.srcSet).toContain(`${sprite.src} ${density.toFixed(3)}x`);
    expect(density).toBeGreaterThan(1.4);
    expect(density).toBeLessThan(2);
  });

  it('still prefers the display-size asset when perspective shrinks it', () => {
    // Pushed back in the room: smaller than encoded, so the small asset is downscaled,
    // which is the sharp direction and needs no denser file.
    const at = renderAt(sprite.frameHeight - 8);
    expect(at.src).toContain(sprite.src1x!);
    expect(at.srcSet).toBeTruthy();
  });

  it('serves the denser build outright for an oversized render, with no small candidate', () => {
    const cardHeight = presenceSize(sprite.cardHeight);
    expect(cardHeight).toBeGreaterThan(sprite.frameHeight);
    const at = renderAt(cardHeight);
    expect(at.src).toContain(sprite.src);
    expect(at.src).not.toContain('-1x');
    // Crucially no srcSet: advertising the small file here would let DPR 1 pick it and
    // enlarge it, which is exactly the softness this avoids.
    expect(at.srcSet).toBeNull();
  });

  it('keeps the aspect ratio derived from the artwork at every size', () => {
    for (const height of [
      sprite.frameHeight - 12,
      sprite.frameHeight,
      presenceSize(sprite.cardHeight),
    ]) {
      const at = renderAt(height);
      expect(at.height).toBe(height);
      expect(at.width).toBe(Math.round((height * sprite.frameWidth) / sprite.frameHeight));
    }
  });

  it('swaps to the still poster for reduced motion, with no animated candidates', () => {
    const at = renderAt(sprite.frameHeight, true);
    expect(at.src).toContain(sprite.poster);
    expect(at.srcSet).toBeNull();
  });
});
