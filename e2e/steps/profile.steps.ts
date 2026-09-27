import fs from 'node:fs/promises';
import { expect, type Download } from '@playwright/test';
import { DataTable } from 'playwright-bdd';
import { Given, When, Then } from '../support/fixtures';
import { TINY_PNG } from '../support/data';

Given('the profile page has loaded', async ({ page, profilePage }) => {
  await expect(page.getByRole('heading', { name: 'My profile' })).toBeVisible();
  await expect(profilePage.ordersTable).toBeVisible();
});

When('I upload the avatar {string} of type {string}', async ({ profilePage }, name: string, mimeType: string) => {
  await profilePage.avatarInput.setInputFiles({ name, mimeType, buffer: TINY_PNG });
});

When('I upload the avatar {string} of type {string} and size {int} bytes', async ({ profilePage }, name: string, mimeType: string, size: number) => {
  await profilePage.avatarInput.setInputFiles({ name, mimeType, buffer: Buffer.alloc(size, 1) });
});

Then('my avatar image should be visible', async ({ profilePage }) => {
  await expect(profilePage.avatarImage).toBeVisible();
  // The image must actually load, not just be in the DOM.
  await expect.poll(() => profilePage.avatarImage.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
});

Then('I should see the avatar error {string}', async ({ page }, text: string) => {
  await expect(page.getByTestId('avatar-error')).toHaveText(text);
});

When('I change my password from {string} to {string}', async ({ page, profilePage }, current: string, next: string) => {
  await profilePage.field('Current password').fill(current);
  await profilePage.field('New password').fill(next);
  await profilePage.field('Confirm new password').fill(next);
  await page.getByRole('button', { name: 'Update password' }).click();
});

for (const outcome of ['should', 'should not'] as const) {
  Then(`{string} ${outcome} be able to log in with {string}`, async ({ request }, email: string, password: string) => {
    const res = await request.post('/api/auth/login', { data: { email, password } });
    expect(res.status()).toBe(outcome === 'should' ? 200 : 401);
  });
}

Then('the order history should list:', async ({ profilePage }, table: DataTable) => {
  const rows = table.hashes();
  await expect(profilePage.ordersTable.getByRole('rowheader')).toHaveText(rows.map((r) => r.order));
  for (const { order, status } of rows) {
    await expect(profilePage.orderRow(order)).toContainText(status);
  }
});

When('I download the invoice for {string}', async ({ page, ctx }, order: string) => {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: `Download invoice for ${order}` }).click();
  ctx.download = await downloadPromise;
});

Then('the downloaded file should be a PDF', async ({ ctx }) => {
  const file = await (ctx.download as Download).path();
  const bytes = await fs.readFile(file);
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
});

for (const choice of ['accept', 'dismiss'] as const) {
  When(`I click {string} and ${choice} the confirmation`, async ({ page, ctx }, name: string) => {
    page.once('dialog', async (dialog) => {
      ctx.dialogMessage = dialog.message();
      await dialog[choice]();
    });
    await page.getByRole('button', { name, exact: true }).click();
  });
}

Then('the confirmation should have asked {string}', async ({ ctx }, message: string) => {
  await expect.poll(() => ctx.dialogMessage).toBe(message);
});
