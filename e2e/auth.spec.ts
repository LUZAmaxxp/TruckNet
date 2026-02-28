/**
 * E2E Smoke — Authentication pages
 *
 * Verifies that:
 *  1. The register page renders with email, password, and name fields
 *  2. The login page renders with email and password fields
 *  3. Basic client-side validation is visible (empty-submit shows errors)
 *
 * These tests do NOT attempt real DB registration/login — they cover
 * the UI layer only so no live DATABASE_URL is required.
 */
import { test, expect } from "@playwright/test";

test.describe("Register page", () => {
  test("renders heading and form fields", async ({ page }) => {
    await page.goto("/register");

    // Page title / heading
    await expect(page).toHaveTitle(/TruckConnect|Register/i);

    // Form inputs
    await expect(page.getByLabel(/name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();

    // Submit button visible
    await expect(page.getByRole("button", { name: /register|create account|sign up/i })).toBeVisible();
  });

  test("shows validation error when submitting empty form", async ({ page }) => {
    await page.goto("/register");

    // Click submit without filling in any fields
    await page.getByRole("button", { name: /register|create account|sign up/i }).click();

    // Expect some error message or HTML validation to appear
    // (either native browser validation or React state error)
    const errorVisible =
      (await page.locator("[role='alert'], .error, [data-error]").count()) > 0 ||
      (await page.locator("input:invalid").count()) > 0;

    expect(errorVisible).toBe(true);
  });
});

test.describe("Login page", () => {
  test("renders heading and form fields", async ({ page }) => {
    await page.goto("/login");

    await expect(page).toHaveTitle(/TruckConnect|Login|Sign in/i);
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /log in|sign in|login/i })).toBeVisible();
  });

  test("login page links to register", async ({ page }) => {
    await page.goto("/login");

    const registerLink = page.getByRole("link", { name: /register|sign up|create/i });
    await expect(registerLink).toBeVisible();
  });
});
