import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for TruckConnect.
 *
 * Runs smoke tests against the Next.js dev server (started automatically).
 * Tests live in the e2e/ directory.
 *
 * Run with:  npm run test:e2e
 * CI usage:  PLAYWRIGHT_CHROMIUM_SANDBOXED=false npm run test:e2e
 */
export default defineConfig({
  testDir: "./e2e",

  /* Maximum time a single test can run. */
  timeout: 30_000,

  /* Allow up to 2 retries on CI to handle network flakiness. */
  retries: process.env.CI ? 2 : 0,

  /* Reporter: line output in CI; interactive HTML report locally. */
  reporter: process.env.CI ? "line" : "html",

  /* Shared settings for all tests. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL: "http://localhost:3000",

    /* Capture screenshot only on failure. */
    screenshot: "only-on-failure",

    /* Record trace on first retry so failures are debuggable. */
    trace: "on-first-retry",
  },

  /* Only test in Chromium for the smoke suite. */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* Start the Next.js dev server before running tests.
   * Provides minimal dummy env vars so the server boots without a real DB.
   * E2e smoke tests only verify routing, HTML structure, and redirects —
   * they do not submit forms or hit the database. */
  webServer: {
    command: "npx next dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      DATABASE_URL: "postgresql://e2e:e2e@localhost:5432/e2e_placeholder",
      NEXTAUTH_SECRET: "e2e-test-secret-not-real-32-chars!!",
      NEXTAUTH_URL: "http://localhost:3000",
      SOCKET_PORT: "3001",
    },
  },
});
