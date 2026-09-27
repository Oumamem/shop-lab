import fs from 'node:fs/promises';
import { expect, type Download } from '@playwright/test';
import { DataTable } from 'playwright-bdd';
import { Given, When, Then } from '../support/fixtures';
import { escapeRegExp } from './common.steps';

// ---------- dashboard ----------

Then('the {string} stat should be {string}', async ({ page }, stat: string, value: string) => {
  await expect(page.getByTestId(`stat-${stat}`)).toHaveText(value);
});

Then('the chart {string} should report {string}', async ({ page }, label: string, summary: string) => {
  await expect(page.getByRole('img', { name: new RegExp(`^${escapeRegExp(label)}\\.`) })).toHaveAccessibleName(`${label}. ${summary}`);
});

Then('the chart {string} should be drawn on a canvas', async ({ page }, label: string) => {
  const chart = page.getByRole('img', { name: new RegExp(`^${escapeRegExp(label)}\\.`) });
  await expect(chart).toBeVisible();
  // Canvas pixels are not in the DOM, so read them back to prove something was drawn.
  await expect
    .poll(() =>
      chart.evaluate((canvas: HTMLCanvasElement) => {
        const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
        let painted = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 0) painted++;
        return canvas.tagName === 'CANVAS' ? painted : 0;
      }),
    )
    .toBeGreaterThan(1000);
});

// ---------- products table ----------

Given('I am on the admin products page', async ({ adminProductsPage }) => {
  await adminProductsPage.goto();
});

When('I search the products table for {string}', async ({ adminProductsPage }, text: string) => {
  await adminProductsPage.search.fill(text);
});

Then('the products table should have {int} row', async ({ adminProductsPage }, count: number) => {
  await expect(adminProductsPage.rows).toHaveCount(count);
});

Then('the product count should be {string}', async ({ adminProductsPage }, text: string) => {
  await expect(adminProductsPage.count).toHaveText(text);
});

When('I sort the products table by {string}', async ({ adminProductsPage }, column: string) => {
  await adminProductsPage.sortBy(column).click();
});

Then('the {string} column should be sorted {string}', async ({ adminProductsPage }, column: string, direction: string) => {
  await expect(adminProductsPage.header(column)).toHaveAttribute('aria-sort', direction);
});

Then('the first product row should contain {string}', async ({ adminProductsPage }, text: string) => {
  await expect(adminProductsPage.rows.first()).toContainText(text);
});

When('I edit the {string} of {string} to {string}', async ({ page, adminProductsPage }, field: string, product: string, value: string) => {
  await page.getByRole('button', { name: `Edit ${product}` }).click();
  const editingRow = adminProductsPage.rows.filter({ has: page.getByRole('button', { name: 'Save' }) });
  await editingRow.getByLabel(field, { exact: true }).fill(value);
  await editingRow.getByRole('button', { name: 'Save' }).click();
});

When('I start editing {string} and press Escape', async ({ page }, product: string) => {
  await page.getByRole('button', { name: `Edit ${product}` }).click();
  await expect(page.getByRole('textbox', { name: 'Name' })).toBeFocused();
  await page.keyboard.press('Escape');
});

Then('the row for {string} should contain {string}', async ({ adminProductsPage }, product: string, text: string) => {
  await expect(adminProductsPage.row(product)).toContainText(text);
});

When('I fill the product form with:', async ({ page }, table: DataTable) => {
  const dialog = page.getByRole('dialog', { name: 'Add product' });
  for (const [label, value] of Object.entries(table.rowsHash())) {
    const field = dialog.getByLabel(label, { exact: true });
    if (label === 'Category') await field.selectOption(value);
    else await field.fill(value);
  }
});

When('I select the products:', async ({ page }, table: DataTable) => {
  for (const [name] of table.raw()) {
    await page.getByRole('checkbox', { name: `Select ${name}` }).check();
  }
});

When('I confirm the deletion', async ({ page }) => {
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
});

Then('the downloaded CSV should have the header {string}', async ({ ctx }, header: string) => {
  const text = await fs.readFile(await (ctx.download as Download).path(), 'utf8');
  expect(text.split('\n')[0]).toBe(header);
});

Then('the downloaded CSV should have {int} data rows', async ({ ctx }, count: number) => {
  const text = await fs.readFile(await (ctx.download as Download).path(), 'utf8');
  expect(text.trim().split('\n').length - 1).toBe(count);
});

When('I import the CSV:', async ({ adminProductsPage }, csv: string) => {
  await adminProductsPage.importInput.setInputFiles({ name: 'products.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
});

Then('the import result should say {string}', async ({ adminProductsPage }, text: string) => {
  await expect(adminProductsPage.importResult).toContainText(text);
});

// ---------- orders kanban ----------

When('I drag order {string} to the {string} column', async ({ adminOrdersPage }, order: string, column: string) => {
  // Grab the card by its header and drop near the top of the column: aiming at the centre of a tall
  // column makes Playwright scroll mid-gesture, which starts the drag on the wrong card.
  await adminOrdersPage.card(order).dragTo(adminOrdersPage.column(column), { sourcePosition: { x: 30, y: 15 }, targetPosition: { x: 40, y: 20 } });
});

When('I set the status of {string} to {string}', async ({ page }, order: string, status: string) => {
  await page.getByLabel(`Status for ${order}`).selectOption({ label: status });
});

Then('the {string} column should contain order {string}', async ({ adminOrdersPage }, column: string, order: string) => {
  await expect(adminOrdersPage.column(column).getByTestId(`order-card-${order}`)).toBeVisible();
});

Then('the {string} column count should be {int}', async ({ adminOrdersPage }, column: string, count: number) => {
  await expect(adminOrdersPage.columnCount(column)).toHaveText(String(count));
});

// ---------- real-time updates ----------

Given('I am monitoring the live updates WebSocket', async ({ page, ctx }) => {
  ctx.wsFrames = [];
  page.on('websocket', (ws) => {
    if (!ws.url().includes('/ws')) return; // ignore Vite's hot-reload socket
    ws.on('framereceived', (frame) => ctx.wsFrames!.push(String(frame.payload)));
  });
});

Given('live updates are connected', async ({ adminOrdersPage }) => {
  await expect(adminOrdersPage.liveStatus).toHaveText('Live updates on');
});

When('another customer places an order', async ({ request, ctx }) => {
  const res = await request.post('/api/test/new-order');
  expect(res.ok()).toBeTruthy();
  ctx.orderNumber = (await res.json()).number;
});

Then('a WebSocket message of type {string} should be received', async ({ ctx }, type: string) => {
  await expect
    .poll(() => ctx.wsFrames!.map((f) => JSON.parse(f)).find((m) => m.type === type && m.order?.number === ctx.orderNumber))
    .toBeTruthy();
});

Then('the {string} column should contain the new order', async ({ adminOrdersPage, ctx }, column: string) => {
  await expect(adminOrdersPage.column(column).getByTestId(`order-card-${ctx.orderNumber}`)).toBeVisible();
});
