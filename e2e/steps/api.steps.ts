import { expect } from '@playwright/test';
import { Given, When, Then, apiLogin } from '../support/fixtures';
import type { Role } from '../support/data';

const authHeaders = (token?: string) => (token ? { Authorization: `Bearer ${token}` } : {});

const readPath = (obj: unknown, path: string) =>
  path.split('.').reduce<unknown>((value, key) => (value == null ? undefined : (value as Record<string, unknown>)[key]), obj);

Given('I use an API token for {string}', async ({ request, ctx }, who: string) => {
  ctx.token = who === 'anonymous' ? undefined : await apiLogin(request, who as Role);
});

for (const method of ['GET', 'DELETE'] as const) {
  When(`I send a ${method} request to {string}`, async ({ request, ctx }, url: string) => {
    ctx.response = await request.fetch(url, { method, headers: authHeaders(ctx.token) });
  });
}

When('I send a POST request to {string} with:', async ({ request, ctx }, url: string, body: string) => {
  ctx.response = await request.post(url, { data: JSON.parse(body), headers: authHeaders(ctx.token) });
});

Then('the response status should be {int}', async ({ ctx }, status: number) => {
  expect(ctx.response!.status(), await ctx.response!.text()).toBe(status);
});

Then('the response field {string} should be {int}', async ({ ctx }, path: string, value: number) => {
  expect(readPath(await ctx.response!.json(), path)).toBe(value);
});

Then('the response field {string} should be {string}', async ({ ctx }, path: string, value: string) => {
  expect(readPath(await ctx.response!.json(), path)).toBe(value);
});
