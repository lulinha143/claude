import { test, expect, type Page } from '@playwright/test';
import { DECORATIONS } from '../../src/content/decorations';
import { EMPLOYEES } from '../../src/content/employees';
import { ROOMS } from '../../src/content/rooms';
import { GAME_EVENTS } from '../../src/content/events';
import { openView, arrangeToggle } from './support/shell';

test('a favourite gift is found by giving it, and the employee remains visitable during a break', async ({
  page,
}) => {
  await boot(page, 1280, true);
  await openView(page, 'employees');
  await page.locator('.employee-card__talk[data-employee="pip"]').click();
  await page.locator('.visit__tab[data-tab="gifts"]').click();
  // Nothing is known about a favourite before it has been given.
  await expect(page.locator('.talk__gift-preference')).toContainText('still a mystery');
  await page.locator('.visit-gift[data-gift="coffee"]').click();
  await expect(page.locator('.talk__said--reply')).toContainText('You remembered the coffee');
  await expect(page.locator('.talk__gift-filed')).toBeVisible();
  await page.locator('.visit__tab[data-tab="gifts"]').click();
  await expect(page.locator('.talk__gift-preference')).toContainText('freshly brewed coffee');
  await page.mouse.move(1, 1);
  await page.screenshot({ path: 'visual-artifacts/review/final-gift.png', animations: 'disabled' });
  await page.locator('.talk__close').click();
  await page.locator('.employee-card__talk[data-employee="pip"]').click();
  await expect(page.locator('.talk__end-note')).toContainText('Look through your scrapbook');
  await page.locator('.visit__tab[data-tab="gifts"]').click();
  await expect(page.locator('.visit-gift[data-gift="acorn"]')).toBeDisabled();
  await page.locator('.visit__tab[data-tab="scrapbook"]').click();
  await expect(page.locator('.talk__memories .scrap--gift')).toHaveCount(1);
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: 'visual-artifacts/review/final-gift-320.png',
    animations: 'disabled',
  });
});

test('company ledger and archive support focused reading and keyboard return', async ({ page }) => {
  await boot(page, 1280, true);
  await openView(page, 'company');
  await expect(page.locator('.prod-list')).toBeHidden();
  await page.locator('.production-ledger summary').click();
  await expect(page.locator('.prod-list')).toContainText('From your departments');
  await page.locator('.production-ledger summary').click();
  await page.mouse.move(1, 1);
  await page.screenshot({
    path: 'visual-artifacts/review/final-company.png',
    animations: 'disabled',
  });
  await openView(page, 'collections');
  await page.getByRole('tab', { name: /moment/i }).click();
  await page.locator('.archive-search input').fill('Pip');
  await expect(page.locator('.moment-doc')).toHaveCount(1);
  const open = page.locator('.moment-doc__open');
  await open.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(open).toBeFocused();
  await page.locator('.archive-search input').fill('no such record');
  await expect(page.locator('.moment-doc')).toHaveCount(0);
  await expect(page.locator('.archive-search [role="status"]')).toContainText('0 documents');
  await page.locator('.archive-search input').fill('');
  await page.mouse.move(1, 1);
  await page.screenshot({
    path: 'visual-artifacts/review/final-archive.png',
    animations: 'disabled',
  });
});

async function boot(page: Page, width: number, mature = false) {
  await page.setViewportSize({ width, height: 900 });
  const save = {
    version: 7,
    onboardingComplete: true,
    lastSaved: Date.now(),
    eventCooldowns: Object.fromEntries(
      GAME_EVENTS.map((event) => [event.id, Date.now() + 3_600_000]),
    ),
    resources: { nuts: 5e6, goldenNuts: 100, reputation: mature ? 4000 : 0, morale: 85 },
    employees: mature
      ? Object.fromEntries(
          EMPLOYEES.map((e, i) => [
            e.id,
            { hired: true, level: 2, friendship: 60, room: ROOMS[i % ROOMS.length].id },
          ]),
        )
      : { pip: { hired: true, level: 1, friendship: 60, room: 'founder-desk' } },
    upgrades: mature
      ? Object.fromEntries(
          ROOMS.filter((r) => r.unlock.upgradeId).map((r) => [r.unlock.upgradeId, 1]),
        )
      : {},
    decorationInstances: mature
      ? DECORATIONS.map((d, i) => ({
          instanceId: `deco-${d.id}`,
          decorationId: d.id,
          roomId: d.room,
          surfaceType: d.placementSurface,
          normalizedX: 0.2 + (i % 3) * 0.27,
          normalizedY:
            d.placementSurface === 'floor' ? 0.08 : d.placementSurface === 'wall' ? 0.65 : 0.93,
          depth: 0,
          interactionState: {},
        }))
      : [],
    settings: { language: 'en', reducedMotion: false, showHints: false },
    collections: {
      secrets: mature
        ? DECORATIONS.map((d) => `deco:${d.id}`)
        : [
            'deco:potted-fern',
            'deco:desk-lamp',
            'deco:tiny-rug',
            'deco:motivational-poster',
            'deco:window-view',
          ],
      nuts: [],
      outfits: [],
      logos: [],
      moments: mature
        ? [
            {
              id: 'archive-fixture-broadcast',
              eventId: 'annex-broadcast',
              employeeId: 'pip',
              caption: 'annex.broadcast.evidence',
              rarity: 'rare',
              createdAt: Date.now(),
            },
            {
              id: 'archive-fixture-repair',
              eventId: 'annex-repair',
              employeeId: 'bea',
              caption: 'annex.repair.evidence',
              rarity: 'rare',
              createdAt: Date.now(),
            },
          ]
        : [],
    },
  };
  await page.addInitScript((data) => {
    localStorage.setItem('wmno.save.v1', JSON.stringify(data));
    localStorage.setItem('wmno.lang', 'en');
  }, save);
  await page.goto('/');
  await expect(page.locator('.office')).toBeVisible();
}

