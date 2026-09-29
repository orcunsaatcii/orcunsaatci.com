// playwright.config.ts
import { defineConfig, devices, type Project } from '@playwright/test';

const PORT = 3000;
const baseURL = process.env.BASE_URL ?? `http://localhost:${PORT}`;
const SWIFTSHADER = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const DESKTOP = { width: 1440, height: 900 };
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

/** Her proje yalnız kendi etiketini (@<ad>) ve @all etiketli testleri koşar. */
const project = (name: string, use: Project['use']): Project => ({
  name,
  grep: [new RegExp(`@${name}(?![\\w-])`), /@all(?![\w-])/],
  use,
});

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', scale: 'css' },
  },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  snapshotPathTemplate:
    '{testDir}/__screenshots__/{projectName}/{platform}/{testFilePath}/{arg}{ext}',
  use: {
    baseURL,
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    colorScheme: 'light',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Yalnız korumalı bir Preview'a karşı elle koşarken (§13.3.7)
    extraHTTPHeaders: bypass
      ? { 'x-vercel-protection-bypass': bypass, 'x-vercel-skip-toolbar': '1' }
      : undefined,
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `npm run start -- -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    project('desktop-chromium', {
      ...devices['Desktop Chrome'],
      viewport: DESKTOP,
      launchOptions: { args: SWIFTSHADER },
    }),
    project('pixel-7', { ...devices['Pixel 7'], launchOptions: { args: SWIFTSHADER } }),
    project('iphone-15', { ...devices['iPhone 15'] }),
    project('reduced-motion', {
      ...devices['Desktop Chrome'],
      viewport: DESKTOP,
      reducedMotion: 'reduce',
      launchOptions: { args: SWIFTSHADER },
    }),
    project('no-js', { ...devices['Desktop Chrome'], viewport: DESKTOP, javaScriptEnabled: false }),
    project('no-webgl', {
      ...devices['Desktop Chrome'],
      viewport: DESKTOP,
      launchOptions: { args: ['--disable-webgl'] },
    }),
    // İSTEĞE BAĞLI, yalnız yerel: K-WORK-10 (sticky grid örtüşmesi) için masaüstü WebKit ve Firefox.
    ...(process.env.PW_CROSS === '1'
      ? [
          project('desktop-webkit', { ...devices['Desktop Safari'], viewport: DESKTOP }),
          project('desktop-firefox', { ...devices['Desktop Firefox'], viewport: DESKTOP }),
        ]
      : []),
  ],
});
