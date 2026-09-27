import { expect } from '@playwright/test';
import { DataTable } from 'playwright-bdd';
import { Given, When, Then } from '../support/fixtures';

const PRODUCTS_API = /\/api\/products\?/;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Given('I open the catalog', async ({ catalogPage }) => {
  await catalogPage.goto();
});

Then('I should see {int} products', async ({ catalogPage }, count: number) => {
  await expect(catalogPage.cards).toHaveCount(count);
});

Then('the results count should be {string}', async ({ catalogPage }, text: string) => {
  await expect(catalogPage.resultsCount).toHaveText(text);
});

Then('I should see the products:', async ({ catalogPage }, table: DataTable) => {
  await expect(catalogPage.cardNames).toHaveText(table.raw().map(([name]) => name));
});

// ---------- search ----------

Given('I am recording product search requests', async ({ page, ctx }) => {
  ctx.requests = [];
  page.on('request', (req) => {
    if (PRODUCTS_API.test(req.url())) ctx.requests!.push(req.url());
  });
});

When('I type {string} into the product search', async ({ page, catalogPage }, text: string) => {
  // Type like a person (40ms between keys) so the debounce has something to do.
  await catalogPage.search.pressSequentially(text, { delay: 40 });
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(text);
  await catalogPage.waitForResults();
});

Then('exactly {int} search request should have been sent for {string}', async ({ ctx }, count: number, text: string) => {
  const searches = ctx.requests!.filter((url) => new URL(url).searchParams.has('q'));
  expect(searches, `search requests: ${searches.join(', ')}`).toHaveLength(count);
  expect(new URL(searches[0]).searchParams.get('q')).toBe(text);
});

Then('I should see the empty state {string}', async ({ page }, title: string) => {
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
});

// ---------- filters ----------

When('I tick the {string} category', async ({ catalogPage }, name: string) => {
  // The checkbox mirrors the URL, which React Router updates in a transition, so click and then assert.
  await catalogPage.category(name).click();
  await expect(catalogPage.category(name)).toBeChecked();
});

Then('every product should be in the {string} category', async ({ catalogPage }, category: string) => {
  await expect(async () => {
    await catalogPage.waitForResults();
    const categories = await catalogPage.cards.locator('.product-card-category').allTextContents();
    expect(categories.length).toBeGreaterThan(0);
    expect(new Set(categories)).toEqual(new Set([category]));
  }).toPass();
});

When('I set the {string} slider to {int}', async ({ catalogPage }, label: string, value: number) => {
  await catalogPage.setRange(label, value);
});

Then('the price range should read {string}', async ({ page }, text: string) => {
  await expect(page.getByTestId('price-range-value')).toHaveText(text);
});

Then('every product should cost at most ${int}', async ({ page, catalogPage }, max: number) => {
  await expect(page).toHaveURL(new RegExp(`maxPrice=${max}`));
  await expect(async () => {
    const prices = await catalogPage.prices();
    expect(prices.length).toBeGreaterThan(0);
    for (const price of prices) expect(price).toBeLessThanOrEqual(max);
  }).toPass();
});

When('I choose the {string} rating filter', async ({ catalogPage }, label: string) => {
  await catalogPage.rating(label).click(); // URL-controlled, like the category checkboxes
  await expect(catalogPage.rating(label)).toBeChecked();
});

Then('every product should be rated at least {int}', async ({ page, catalogPage }, min: number) => {
  await expect(page).toHaveURL(new RegExp(`rating=${min}`));
  await expect(async () => {
    const ratings = await catalogPage.ratings();
    expect(ratings.length).toBeGreaterThan(0);
    for (const rating of ratings) expect(rating).toBeGreaterThanOrEqual(min);
  }).toPass();
});

// ---------- sorting ----------

When('I sort by {string} using the native select', async ({ page, catalogPage, ctx }, label: string) => {
  const responsePromise = page.waitForResponse((res) => PRODUCTS_API.test(res.url()) && res.url().includes('sort='));
  await catalogPage.nativeSort.selectOption({ label });
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  ctx.lastProductsUrl = response.url();
});

Then('the products request should include {string}', async ({ ctx }, part: string) => {
  expect(ctx.lastProductsUrl as string).toContain(part);
});

When('I sort by {string} using the custom dropdown', async ({ page, catalogPage }, label: string) => {
  await catalogPage.customSort.click();
  await page.getByRole('listbox', { name: 'Sort order' }).getByRole('option', { name: label, exact: true }).click();
});

When('I open the custom sort dropdown with the keyboard and choose option number {int}', async ({ page, catalogPage }, n: number) => {
  await catalogPage.customSort.focus();
  await page.keyboard.press('ArrowDown'); // opens the list on the current option
  await expect(page.getByRole('listbox')).toBeVisible();
  for (let i = 1; i < n; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
});

Then('the custom sort dropdown should show {string}', async ({ catalogPage }, label: string) => {
  await expect(catalogPage.customSort).toContainText(label);
});

Then('the native sort select should show {string}', async ({ catalogPage }, value: string) => {
  await expect(catalogPage.nativeSort).toHaveValue(value);
});

Then('the product prices should be sorted {word}', async ({ catalogPage }, direction: string) => {
  await expect(async () => {
    const prices = await catalogPage.prices();
    const sorted = [...prices].sort((a, b) => (direction === 'ascending' ? a - b : b - a));
    expect(prices.length).toBeGreaterThan(1);
    expect(prices).toEqual(sorted);
  }).toPass();
});

// ---------- pagination & infinite scroll ----------

When('I go to page {int}', async ({ catalogPage }, n: number) => {
  await catalogPage.pagination.getByRole('button', { name: `Page ${n}` }).click();
});

Then('page {int} should be the current page', async ({ catalogPage }, n: number) => {
  await expect(catalogPage.pagination.getByRole('button', { name: `Page ${n}` })).toHaveAttribute('aria-current', 'page');
});

When('I switch to {string} mode', async ({ catalogPage }, mode: string) => {
  await catalogPage.chooseView(mode as 'Pages' | 'Infinite scroll');
  await catalogPage.waitForResults();
});

When('I scroll to the bottom until all products are loaded', async ({ page, catalogPage }) => {
  await expect(async () => {
    await page.getByTestId('infinite-sentinel').scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 4000);
    await expect(catalogPage.cards).toHaveCount(48, { timeout: 1500 });
  }).toPass({ timeout: 30_000 });
});

// ---------- network mocking with page.route ----------

Given('the products API responds after {int} ms', async ({ page }, ms: number) => {
  await page.route(PRODUCTS_API, async (route) => {
    await sleep(ms);
    await route.continue().catch(() => {}); // the page may have navigated away meanwhile
  });
});

Given('the products API returns no products', async ({ page }) => {
  await page.route(PRODUCTS_API, (route) => route.fulfill({ json: { items: [], total: 0, page: 1, pages: 1, limit: 12 } }));
});

Given('the products API fails with status {int}', async ({ page }, status: number) => {
  await page.route(PRODUCTS_API, (route) => route.fulfill({ status, json: { error: 'Simulated failure' } }));
});

When('the products API recovers', async ({ page }) => {
  await page.unroute(PRODUCTS_API);
});

Then('I should see {int} skeleton loaders', async ({ catalogPage }, count: number) => {
  await expect(catalogPage.skeletons).toHaveCount(count);
});

Then('the skeleton loaders should disappear', async ({ catalogPage }) => {
  await expect(catalogPage.skeletons).toHaveCount(0, { timeout: 10_000 });
});

Then('I should see the catalog error message', async ({ catalogPage }) => {
  await expect(catalogPage.errorState).toBeVisible();
});
