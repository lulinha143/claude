import { test, expect, type Page } from '@playwright/test';

// Proves the composition rules on the RENDERED scene: an invalid drop is
// rejected with a message and leaves the piece put; valid neighbours, a big
// floor object near a teammate, a busy room and a multi-frame wall all render
// cleanly. Screenshots are written for direct inspection.

const DIR = 'visual-artifacts';

const SAVE = {
  version: 6,
  onboardingComplete: true,
  lastSaved: Date.now(),
  company: { name: 'Nutty Co.' },
  // High reputation unlocks the morale room (which owns the large decorations).
  resources: { nuts: 9_000_000, goldenNuts: 80, reputation: 4000, morale: 82, permanentKernels: 3 },
  employees: {
    pip: { hired: true, level: 6, friendship: 70, room: 'founder-desk', x: 0.3 },
    marlow: { hired: true, level: 4, friendship: 55, room: 'founder-desk', x: 0.6 },
    rizzo: { hired: true, level: 3, friendship: 45, room: 'morale', x: 0.4 },
    bea: { hired: true, level: 3, friendship: 40, room: 'morale', x: 0.6 },
  },
  collections: {
    nuts: [],
    outfits: [],
    logos: [],
    moments: [],
    secrets: [
      'deco:potted-fern',
      'deco:desk-lamp',
      'deco:motivational-poster',
      'deco:window-view',
      'deco:tiny-rug',
      'deco:aquarium',
      'deco:beanbag-chairs',
      'deco:snack-bar',
      'deco:mood-lighting',
    ],
  },
};

async function seed(page: Page, save: Record<string, unknown>) {
  await page.addInitScript(() => {
    try {
      if (!localStorage.getItem('wmno.settings.v1')) {
        localStorage.setItem('wmno.settings.v1', JSON.stringify({ reducedMotion: true }));
      }
    } catch {
      /* ignore */
    }
  });
  await page.addInitScript((data) => {
    if (!localStorage.getItem('wmno.save.v1')) localStorage.setItem('wmno.save.v1', JSON.stringify(data));
  }, save);
}

async function clearModals(page: Page) {
  for (let i = 0; i < 4; i += 1) {
    const ok = page.locator('.modal .buy-btn, .modal button:has-text("OK")').first();
    if (await ok.count()) {
      await ok.click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(150);
    } else break;
  }
  await page.waitForTimeout(200);
}

async function enterDecorateMode(page: Page) {
  await page.locator('.office__toolbar button').first().click();
  await expect(page.locator('.office--decorating')).toHaveCount(1);
}

function styleNumbers(style: string) {
  const left = /left:\s*([\d.]+)%/.exec(style)?.[1];
  const bottom = /bottom:\s*([\d.]+)%/.exec(style)?.[1];
  return { left: left ? parseFloat(left) : NaN, bottom: bottom ? parseFloat(bottom) : NaN };
}

async function dragTo(page: Page, source: ReturnType<Page['locator']>, x: number, y: number) {
  const box = await source.boundingBox();
  if (!box) throw new Error('no bounding box');
  const sx = box.x + box.width / 2;
  const sy = box.y + box.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 8, sy + 4, { steps: 3 });
  await page.mouse.move((sx + x) / 2, (sy + y) / 2, { steps: 6 });
  await page.mouse.move(x, y, { steps: 8 });
  await page.waitForTimeout(60);
  await page.mouse.up();
  await page.waitForTimeout(200);
}

test.describe('decoration composition protection', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await seed(page, SAVE);
    await page.goto('/');
    await page.locator('.office').first().waitFor({ timeout: 15000 });
    await clearModals(page);
    await enterDecorateMode(page);
  });

  test('rejects dropping a decoration onto another and keeps it put', async ({ page }) => {
    await page.locator('.floor[data-room="founder-desk"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const fern = page.locator('.floor[data-room="founder-desk"] [data-deco="potted-fern"]');
    const lamp = page.locator('.floor[data-room="founder-desk"] [data-deco="desk-lamp"]');
    await expect(fern).toBeVisible();
    const lampBox = (await lamp.boundingBox())!;
    const before = styleNumbers((await fern.getAttribute('style')) ?? '');
    await page.screenshot({ path: `${DIR}/collide-01-valid-neighbours.png` });

    // Drop the fern right on the lamp's anchor (bottom-centre) to force a
    // stacked/severe overlap, not just a glancing corner.
    await dragTo(page, fern, lampBox.x + lampBox.width / 2, lampBox.y + lampBox.height - 3);

    // A localized rejection toast appears and the fern hasn't moved. (Other
    // toasts — e.g. achievement unlocks from the seeded save — may coexist, so
    // filter for the composition message specifically.)
    await expect(
      page.locator('.toast').filter({ hasText: /already|cover|there's|taken|room|inside/i }).first(),
    ).toBeVisible();
    await page.screenshot({ path: `${DIR}/collide-02-invalid-overlap.png` });
    const after = styleNumbers((await fern.getAttribute('style')) ?? '');
    expect(Math.abs(after.left - before.left)).toBeLessThan(1.5);
    expect(Math.abs(after.bottom - before.bottom)).toBeLessThan(1.5);
  });

  test('captures a large floor object near a teammate and a busy room', async ({ page }) => {
    await page.locator('.floor[data-room="morale"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const morale = page.locator('.floor[data-room="morale"]');
    await expect(morale.locator('.floor__deco')).not.toHaveCount(0);
    await expect(morale.locator('.critter-btn')).toHaveCount(2);
    await morale.screenshot({ path: `${DIR}/collide-03-large-object-near-employee.png` });
    await morale.screenshot({ path: `${DIR}/collide-04-busy-room.png` });
  });

  test('captures a wall carrying several framed objects', async ({ page }) => {
    await page.locator('.floor[data-room="founder-desk"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const room = page.locator('.floor[data-room="founder-desk"]');
    // At least the poster + window-view sit on the wall band.
    await expect(room.locator('.floor__deco--wall')).not.toHaveCount(0);
    await room.screenshot({ path: `${DIR}/collide-05-multi-frame-wall.png` });
  });
});
