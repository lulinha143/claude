import { expect, test } from '@playwright/test';
import { EMPLOYEES } from '../../src/content/employees';
import { createInitialState } from '../../src/sim/state';
import { readFileSync } from 'node:fs';
const en = JSON.parse(
  readFileSync(new URL('../../src/i18n/locales/en.json', import.meta.url), 'utf8'),
) as unknown;

const text = (key: string) =>
  key
    .split('.')
    .reduce<unknown>((value, part) => (value as Record<string, unknown>)[part], en) as string;

for (const employee of EMPLOYEES) {
  test('personal history ' + employee.id, async ({ page }) => {
    const state = createInitialState(Date.now());
    state.onboardingComplete = true;
    state.resources.nuts = 10_000;
    state.resources.morale = 75;
    state.settings.reducedMotion = true;
    state.settings.language = 'en';
    state.employees[employee.id].hired = true;
    state.employees[employee.id].friendship = 40;
    await page.addInitScript((save) => {
      if (!localStorage.getItem('wmno.save.v1'))
        localStorage.setItem('wmno.save.v1', JSON.stringify(save));
      localStorage.setItem('wmno.lang', 'en');
    }, state);
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Team', exact: true }).click();
    await page.locator('.employee-card__talk[data-employee="' + employee.id + '"]').click();
    await expect(page.locator('.talk__sheet')).toBeVisible();
    await expect(page.locator('.talk__portrait img')).toHaveAttribute('src', /poster\.png$/);
    await page.locator('.talk__agenda summary').click();
    await page
      .locator('.talk__agenda')
      .getByRole('button', { name: text(employee.favoriteItemKey), exact: true })
      .click();
    await expect(page.locator('.talk__said')).toContainText(
      text('keepsake.' + employee.id + '.prompt'),
    );
    await page.screenshot({ path: 'visual-artifacts/review/employees/' + employee.id + '.png' });
    await page.locator('.talk-choice').first().click();
    await expect(page.locator('.talk__said--reply')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          (id) =>
            JSON.parse(localStorage.getItem('wmno.save.v1')!).flags['favorite.' + id + '.cared'],
          employee.id,
        ),
      )
      .toBeTruthy();
    await page.reload();
    const flag = await page.evaluate(
      (id) => JSON.parse(localStorage.getItem('wmno.save.v1')!).flags['favorite.' + id + '.cared'],
      employee.id,
    );
    expect(flag).toBeTruthy();
  });
}
