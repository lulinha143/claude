import { test, expect, type Page } from '@playwright/test';

// Verifies the newly imported character artwork renders correctly in the real
// browser: every animal loads its own asset, nothing is squashed, and Pip's
// protected geometry is unchanged.

// Four to a room at most (ROOM_CAP), so the whole photographic cast is on screen
// at once. `bia` (bear) is deliberately absent: no artwork exists yet, and she is
// covered separately by the vector-fallback assertion below.
const ROSTER = [
  { id: 'pip', room: 'founder-desk', aspect: 103 / 93 },
  { id: 'nino', room: 'founder-desk', aspect: 105 / 98 },
  { id: 'junie', room: 'founder-desk', aspect: 99 / 99 },
  { id: 'marlow', room: 'founder-desk', aspect: 108 / 100 },
  { id: 'bea', room: 'construction', aspect: 132 / 116 },
  { id: 'dorm', room: 'construction', aspect: 101 / 100 },
  { id: 'rizzo', room: 'procurement', aspect: 114 / 104 },
  { id: 'nixie', room: 'procurement', aspect: 110 / 100 },
  { id: 'otto', room: 'procurement', aspect: 111 / 100 },
  { id: 'pingo', room: 'procurement', aspect: 128 / 100 },
  { id: 'corvus', room: 'marketing', aspect: 100 / 100 },
  { id: 'rosa', room: 'marketing', aspect: 108 / 108 },
  { id: 'canela', room: 'marketing', aspect: 104 / 100 },
  { id: 'fenn', room: 'marketing', aspect: 103 / 100 },
  { id: 'moss', room: 'research', aspect: 105 / 102 },
  { id: 'mina', room: 'research', aspect: 110 / 100 },
  { id: 'hazel', room: 'research', aspect: 104 / 100 },
  { id: 'perry', room: 'research', aspect: 106 / 100 },
  { id: 'axel', room: 'lab', aspect: 109 / 96 },
  { id: 'quincy', room: 'lab', aspect: 100 / 100 },
  { id: 'inky', room: 'lab', aspect: 100 / 100 },
  { id: 'echo', room: 'lab', aspect: 100 / 100 },
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
    upgrades: {
      'room-sorting': 1,
      'room-lab': 1,
      'room-meeting': 1,
      'room-research': 1,
      'room-marketing': 1,
      'room-construction': 1,
      'room-procurement': 1,
    },
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


test('the cast scales with the room when the window is resized', async ({ page }) => {
  // The reported bug: making the window smaller shrank the room but not the
  // characters in it, so the cast read as oversized cut-outs on a shrunken set.
  // Measured before the fix, the tallest figure was 112.00px whether the room was
  // 824px or 1140px wide — a 38% swing in the figure-to-room ratio.
  await boot(page, 1280, 950);

  const sample = async () =>
    page.evaluate(() => {
      const room = document.querySelector('.floor');
      if (!room) return null;
      const rr = room.getBoundingClientRect();
      const figures = [...document.querySelectorAll('.employee-sprite')].map(
        (el) => el.getBoundingClientRect().height,
      );
      return {
        roomWidth: rr.width,
        tallest: figures.length ? Math.max(...figures) : 0,
        assetScale: Number(getComputedStyle(room).getPropertyValue('--asset-scale')),
      };
    });

  const sizes = [
    { width: 1280, height: 950 },
    { width: 1024, height: 800 },
    { width: 900, height: 700 },
    { width: 1600, height: 950 },
  ];

  const ratios: number[] = [];
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.waitForTimeout(500); // let the ResizeObserver settle
    const s = await sample();
    expect(s, 'no room on screen').not.toBeNull();
    expect(s!.tallest, `no figures at ${size.width}px`).toBeGreaterThan(0);
    expect(s!.assetScale, `scene scale unset at ${size.width}px`).toBeGreaterThan(0);
    ratios.push(s!.tallest / s!.roomWidth);
  }

  const spread = Math.max(...ratios) / Math.min(...ratios) - 1;
  expect(spread, `figure-to-room ratio varied by ${(spread * 100).toFixed(1)}%`).toBeLessThan(0.05);
});

test('scene scale does not leak into the HUD', async ({ page }) => {
  // World scale and UI scale are different things. --asset-scale belongs to the
  // diorama; the header must not inherit it, or the HUD would resize with the room.
  await boot(page);
  const leaked = await page.evaluate(() => {
    const header = document.querySelector('.app__header, header');
    if (!header) return 'no-header';
    return getComputedStyle(header).getPropertyValue('--asset-scale').trim();
  });
  // Either unset, or still the untouched document default of 1.
  expect(['', '1', 'no-header']).toContain(leaked);
});
