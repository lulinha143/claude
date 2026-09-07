import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/typography',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4174',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://localhost:4174/typography.html',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
