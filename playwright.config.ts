import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig, cucumberReporter } from 'playwright-bdd';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

// Gherkin .feature files are compiled into Playwright specs in .features-gen/ by `bddgen`.
const testDir = defineBddConfig({
  features: 'e2e/features/**/*.feature',
  steps: ['e2e/steps/**/*.ts', 'e2e/support/fixtures.ts'],
  outputDir: '.features-gen',
});

export default defineConfig({
  testDir,
  // Every scenario resets the shared in-memory database, so scenarios must not run concurrently.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 45_000,
  // Keep visual baselines next to the features (not in the generated .features-gen folder).
  snapshotPathTemplate: 'e2e/__screenshots__/{projectName}/{platform}/{arg}{ext}',
  expect: { timeout: 7_000 },

  reporter: [
    ['list'],
    cucumberReporter('html', { outputFile: 'reports/cucumber-report.html' }),
    cucumberReporter('json', { outputFile: 'reports/cucumber-report.json' }),
    cucumberReporter('junit', { outputFile: 'reports/cucumber-report.xml', suiteName: 'ShopLab E2E' }),
    ['html', { outputFolder: 'reports/playwright-report', open: 'never' }],
  ],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'light',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, grepInvert: /@mobile|@visual/ },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, grepInvert: /@mobile|@visual/ },
    // WebKit does not move focus to links with Tab by default (Safari behaviour).
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, grepInvert: /@mobile|@visual|@no-webkit/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
    { name: 'visual', use: { ...devices['Desktop Chrome'] }, grep: /@visual/ },
  ],

  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { API_LATENCY: process.env.API_LATENCY ?? '300' },
  },
});
