import { expect } from '@playwright/test';
import { DataTable } from 'playwright-bdd';
import { Given, When, Then, loginAs } from '../support/fixtures';
import type { Role } from '../support/data';

export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------- navigation ----------

Given('I open {string}', async ({ page }, path: string) => {
  await page.goto(path);
});

When('I reload the page', async ({ page }) => {
  await page.reload();
});

Given('I am logged in as {string}', async ({ page, request, ctx }, role: string) => {
  ctx.token = await loginAs(page, request, role as Role);
});

// ---------- interactions ----------

When('I click the {string} button', async ({ page }, name: string) => {
  await page.getByRole('button', { name, exact: true }).filter({ visible: true }).first().click();
});

When('I click the {string} link', async ({ page }, name: string) => {
  await page.getByRole('link', { name, exact: true }).filter({ visible: true }).first().click();
});

When('I press {string}', async ({ page }, key: string) => {
  await page.keyboard.press(key);
});

When('I fill {string} with {string}', async ({ page }, label: string, value: string) => {
  await page.getByLabel(label, { exact: true }).fill(value);
});

// ---------- assertions ----------

Then('I should see the text {string}', async ({ page }, text: string) => {
  await expect(page.getByText(text).filter({ visible: true }).first()).toBeVisible();
});

Then('I should see the heading {string}', async ({ page }, name: string) => {
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
});

Then('I should see the toast {string}', async ({ page }, text: string) => {
  await expect(page.getByTestId('toast').filter({ hasText: text }).first()).toBeVisible();
});

Then('I should see the field error {string}', async ({ page }, text: string) => {
  await expect(page.locator('.field-error').filter({ hasText: text }).first()).toBeVisible();
});

Then('I should see the field errors:', async ({ page }, table: DataTable) => {
  for (const [text] of table.raw()) {
    await expect(page.locator('.field-error').filter({ hasText: text }).first()).toBeVisible();
  }
});

Then('the URL should contain {string}', async ({ page }, part: string) => {
  await expect(page).toHaveURL(new RegExp(escapeRegExp(part)));
});

Then('I should be on {string}', async ({ page }, path: string) => {
  await expect(page).toHaveURL(new RegExp(`^https?://[^/]+${escapeRegExp(path)}(?:[?#].*)?$`));
});

Then('the dialog {string} should be open', async ({ page }, name: string) => {
  await expect(page.getByRole('dialog', { name })).toBeVisible();
});

Then('no dialog should be open', async ({ page }) => {
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

Then('the {string} button should have focus', async ({ page }, name: string) => {
  await expect(page.getByRole('button', { name, exact: true })).toBeFocused();
});

Then('the {string} button should be disabled', async ({ page }, name: string) => {
  await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
});

Then('the {string} button should be expanded', async ({ page }, name: string) => {
  await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-expanded', 'true');
});

Then('the {string} link should have focus', async ({ page }, name: string) => {
  await expect(page.getByRole('link', { name, exact: true })).toBeFocused();
});

// ---------- browser storage ----------

for (const store of ['localStorage', 'sessionStorage'] as const) {
  Then(`${store} should have a value for {string}`, async ({ page }, key: string) => {
    await expect.poll(() => page.evaluate(([s, k]) => window[s as 'localStorage'].getItem(k), [store, key])).not.toBeNull();
  });

  Then(`${store} should not have a value for {string}`, async ({ page }, key: string) => {
    expect(await page.evaluate(([s, k]) => window[s as 'localStorage'].getItem(k), [store, key])).toBeNull();
  });
}

Then('localStorage {string} should be {string}', async ({ page }, key: string, value: string) => {
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), key)).toBe(value);
});

// ---------- downloads (profile invoices, admin CSV export) ----------

When('I click {string} and wait for the download', async ({ page, ctx }, name: string) => {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: true }).click();
  ctx.download = await downloadPromise;
});

Then('the downloaded file should be named {string}', async ({ ctx }, name: string) => {
  const download = ctx.download as import('@playwright/test').Download;
  expect(download.suggestedFilename()).toBe(name);
});
