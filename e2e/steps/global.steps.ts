import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import { Given, When, Then } from '../support/fixtures';

Given('my system prefers the {string} colour scheme', async ({ page }, scheme: string) => {
  await page.emulateMedia({ colorScheme: scheme as 'light' | 'dark' });
});

Then('the page theme should be {string}', async ({ page }, theme: string) => {
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
});

When('I choose the language {string}', async ({ header }, label: string) => {
  await header.languageSelect.selectOption({ label });
});

Then('the page direction should be {string} with language {string}', async ({ page }, dir: string, lang: string) => {
  await expect(page.locator('html')).toHaveAttribute('dir', dir);
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
});

When('the browser goes offline', async ({ context }) => {
  await context.setOffline(true);
});

When('the browser comes back online', async ({ context }) => {
  await context.setOffline(false);
});

Then('the main content should have focus', async ({ page }) => {
  await expect(page.locator('#main')).toBeFocused();
});

Then('the main navigation links should be hidden', async ({ header }) => {
  await expect(header.menuButton).toBeVisible();
  await expect(header.nav.getByRole('link', { name: 'Shop', exact: true })).toBeHidden();
});

Then('the page should have no serious accessibility violations', async ({ page, $testInfo }) => {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[aria-busy="true"], .spinner')).toHaveCount(0);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  await $testInfo.attach('axe-violations.json', { body: JSON.stringify(results.violations, null, 2), contentType: 'application/json' });
  const summary = serious.map((v) => `${v.id} (${v.impact}): ${v.help} – ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(summary, 'serious or critical accessibility violations').toEqual([]);
});
