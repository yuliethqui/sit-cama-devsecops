import { defineConfig, devices } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

process.env['PLAYWRIGHT_BROWSERS_PATH'] ??= resolve(__dirname, '.tools/playwright');

process.env['SITCAMA_E2E_PASSWORD'] ??= randomBytes(30).toString('base64url');
process.env['SITCAMA_E2E_SCHEMA'] ??= `sitcama_mobile_test_${randomUUID().replaceAll('-', '')}`;

const baseURL = 'http://localhost:4200';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: 2,
  expect: { timeout: 15000 },
  globalSetup: './e2e/global-setup.cjs',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ...(process.env.CI ? ([['github'], ['html', { open: 'never' }]] as const) : ([['list']] as const)),
    ['json', { outputFile: '../../.reports/devsecops/e2e-tests.json' }],
  ],
  use: {
    baseURL,
    trace: 'off',
  },
  projects: [
    {
      name: 'Mobile Chrome',
      testIgnore: '**/responsive.spec.ts',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'Desktop Chrome',
      testIgnore: '**/responsive.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
    ...[360, 768, 1440].map((width) => ({
      name: `Visual ${width}`,
      testMatch: '**/responsive.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width, height: 1000 } },
    })),
  ],
  webServer: [
    {
      command: 'node e2e/api-server.cjs',
      url: 'http://localhost:3101/api/health',
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: `${process.platform === 'win32' ? 'npm.cmd' : 'npm'} start -- --configuration e2e --host localhost --port 4200`,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
