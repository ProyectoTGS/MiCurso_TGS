import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL: 'http://127.0.0.1:3101',
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'npm run build && npm run start -- --port 3101 --hostname 127.0.0.1',
    url: 'http://127.0.0.1:3101',
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
