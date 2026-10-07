import { defineConfig, devices } from '@playwright/test';

const API_PORT = 3101;
const WEB_PORT = 5174;
/** Fake Razorpay (F-014): see e2e/fake-razorpay-server.ts. */
const RAZORPAY_PORT = 3199;

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
      command: 'pnpm exec tsx ../../e2e/fake-razorpay-server.ts',
      cwd: 'apps/api',
      url: `http://localhost:${RAZORPAY_PORT}/__health`,
      reuseExistingServer: false,
    },
    {
      command: `rm -f data/e2e.db data/e2e.db-wal data/e2e.db-shm && pnpm exec tsx src/server.ts`,
      cwd: 'apps/api',
      // Test keys against the local fake; these win over anything in apps/api/.env.
      env: {
        PORT: String(API_PORT),
        DB_PATH: 'data/e2e.db',
        RAZORPAY_KEY_ID: 'rzp_test_e2e',
        RAZORPAY_KEY_SECRET: 'e2e_test_secret',
        RAZORPAY_API_BASE_URL: `http://localhost:${RAZORPAY_PORT}`,
        RAZORPAY_WEBHOOK_SECRET: '',
        RAZORPAY_NO_COST_EMI_OFFER_ID: '',
        // Codes stay on screen (demo) even when apps/api/.env has SMTP settings (F-016)…
        SMTP_HOST: '',
        SMTP_PORT: '',
        SMTP_USER: '',
        SMTP_PASS: '',
        SMTP_FROM: '',
        // …and the many sign-ups from one address aren't stopped by the per-IP code limit.
        OTP_MAX_SENDS_PER_IP_PER_HOUR: '10000',
      },
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