for (const width of [1280, 390, 320]) {
  test(`whole-card drag and immediate coffee input at ${width}`, async ({ page }) => {
    await boot(page, width);
    await arrangeToggle(page).click();
    const stage = page.locator('[data-room="founder-desk"] .floor__stage');
    await stage.scrollIntoViewIfNeeded();
    // The title and lower room label are real drag surfaces, not just the image.
    for (const selector of ['.decor', '.deco-tray__card-name', '.deco-tray__card-room']) {
      const card = page.locator('.deco-tray__card[data-decoration="desk-lamp"]');
      await card.scrollIntoViewIfNeeded();
      const box = (await card.locator(selector).boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 15, box.y + box.height / 2 - 15);
      await expect(page.locator('.drag-ghost')).toBeVisible();
      expect(await page.evaluate(() => getSelection()?.toString())).toBe('');
      await expect(page.locator('.drag-ghost')).not.toContainText(/drop|move|selected/i);
      await page.keyboard.press('Escape');
      await page.mouse.up();
      await expect(page.locator('.drag-ghost')).toHaveCount(0);
    }
    await page.screenshot({ path: `visual-artifacts/review/rc-drag-${width}.png` });
    await openView(page, 'focus');
    await page.locator('.micro-card--coffeeRescue').click();
    await page.locator('.microgame__start').click();
    await expect(page.locator('.microgame')).toHaveAttribute('data-phase', 'play');
    const area = page.locator('.coffee__area'),
      mug = page.locator('.coffee__mug');
    const rect = (await area.boundingBox())!;
    for (const fraction of [0.25, 0.75, 0.4]) {
      const x = rect.x + rect.width * fraction;
      await page.mouse.move(x, rect.y + rect.height * 0.6);
      const geometry = await mug.evaluate((el) => ({
        left: el.getBoundingClientRect().left,
        width: el.getBoundingClientRect().width,
        transition: getComputedStyle(el).transitionProperty,
      }));
      expect(Math.abs(geometry.left + geometry.width / 2 - x)).toBeLessThan(2);
      expect(geometry.transition).not.toContain('left');
    }
    await page.screenshot({ path: `visual-artifacts/review/rc-coffee-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('new departments, evidence and employee destination are visible in real play', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await boot(page, 1280, true);
  await arrangeToggle(page).click();
  const inventory = page.locator('.deco-tray__card');
  for (const index of [0, Math.floor(DECORATIONS.length / 2), DECORATIONS.length - 1]) {
    const item = inventory.nth(index);
    await item.scrollIntoViewIfNeeded();
    const box = (await item.locator('.deco-tray__card-room').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 14, box.y + box.height / 2 - 15);
    await expect(page.locator('.drag-ghost')).toBeVisible();
    expect(await page.evaluate(() => getSelection()?.toString())).toBe('');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(page.locator('.drag-ghost')).toHaveCount(0);
  }
  await arrangeToggle(page).click();
  for (const id of ['broadcast', 'repair', 'conservatory']) {
    const room = page.locator(`.floor[data-room="${id}"]`);
    await room.scrollIntoViewIfNeeded();
    await expect(room.locator('.annex-architecture')).toBeVisible();
    await expect(room.locator('.station-btn')).toBeVisible();
    await room.screenshot({ path: `visual-artifacts/review/rc-room-${id}.png` });
    await room.locator('.floor__discovery').click();
    await expect(page.locator('.annex-evidence')).toBeVisible();
    await page.screenshot({ path: `visual-artifacts/review/rc-discovery-${id}.png` });
    await page.locator('.event-choice').first().click();
    await page.locator('.consequence-modal .popup__actions button').click();
    await expect(page.locator('.popup-backdrop')).toHaveCount(0);
  }
  await openView(page, 'employees');
  await page.locator('.employee-card__talk[data-employee="pip"]').click();
  await expect(page.locator('main .talk--destination')).toBeVisible();
  await expect(page.locator('.talk')).toHaveAttribute('role', 'region');
  await page.screenshot({ path: 'visual-artifacts/review/rc-conversation.png' });
  // A visit is its own full-stage mode; leaving it returns to the Team sheet.
  await page.locator('.talk__close').click();
  await expect(page.locator('.talk')).toHaveCount(0);
  await expect(page.locator('.sheet[data-sheet="employees"]')).toBeVisible();
  for (const view of [
    'office',
    'decorate',
    'employees',
    'company',
    'collections',
    'settings',
  ] as const) {
    await openView(page, view);
    await page.screenshot({ path: `visual-artifacts/review/rc-${view}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  // Prestige joins the Archive once this run has earned enough to start a cycle
  // (this busy company crosses the line while the test plays); when it is
  // offered it must open like every other page. The tab rule itself is pinned
  // deterministically in navigation.spec.
  await openView(page, 'company');
  if (await page.locator('.sheet__tab[data-view="prestige"]').count()) {
    await openView(page, 'prestige');
    await page.screenshot({ path: 'visual-artifacts/review/rc-prestige.png' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
