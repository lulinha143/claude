// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { initI18n } from '../src/i18n';
import { MicroGame, type MicroMode } from '../src/ui/minigames/MicroGame';

describe('minigames render without throwing', () => {
  beforeAll(async () => {
    await initI18n('en');
  });

  it('mounts each mode and shows the shared shell (title + exit)', () => {
    for (const mode of ['coffeeRescue', 'bugSquash', 'cableUntangle'] as MicroMode[]) {
      const html = renderToStaticMarkup(
        <MicroGame mode={mode} seed={123} reducedMotion={false} onReward={() => {}} onClose={() => {}} />,
      );
      expect(html).toContain('microgame__bar');
      expect(html).toContain('microgame__exit');
    }
  });

  it('reduced-motion variants also render', () => {
    for (const mode of ['coffeeRescue', 'bugSquash', 'cableUntangle'] as MicroMode[]) {
      const html = renderToStaticMarkup(
        <MicroGame mode={mode} seed={7} reducedMotion onReward={() => {}} onClose={() => {}} />,
      );
      expect(html).toContain('microgame');
    }
  });
});
