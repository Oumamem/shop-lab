import { expect, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';
import { test as base, createBdd } from 'playwright-bdd';
import {
  AdminOrdersPage,
  AdminProductsPage,
  CartPage,
  CatalogPage,
  CheckoutPage,
  Header,
  LoginPage,
  ProductPage,
  ProfilePage,
  RegisterPage,
} from '../pages';
import { STORAGE, USERS, type Role } from './data';

// Per-scenario scratch space shared between steps (responses, downloads, dialog messages...).
export type ScenarioContext = {
  token?: string;
  response?: APIResponse;
  requests?: string[];
  wsFrames?: string[];
  dialogMessage?: string;
  orderNumber?: string;
  [key: string]: unknown;
};

type Fixtures = {
  resetDb: void;
  ctx: ScenarioContext;
  header: Header;
  loginPage: LoginPage;
  registerPage: RegisterPage;
  catalogPage: CatalogPage;
  productPage: ProductPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
  profilePage: ProfilePage;
  adminProductsPage: AdminProductsPage;
  adminOrdersPage: AdminOrdersPage;
};

export const test = base.extend<Fixtures>({
  // Every scenario starts from the same seed data.
  resetDb: [
    async ({ request }, use) => {
      const res = await request.post('/api/reset');
      expect(res.ok(), 'POST /api/reset should succeed').toBeTruthy();
      await use();
    },
    { auto: true },
  ],
  ctx: async ({}, use) => use({}),
  header: async ({ page }, use) => use(new Header(page)),
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  registerPage: async ({ page }, use) => use(new RegisterPage(page)),
  catalogPage: async ({ page }, use) => use(new CatalogPage(page)),
  productPage: async ({ page }, use) => use(new ProductPage(page)),
  cartPage: async ({ page }, use) => use(new CartPage(page)),
  checkoutPage: async ({ page }, use) => use(new CheckoutPage(page)),
  profilePage: async ({ page }, use) => use(new ProfilePage(page)),
  adminProductsPage: async ({ page }, use) => use(new AdminProductsPage(page)),
  adminOrdersPage: async ({ page }, use) => use(new AdminOrdersPage(page)),
});

export const { Given, When, Then, Before, After } = createBdd(test);

export async function apiLogin(request: APIRequestContext, role: Role, remember = true) {
  const { email, password } = USERS[role];
  const res = await request.post('/api/auth/login', { data: { email, password, remember } });
  expect(res.ok(), `API login as ${role}`).toBeTruthy();
  return (await res.json()).token as string;
}

// Log in through the API and hand the token to the app, skipping the login UI.
// A lightweight page on the app origin is opened first so we can write to its localStorage.
export async function loginAs(page: Page, request: APIRequestContext, role: Role) {
  const token = await apiLogin(request, role);
  await page.goto('/403');
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [STORAGE.token, token]);
  return token;
}
