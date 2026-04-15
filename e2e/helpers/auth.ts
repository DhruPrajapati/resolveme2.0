import { type Page, expect } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";

export const ADMIN_EMAIL = "admin@test.com";
export const ADMIN_PASSWORD = "testAdmin1234!";

export const AGENT_EMAIL = "agent@test.com";
export const AGENT_PASSWORD = "testAgent1234!";

/**
 * Navigate to /login, fill credentials, submit, and wait for the dashboard.
 * Use this in beforeEach for tests that need a fresh server-side session.
 */
export async function loginAs(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(email, password);
  await page.waitForURL("/");
  await expect(page.getByText("Welcome to ResolveMe")).toBeVisible();
}

/**
 * Click the NavBar "Sign out" button and wait for the redirect to /login.
 */
export async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL("/login");
}
