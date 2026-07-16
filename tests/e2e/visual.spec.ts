import { test, type Page } from '@playwright/test';

// Visual-capture harness. Unlike smoke.spec, this does not assert — it seeds a
// rich save, drives the app to each key screen at a matrix of window sizes and
// languages, and writes PNGs to `visual-artifacts/` for direct inspection
// (manual screenshots, so no stored baselines are required to run).

const RICH_SAVE = {
  version: 3, // deliberately old: also exercises the v3→v5 migration on load
  onboardingComplete: true,
  lastSaved: Date.now(),
  company: { name: 'Nutty Co.' },
  resources: { nuts: 5_000_000, goldenNuts: 40, reputation: 4000, morale: 82, permanentKernels: 3 },
  employees: {
    pip: { hired: true, level: 6, friendship: 70, room: 'founder-desk', x: 0.2 },
    marlow: { hired: true, level: 4, friendship: 55, room: 'founder-desk', x: 0.4 },
    rizzo: { hired: true, level: 3, friendship: 45, room: 'founder-desk', x: 0.6 },
    bea: { hired: true, level: 3, friendship: 40, room: 'founder-desk', x: 0.8 },
    corvus: { hired: true, level: 2, friendship: 30, room: null, x: 0.5 },
    mina: { hired: true, level: 2, friendship: 30, room: null, x: 0.5 },
  },
  // own a spread of decorations so the tray + placed furniture are populated
  collections: {
    nuts: [],
    outfits: [],
    logos: [],
    moments: [],
    secrets: ['deco:potted-fern', 'deco:desk-lamp', 'deco:mini-couch', 'deco:water-cooler', 'deco:whiteboard'],
  },
};

const VIEWPORTS: { name: string; w: number; h: number }[] = [
  { name: '420x720', w: 420, h: 720 },
  { name: '480x800', w: 480, h: 800 },
  { name: '720x720', w: 720, h: 720 },
  { name: '960x720', w: 960, h: 720 },
  { name: '1280x720', w: 1280, h: 720 },
  { name: '1920x1080', w: 1920, h: 1080 },
  { name: 'ultrawide-2560x1080', w: 2560, h: 1080 },
  { name: 'narrow-380x900', w: 380, h: 900 },
];

const DIR = 'visual-artifacts';

async function seed(page: Page, save: Record<string, unknown>) {
  await page.addInitScript((data) => {
    localStorage.setItem('wmno.save.v1', JSON.stringify(data));
  }, save);
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: false });
}

// Dismiss any modal that would block navigation (offline welcome-back, an event,
// etc.) and let the notification toasts settle.
async function clearModals(page: Page) {
  for (let i = 0; i < 4; i += 1) {
    const ok = page.locator('.modal .buy-btn, .modal button:has-text("OK")').first();
    if (await ok.count()) {
      await ok.click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(200);
    } else break;
  }
  await page.waitForTimeout(300);
}

// One test captures the Office at every viewport (the highest-value screen for
// responsiveness + adaptive rooms + decoration scale).
test('office across the viewport matrix', async ({ page }) => {
  for (const v of VIEWPORTS) {
    await page.setViewportSize({ width: v.w, height: v.h });
    await seed(page, RICH_SAVE);
    await page.goto('/');
    await page.locator('.office').first().waitFor({ timeout: 15000 });
    await clearModals(page);
    await page.waitForTimeout(400);
    await shot(page, `office-${v.name}`);
  }
});

// Capture every major view at a representative desktop size and a compact size.
test('all views at desktop + compact', async ({ page }) => {
  for (const v of [
    { name: '1280x720', w: 1280, h: 720 },
    { name: '420x720', w: 420, h: 720 },
  ]) {
    await page.setViewportSize({ width: v.w, height: v.h });
    await seed(page, RICH_SAVE);
    await page.goto('/');
    await page.locator('.office').first().waitFor({ timeout: 15000 });
    await clearModals(page);

    const views: [string, RegExp][] = [
      ['upgrades', /^Upgrades$|^Melhorias$/i],
      ['team', /^Team$|^Equipe$/i],
      ['company', /^Company$|^Empresa$/i],
      ['focus', /^Focus$|^Foco$/i],
      ['settings', /^Settings$|^Ajustes$/i],
    ];
    for (const [key, name] of views) {
      const btn = page.getByRole('button', { name }).first();
      if (await btn.count()) {
        await btn.click();
        await page.waitForTimeout(300);
        await shot(page, `view-${key}-${v.name}`);
      }
    }

    // Decorate / arrange mode if a decorate nav button exists.
    const deco = page.getByRole('button', { name: /Decorate|Decoraç/i }).first();
    if (await deco.count()) {
      await deco.click();
      await page.waitForTimeout(300);
      await shot(page, `view-decorate-${v.name}`);
    }
  }
});

// Trigger an event choice and capture the WHAT CHANGED consequence panel.
test('event WHAT CHANGED panel', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 760 });
  await seed(page, RICH_SAVE);
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15000 });
  // Force a known event via the dev panel if present, else skip gracefully.
  const dev = page.locator('.dev-fab');
  if (await dev.count()) {
    await dev.click();
    // switch to actions tab and pick the event from the select if available
    const actions = page.getByRole('button', { name: /Actions/i }).first();
    if (await actions.count()) await actions.click();
    const select = page.locator('.dev-panel select').last();
    if (await select.count()) {
      await select.selectOption('bea-wood').catch(() => {});
      await page.waitForTimeout(200);
      // close dev panel
      const close = page.getByRole('button', { name: /Close|Fechar/i }).first();
      if (await close.count()) await close.click();
      // choose the "approve" option in the event modal
      const eventModal = page.locator('.event-modal, .modal');
      if (await eventModal.count()) {
        await page.waitForTimeout(300);
        await shot(page, 'event-modal');
        const firstChoice = page.locator('.event-modal button, .modal .choice-btn, .modal button').first();
        if (await firstChoice.count()) {
          await firstChoice.click();
          await page.waitForTimeout(400);
          await shot(page, 'what-changed');
        }
      }
    }
  }
});

// A localized capture (Brazilian Portuguese) of Office + Settings.
test('pt-BR localization capture', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await seed(page, { ...RICH_SAVE, settings: { language: 'pt-BR' } });
  await page.goto('/');
  await page.locator('.office').first().waitFor({ timeout: 15000 });
  await clearModals(page);
  await page.waitForTimeout(300);
  await shot(page, 'office-ptBR');
  const settings = page.getByRole('button', { name: /Ajustes|Configura|Settings/i }).first();
  if (await settings.count()) {
    await settings.click();
    await page.waitForTimeout(300);
    await shot(page, 'settings-ptBR');
  }
});
