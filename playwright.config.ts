import { defineConfig, devices } from '@playwright/test';

const API_PORT = 3101;
const WEB_PORT = 5174;

/** E2E runs its own API (fresh database) and web server, separate from `pnpm dev`. */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /simulation\.spec\.ts/ },
    // Inventory automation changes random stock, so it runs alone after everything else.
    { name: 'simulation', use: { ...devices['Desktop Chrome'] }, testMatch: /simulation\.spec\.ts/, dependencies: ['chromium'] },
  ],
  webServer: [
    {
      command: `rm -f data/e2e.db data/e2e.db-wal data/e2e.db-shm && pnpm exec tsx src/server.ts`,
      cwd: 'apps/api',
      env: { PORT: String(API_PORT), DB_PATH: 'data/e2e.db' },
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false,
    },
    {
      command: `pnpm exec vite --port ${WEB_PORT} --strictPort`,
      cwd: 'apps/web',
      env: { API_URL: `http://localhost:${API_PORT}` },
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
    },
  ],
});
