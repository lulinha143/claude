import { test, expect, type Page } from '@playwright/test';

// Verifies the newly imported character artwork renders correctly in the real
// browser: every animal loads its own asset, nothing is squashed, and Pip's
// protected geometry is unchanged.

const ROSTER = [
  { id: 'pip', room: 'founder-desk', aspect: 103 / 93 },
  { id: 'bea', room: 'construction', aspect: 132 / 116 },
  { id: 'rizzo', room: 'procurement', aspect: 114 / 104 },
  { id: 'corvus', room: 'marketing', aspect: 100 / 100 },
  { id: 'junie', room: 'sorting', aspect: 99 / 99 },
  { id: 'moss', room: 'research', aspect: 105 / 102 },
  { id: 'nino', room: 'meeting', aspect: 105 / 98 },
  { id: 'rosa', room: 'marketing', aspect: 108 / 108 },
  { id: 'axel', room: 'lab', aspect: 109 / 96 },
];

function save() {
  const employees: Record<string, unknown> = {};
  for (const { id, room } of ROSTER) {
    employees[id] = { hired: true, level: 4, friendship: 50, room, x: 0.5 };
  }
  return {
    version: 10,
    onboardingComplete: true,
    lastSaved: Date.now(),
    createdAt: Date.now() - 900_000,
    company: { name: 'Nutshell Inc.' },
    resources: {
      nuts: 5_000_000,
      goldenNuts: 40,
      permanentKernels: 0,
      morale: 80,
      reputation: 400,
    },
    employees,
    // Unlock the rooms these animals live in.
    upgrades: { 'room-sorting': 1, 'room-lab': 1, 'room-meeting': 1 },
    collections: { nuts: [], outfits: [], logos: ['default'], moments: [], secrets: [] },
    settings: { reducedMotion: false },
  };
}

async function boot(page: Page, width = 1280, height = 950) {
  await page.setViewportSize({ width, height });
  await page.addInitScript((data) => {
    if (!window.localStorage.getItem('wmno.save.v1')) {
      window.localStorage.setItem('wmno.save.v1', JSON.stringify(data));
    }
  }, save());
  await page.goto('/');
  await expect(page.locator('.office')).toBeVisible();
  await page.waitForTimeout(900); // let the APNGs start
}

test('every imported animal renders its own artwork, fully loaded', async ({ page }) => {
  await boot(page);

  const loaded = await page.locator('.employee-sprite').evaluateAll((els) =>
    els.map((el) => {
      const img = el as HTMLImageElement;
      return {
        src: img.currentSrc || img.src,
        naturalWidth: img.naturalWidth,
        w: img.getBoundingClientRect().width,
        h: img.getBoundingClientRect().height,
      };
    }),
  );

  expect(loaded.length).toBeGreaterThanOrEqual(ROSTER.length);
  for (const sprite of loaded) {
    // naturalWidth 0 means the file failed to decode — the exact symptom that
    // used to leave a broken image standing at a workstation.
    expect(sprite.naturalWidth, `failed to load: ${sprite.src}`).toBeGreaterThan(0);
    expect(sprite.w).toBeGreaterThan(10);
    expect(sprite.h).toBeGreaterThan(10);
  }

  // Each animal must be showing ITS OWN file, not a neighbour's.
  for (const { id } of ROSTER) {
    const own = loaded.filter((s) => new RegExp(`/${id}(-1x)?\\.png`).test(s.src));
    expect(own.length, `${id} is not rendering its own asset`).toBeGreaterThan(0);
  }
});

test('no character is squashed: rendered box matches artwork aspect ratio', async ({ page }) => {
  await boot(page);

  for (const { id, aspect } of ROSTER) {
    const sprite = page
      .locator(`.critter-btn[aria-label*="${id[0].toUpperCase()}${id.slice(1)}"] .employee-sprite`)
      .first();
    if ((await sprite.count()) === 0) continue;
    const box = (await sprite.boundingBox())!;
    const ratio = box.width / box.height;
    // 2% tolerance, matching the long-standing Pip geometry guard.
    expect(Math.abs(ratio - aspect) / aspect, `${id} aspect ${ratio} vs ${aspect}`).toBeLessThan(
      0.02,
    );
  }
});

test('Pip still renders on the repaired asset at her protected aspect ratio', async ({ page }) => {
  await boot(page);
  const pip = page
    .locator('.floor[data-room="founder-desk"] .critter-btn--sprite .employee-sprite')
    .first();
  await expect(pip).toHaveCount(1);

  const src = await pip.getAttribute('srcset');
  const current = await pip.evaluate((el) => (el as HTMLImageElement).currentSrc);
  // Must be Pip's own repaired build, never a re-import of the raw master.
  expect(current).toMatch(/employees\/pip(-1x)?\.png/);
  expect(src ?? current).toContain('pip');

  const box = (await pip.boundingBox())!;
  expect(Math.abs(box.width / box.height - 103 / 93) / (103 / 93)).toBeLessThan(0.02);
});

test('characters stay grounded and unclipped inside their rooms', async ({ page }) => {
  await boot(page);
  const rooms = [...new Set(ROSTER.map((r) => r.room))];
  for (const room of rooms) {
    const floor = page.locator(`.floor[data-room="${room}"]`);
    if ((await floor.count()) === 0) continue;
    await floor.scrollIntoViewIfNeeded();
    const roomBox = (await floor.boundingBox())!;
    const critters = floor.locator('.critter-btn');
    const n = await critters.count();
    for (let i = 0; i < n; i += 1) {
      const box = (await critters.nth(i).boundingBox())!;
      // Feet on the floor, head not cut off by the room's overflow clip.
      expect(box.y + box.height, `${room} critter ${i} bottom`).toBeLessThanOrEqual(
        roomBox.y + roomBox.height + 2,
      );
      expect(box.y, `${room} critter ${i} top`).toBeGreaterThanOrEqual(roomBox.y - 2);
    }
  }
  await page.screenshot({ path: 'visual-artifacts/qa-characters-all.png', fullPage: true });
});

test('reduced motion swaps every animal to its static poster', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 950 });
  await page.addInitScript((data) => {
    window.localStorage.setItem(
      'wmno.save.v1',
      JSON.stringify({ ...(data as object), settings: { reducedMotion: true } }),
    );
  }, save());
  await page.goto('/');
  await expect(page.locator('.office')).toBeVisible();
  await page.waitForTimeout(600);

  const srcs = await page
    .locator('.employee-sprite')
    .evaluateAll((els) => els.map((el) => (el as HTMLImageElement).currentSrc));
  expect(srcs.length).toBeGreaterThan(0);
  for (const src of srcs) {
    expect(src, `${src} should be a poster under reduced motion`).toContain('-poster.png');
  }
});
