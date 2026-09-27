import { expect, type Page } from '@playwright/test';
import { DataTable } from 'playwright-bdd';
import { Given, When, Then } from '../support/fixtures';
import { STORAGE } from '../support/data';

const MAX_QTY = 10;

// Seeds the cart straight into localStorage, the same shape the app writes.
Given('my cart contains:', async ({ page, request }, table: DataTable) => {
  const items = [];
  for (const row of table.hashes()) {
    const search = await (await request.get(`/api/products?delay=0&limit=100&q=${encodeURIComponent(row.product)}`)).json();
    const summary = search.items.find((p: { name: string }) => p.name === row.product);
    expect(summary, `product "${row.product}" exists`).toBeTruthy();
    const product = await (await request.get(`/api/products/${summary.id}?delay=0`)).json();
    const size = row.size || null;
    const color = row.color || null;
    const stock = Math.min(
      product.stock,
      size ? product.sizes.find((s: { name: string }) => s.name === size).stock : Infinity,
      color ? product.colors.find((c: { name: string }) => c.name === color).stock : Infinity,
      MAX_QTY,
    );
    items.push({
      key: [product.id, size, color].filter(Boolean).join('-'),
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      size,
      color,
      qty: Number(row.qty),
      maxQty: stock,
    });
  }
  if (!page.url().startsWith('http')) await page.goto('/403');
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [STORAGE.cart, JSON.stringify({ items, coupon: null })]);
});

const storedCart = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{"items":[]}'), STORAGE.cart) as Promise<{ items: { name: string }[] }>;

Then('the order summary should show:', async ({ cartPage }, table: DataTable) => {
  for (const [line, value] of Object.entries(table.rowsHash())) {
    await expect(cartPage.summary(line as 'total')).toHaveText(value);
  }
});

When('I change the quantity of {string} to {int}', async ({ cartPage }, name: string, qty: number) => {
  await cartPage.quantity(name).fill(String(qty));
  await cartPage.quantity(name).press('Enter');
});

When('I remove {string} from the cart', async ({ cartPage }, name: string) => {
  await cartPage.remove(name).click();
});

Then('the cart should contain {string}', async ({ cartPage }, name: string) => {
  await expect(cartPage.item(name)).toBeVisible();
});

Then('the stored cart should be empty', async ({ page }) => {
  await expect.poll(async () => (await storedCart(page)).items.length).toBe(0);
});

Then('the stored cart should contain {string}', async ({ page }, name: string) => {
  await expect.poll(async () => (await storedCart(page)).items.map((i) => i.name)).toContain(name);
});

When('I apply the coupon {string}', async ({ cartPage }, code: string) => {
  await cartPage.couponInput.fill(code);
  await cartPage.applyCoupon.click();
});

// ---------- checkout ----------

const DEFAULT_ADDRESS = { 'Street address': '1 Test Street', City: 'Testville', 'Postal code': '12345', Country: 'United States' };

async function fillAddress(page: Page, address: Record<string, string>) {
  for (const [label, value] of Object.entries(address)) {
    const field = page.getByLabel(label, { exact: true });
    if (label === 'Country') await field.selectOption(value);
    else await field.fill(value);
  }
}

async function dayLabel(page: Page, offset: number) {
  // Computed in the browser so it uses the browser's time zone, like the date picker does.
  return page.evaluate((n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }, offset);
}

async function pickDate(page: Page, offset: number) {
  await page.getByRole('button', { name: 'Choose date' }).click();
  await page.getByRole('dialog', { name: 'Choose delivery date' }).getByRole('button', { name: await dayLabel(page, offset) }).click();
}

When('I fill in the shipping address:', async ({ page }, table: DataTable) => {
  await fillAddress(page, table.rowsHash());
});

Given('I am on the shipping step of checkout', async ({ page }) => {
  await page.goto('/checkout');
  await fillAddress(page, DEFAULT_ADDRESS);
  await page.getByRole('button', { name: 'Continue to shipping' }).click();
  await expect(page.getByRole('heading', { name: 'Shipping method' })).toBeVisible();
});

Given('I am on the payment step of checkout', async ({ page }) => {
  await page.goto('/checkout');
  await fillAddress(page, DEFAULT_ADDRESS);
  await page.getByRole('button', { name: 'Continue to shipping' }).click();
  await pickDate(page, 2);
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await expect(page.getByRole('heading', { name: 'Payment', exact: true })).toBeVisible();
});

When('I choose {string} shipping', async ({ page }, method: string) => {
  await page.getByRole('radio', { name: new RegExp(`^${method}`) }).check();
});

When('I open the delivery date picker', async ({ checkoutPage }) => {
  await checkoutPage.openCalendar();
});

for (const state of ['disabled', 'enabled'] as const) {
  Then(`the date {int} days from today should be ${state}`, async ({ page, checkoutPage }, offset: number) => {
    const day = checkoutPage.calendar.getByRole('button', { name: await dayLabel(page, offset) });
    if (state === 'disabled') await expect(day).toBeDisabled();
    else await expect(day).toBeEnabled();
  });
}

Then('the delivery date picker should be closed', async ({ checkoutPage }) => {
  await expect(checkoutPage.calendar).toBeHidden();
});

When('I pick the delivery date {int} days from today', async ({ page }, offset: number) => {
  await pickDate(page, offset);
  await expect(page.getByLabel('Delivery date')).toHaveValue(await dayLabel(page, offset));
});

When('I pay with card {string} expiring {string} with CVC {string}', async ({ checkoutPage }, number: string, expiry: string, cvc: string) => {
  await checkoutPage.payWith(number, expiry, cvc);
});

Then('I should see the saved card ending in {string}', async ({ checkoutPage }, last4: string) => {
  await expect(checkoutPage.savedCard).toContainText(`ending in ${last4}`);
});

Then('the payment frame should show the error {string}', async ({ checkoutPage }, text: string) => {
  await expect(checkoutPage.paymentFrame.getByText(text)).toBeVisible();
});

When('I place the order', async ({ checkoutPage }) => {
  await checkoutPage.placeOrder.click();
});

Then('I should see an order number', async ({ page }) => {
  await expect(page.getByTestId('order-number')).toHaveText(/^ORD-\d+$/);
});

Then('the order total should be {string}', async ({ page }, total: string) => {
  await expect(page.getByTestId('order-total')).toHaveText(total);
});

Then('I should see the order error {string}', async ({ checkoutPage }, text: string) => {
  await expect(checkoutPage.orderError).toHaveText(text);
});
