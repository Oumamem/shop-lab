import { expect } from '@playwright/test';
import { DataTable } from 'playwright-bdd';
import { Given, When, Then } from '../support/fixtures';

Given('I am on the login page', async ({ loginPage }) => {
  await loginPage.goto();
});

Given('I am on the registration page', async ({ page }) => {
  await page.goto('/register');
});

Given('I am on the forgot password page', async ({ page }) => {
  await page.goto('/forgot-password');
});

When('I log in as {string} with password {string}', async ({ loginPage }, email: string, password: string) => {
  await loginPage.login(email, password);
});

When('I log in as {string} with password {string} and "Remember me" checked', async ({ loginPage }, email: string, password: string) => {
  await loginPage.login(email, password, true);
});

When('I submit the login form without filling it in', async ({ loginPage }) => {
  await loginPage.submit.click();
});

When('I fail to log in as {string} {int} times', async ({ loginPage }, email: string, times: number) => {
  for (let attempt = 1; attempt <= times; attempt++) {
    await loginPage.login(email, `WrongPassword${attempt}`);
    // Wait for the server's answer before trying again.
    await expect(loginPage.error).toBeVisible();
    await expect(loginPage.submit).toBeEnabled();
  }
});

Then('I should see the login error {string}', async ({ loginPage }, message: string) => {
  await expect(loginPage.error).toContainText(message);
});

When('I request a password reset for {string}', async ({ page }, email: string) => {
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
});

Then('the header should show the signed-in user {string}', async ({ header }, name: string) => {
  await expect(header.currentUser).toHaveText(name);
});

Then('the header should show the {string} link', async ({ header }, name: string) => {
  await expect(header.nav.getByRole('link', { name, exact: true })).toBeVisible();
});

Then('I should not see the {string} link in the header', async ({ header }, name: string) => {
  await expect(header.logoutButton).toBeVisible(); // page has rendered for a signed-in user
  await expect(header.nav.getByRole('link', { name, exact: true })).toHaveCount(0);
});

When('my session expires on the server', async ({ request, ctx }) => {
  const res = await request.post('/api/test/expire-sessions', { data: { token: ctx.token } });
  expect(res.ok()).toBeTruthy();
});

When('I register with:', async ({ registerPage }, table: DataTable) => {
  const data = table.rowsHash();
  for (const [label, value] of Object.entries(data)) {
    if (label === 'terms') {
      if (value === 'accepted') await registerPage.terms.check();
      continue;
    }
    await registerPage.field(label).fill(value);
  }
  await registerPage.submit.click();
});

When('I type {string} into the {string} field', async ({ page }, value: string, label: string) => {
  await page.getByLabel(label, { exact: true }).pressSequentially(value);
});

Then('the password strength should be {string}', async ({ registerPage }, label: string) => {
  await expect(registerPage.strength).toHaveAttribute('aria-valuetext', label);
});
