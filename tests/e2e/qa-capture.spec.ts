import { test, expect, type Page } from '@playwright/test';

// Manual-inspection capture. Writes a full-page shot of a mid-game company so the
// HUD, tabs, rooms, characters and mood bubbles can be eyeballed together, and
// asserts the bubble sits near its character rather than floating above the
// furniture (the failure the tall workstation sprites introduced).

const ROSTER: Array<[string, string]> = [
  ['pip', 'founder-desk'],
  ['bea', 'construction'],
  ['rizzo', 'procurement'],
  ['corvus', 'marketing'],
  ['junie', 'sorting'],
  ['moss', 'research'],
  ['nino', 'meeting'],
  ['rosa', 'marketing'],
  ['axel', 'lab'],
];

function save() {
  const employees: Record<string, unknown> = {};
  for (const [id, room] of ROSTER) {
    employees[id] = { hired: true, level: 5, friendship: 60, room, x: 0.5 };
  }
  return {
    version: 10,
    onboardingComplete: true,
    lastSaved: Date.now(),
    createdAt: Date.now() - 900_000,
    company: { name: 'Nutshell Inc.' },
    resources: {
      nuts: 5_080_000,
      goldenNuts: 62,
      permanentKernels: 0,
      morale: 73,
      reputation: 400,
    },
    employees,
    upgrades: { 'room-sorting': 1, 'room-lab': 1, 'room-meeting': 1 },
    collections: { nuts: [], outfits: [], logos: ['default'], moments: [], secrets: [] },
    settings: { reducedMotion: true },
  };
}

async function boot(page: Page) {
  await page.setViewportSize({ width: 1280, height: 950 });
  await page.addInitScript((d) => {
    if (!window.localStorage.getItem('wmno.save.v1')) {
      window.localStorage.setItem('wmno.save.v1', JSON.stringify(d));
    }
  }, save());
  await page.goto('/');
  await expect(page.locator('.office')).toBeVisible();
  await page.waitForTimeout(900);
}

test('capture the office for inspection', async ({ page }) => {
  await boot(page);
  await page.mouse.move(2, 2);
  await page.screenshot({ path: 'visual-artifacts/inspect-office.png', fullPage: true });
});

test('a mood bubble belongs to its character, not the ceiling', async ({ page }) => {
  await boot(page);

  const pairs = await page.locator('.critter-btn--sprite').evaluateAll((els) =>
    els
      .map((el) => {
        const bubble = el.parentElement?.querySelector(
          `.employee-bubble[data-employee="${(el as HTMLElement).dataset.employee}"]`,
        );
        if (!bubble) return null;
        const c = el.getBoundingClientRect();
        const b = bubble.getBoundingClientRect();
        return { charTop: c.top, charHeight: c.height, bubbleBottom: b.bottom };
      })
      .filter(Boolean),
  );

  expect(pairs.length).toBeGreaterThan(0);
  for (const p of pairs as Array<{ charTop: number; charHeight: number; bubbleBottom: number }>) {
    // The bubble must hang inside the character's own vertical span rather than
    // detaching above their box: anchored around three-quarters up a
    // seated-at-desk composition, which is roughly where the head is.
    const offsetAboveTop = p.charTop - p.bubbleBottom;
    expect(offsetAboveTop, 'bubble floats above the character box').toBeLessThan(
      p.charHeight * 0.15,
    );
  }
});
