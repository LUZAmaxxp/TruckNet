/**
 * E2E Smoke — Navigation & access control
 *
 * Verifies that:
 *  1. Root URL resolves to a meaningful page (no 5xx)
 *  2. Login and register pages are publicly accessible (200)
 *  3. Protected routes are handled by the server (200 or redirect — no server error)
 *
 * These tests confirm the app boots correctly and basic routing works.
 * They do NOT require a real database — they only check HTTP status codes
 * and that the dev server has no catastrophic startup errors.
 */
import { test, expect } from "@playwright/test";

test.describe("Root page", () => {
  test("resolves without a 5xx server error", async ({ page }) => {
    const response = await page.goto("/");
    const status = response?.status() ?? 200;
    expect(status).toBeLessThan(500);
  });
});

test.describe("Public pages are reachable (no auth required)", () => {
  test("login page returns 200", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.status()).toBe(200);
    // Basic DOM: the form should be present
    await expect(page.locator("form")).toBeVisible();
  });

  test("register page returns 200", async ({ page }) => {
    const response = await page.goto("/register");
    expect(response?.status()).toBe(200);
    await expect(page.locator("form")).toBeVisible();
  });
});

test.describe("Protected routes respond without server error", () => {
  const PROTECTED = ["/dashboard", "/map", "/messages", "/stress"];

  for (const route of PROTECTED) {
    test(`${route} responds without 5xx`, async ({ page }) => {
      // Either renders the page (200) or redirects to login (3xx) —
      // both are acceptable; a 500 would indicate a boot-time crash.
      const response = await page.goto(route);
      const status = response?.status() ?? 200;
      expect(status).toBeLessThan(500);
    });
  }
});

