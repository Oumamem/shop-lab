import { expect, type Page } from '@playwright/test';
import { DataTable } from 'playwright-bdd';
import { Given, When, Then } from '../support/fixtures';

Given('I am viewing product {int}', async ({ productPage }, id: number) => {
  await productPage.goto(id);
});

When('I click thumbnail {int}', async ({ productPage }, n: number) => {
  await productPage.thumbnail(n).click();
});

Then('the main image should show view {int} of {int}', async ({ productPage }, n: number, total: number) => {
  await expect(productPage.mainImage).toHaveAttribute('alt', new RegExp(`view ${n} of ${total}$`));
  await expect(productPage.thumbnail(n)).toHaveAttribute('aria-pressed', 'true');
});

for (const state of ['disabled', 'enabled'] as const) {
  Then(`the following options should be ${state}:`, async ({ productPage }, table: DataTable) => {
    for (const { group, value } of table.hashes()) {
      const option = productPage.option(group as 'Size' | 'Colour', value);
      if (state === 'disabled') await expect(option).toBeDisabled();
      else await expect(option).toBeEnabled();
    }
  });
}

When('I choose size {string}', async ({ productPage }, value: string) => {
  await productPage.choose('Size', value);
});

When('I choose colour {string}', async ({ productPage }, value: string) => {
  await productPage.choose('Colour', value);
});

Then('I should see the product error {string}', async ({ productPage }, text: string) => {
  await expect(productPage.error).toHaveText(text);
});

When('I increase the quantity {int} times', async ({ productPage }, times: number) => {
  for (let i = 0; i < times; i++) {
    if (await productPage.increase.isDisabled()) break;
    await productPage.increase.click();
  }
});

Then('the quantity should be {int}', async ({ productPage }, qty: number) => {
  await expect(productPage.quantity).toHaveValue(String(qty));
});

Then('the {word} quantity button should be disabled', async ({ productPage }, which: string) => {
  await expect(which === 'increase' ? productPage.increase : productPage.decrease).toBeDisabled();
});

Then('the cart badge should show {int}', async ({ header }, count: number) => {
  await expect(header.cartCount).toHaveText(String(count));
});

When('I focus the {string} tab and press {string}', async ({ page, productPage }, tab: string, key: string) => {
  await productPage.tab(tab).focus();
  await page.keyboard.press(key);
});

When('I open the {string} tab', async ({ productPage }, tab: string) => {
  await productPage.tab(tab).click();
});

Then('the {string} tab should be selected', async ({ productPage }, tab: string) => {
  await expect(productPage.tab(tab)).toHaveAttribute('aria-selected', 'true');
  await expect(productPage.tab(tab)).toBeFocused();
});

When('I hover over the shipping information icon', async ({ productPage }) => {
  await productPage.shippingInfo.hover();
});

Then('I should see the tooltip {string}', async ({ page }, text: string) => {
  await expect(page.getByRole('tooltip')).toContainText(text);
});

When('I click {string} and a new tab opens', async ({ page, ctx }, name: string) => {
  const popupPromise = page.context().waitForEvent('page');
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  ctx.popup = popup;
});

Then('the new tab should be on {string}', async ({ ctx }, path: string) => {
  await expect(ctx.popup as Page).toHaveURL(new RegExp(`${path}$`));
});

Then('the new tab should show the heading {string}', async ({ ctx }, name: string) => {
  await expect((ctx.popup as Page).getByRole('heading', { name })).toBeVisible();
});

// ---------- visual regression ----------

Then('the page should match the screenshot {string}', async ({ page }, name: string) => {
  await expect(page).toHaveScreenshot(name, { fullPage: true, animations: 'disabled' });
});

Then('the main product image should match the screenshot {string}', async ({ productPage }, name: string) => {
  await expect(productPage.mainImage).toHaveScreenshot(name, { animations: 'disabled' });
});
