import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  expect: {
    timeout: 7_500,
    toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.01, threshold: 0.2 },
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? '50%' : undefined,
  timeout: 45_000,
  reporter: process.env.CI ? [['list'], ['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'off',
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
  },
  projects: [
    {
      name: 'chromium-320',
      testMatch: ['**/responsive.spec.ts'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'chromium-375',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'chromium-390',
      testMatch: ['**/responsive.spec.ts'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'chromium-landscape',
      testMatch: ['**/responsive.spec.ts'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'chromium-tablet',
      testMatch: ['**/responsive.spec.ts', '**/visual-regression.spec.ts'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, hasTouch: true },
    },
    {
      name: 'chromium-desktop-1280',
      testMatch: ['**/responsive.spec.ts'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'chromium-desktop-1440',
      testMatch: ['**/responsive.spec.ts', '**/visual-regression.spec.ts'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'webkit-375',
      testMatch: ['**/responsive.spec.ts', '**/finance-flow.spec.ts'],
      use: { ...devices['iPhone 13'], viewport: { width: 375, height: 812 } },
    },
    {
      name: 'webkit-390',
      testMatch: ['**/responsive.spec.ts'],
      use: { ...devices['iPhone 15'], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
