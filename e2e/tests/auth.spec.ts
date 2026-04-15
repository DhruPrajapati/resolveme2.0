/**
 * Authentication e2e tests.
 *
 * Covers:
 *  - Login flow (success, wrong password, unknown email, empty fields, bad format)
 *  - Session & protected routes (redirect when unauthenticated, redirect when already logged in)
 *  - Session persistence across page reload
 *  - Role-based access (admin can reach /user, agent is redirected away)
 *  - Logout (clears session, protected routes redirect again)
 */
import { test, expect } from "@playwright/test";
import path from "path";
import { LoginPage } from "../pages/LoginPage";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  AGENT_EMAIL,
  AGENT_PASSWORD,
  loginAs,
  logout,
} from "../helpers/auth";

const ADMIN_AUTH_FILE = path.join(__dirname, "../.auth/admin.json");
const AGENT_AUTH_FILE = path.join(__dirname, "../.auth/agent.json");

// ---------------------------------------------------------------------------
// LOGIN FLOW — unauthenticated browser (no storageState)
// ---------------------------------------------------------------------------

test.describe("Login flow", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("successful login with valid admin credentials navigates to home", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.expectOnLoginPage();
    await loginPage.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL("/");
    await expect(page.getByText("Welcome to ResolveMe")).toBeVisible();
  });

  test("successful login with valid agent credentials navigates to home", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(AGENT_EMAIL, AGENT_PASSWORD);
    await expect(page).toHaveURL("/");
    await expect(page.getByText("Welcome to ResolveMe")).toBeVisible();
  });

  test("login failure with wrong password shows error message", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(ADMIN_EMAIL, "wrongpassword99!");
    await expect(page).toHaveURL("/login");
    await expect(loginPage.rootError).toBeVisible();
    await expect(loginPage.rootError).not.toHaveText("");
  });

  test("login failure with non-existent email shows error message", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login("nobody@example.com", "somepassword123!");
    await expect(page).toHaveURL("/login");
    await expect(loginPage.rootError).toBeVisible();
  });

  test("login failure with empty email shows validation error", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.submitButton.click();
    await expect(page).toHaveURL("/login");
    await expect(loginPage.emailError).toBeVisible();
  });

  test("login failure with empty password shows validation error", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.emailInput.fill(ADMIN_EMAIL);
    await loginPage.submitButton.click();
    await expect(page).toHaveURL("/login");
    await expect(loginPage.passwordError).toBeVisible();
    await expect(loginPage.passwordError).toHaveText("Password is required");
  });

  test("login failure with invalid email format shows validation error", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.emailInput.fill("not-an-email");
    await loginPage.passwordInput.fill(ADMIN_PASSWORD);
    await loginPage.submitButton.click();
    await expect(page).toHaveURL("/login");
    await expect(loginPage.emailError).toBeVisible();
    await expect(loginPage.emailError).toHaveText("Enter a valid email address");
  });

  test("submit button is disabled and shows loading text while signing in", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.emailInput.fill(ADMIN_EMAIL);
    await loginPage.passwordInput.fill(ADMIN_PASSWORD);

    let resolveRoute!: () => void;
    const routeBlocker = new Promise<void>((res) => {
      resolveRoute = res;
    });

    await page.route("**/api/auth/sign-in/email", async (route) => {
      await routeBlocker;
      await route.continue();
    });

    const requestPromise = page.waitForRequest("**/api/auth/sign-in/email");
    const clickPromise = loginPage.submitButton.click();
    await requestPromise;

    await expect(loginPage.submitButton).toBeDisabled();
    await expect(loginPage.submitButton).toHaveText("Signing in…");

    resolveRoute();
    await clickPromise;
    await expect(page).toHaveURL("/");
  });
});

// ---------------------------------------------------------------------------
// UNAUTHENTICATED REDIRECT — no storageState
// ---------------------------------------------------------------------------

test.describe("Unauthenticated access redirects", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("unauthenticated user visiting / is redirected to /login", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/login");
  });

  test("unauthenticated user visiting /user is redirected to /login", async ({
    page,
  }) => {
    await page.goto("/user");
    await expect(page).toHaveURL("/login");
  });
});

// ---------------------------------------------------------------------------
// SESSION PERSISTENCE — uses stored auth state
// ---------------------------------------------------------------------------

test.describe("Session persistence (admin)", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test("authenticated admin can visit / and see the dashboard", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    await expect(page.getByText("Welcome to ResolveMe")).toBeVisible();
  });

  test("session survives a full page reload", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Welcome to ResolveMe")).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL("/");
    await expect(page.getByText("Welcome to ResolveMe")).toBeVisible();
  });

  test("authenticated admin visiting /login is redirected to /", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page).toHaveURL("/");
  });
});

test.describe("Session persistence (agent)", () => {
  test.use({ storageState: AGENT_AUTH_FILE });

  test("authenticated agent can visit / and see the dashboard", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    await expect(page.getByText("Welcome to ResolveMe")).toBeVisible();
  });

  test("session survives a full page reload for agent", async ({ page }) => {
    await page.goto("/");
    await page.reload();
    await expect(page).toHaveURL("/");
    await expect(page.getByText("Welcome to ResolveMe")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// ROLE-BASED ACCESS CONTROL
// ---------------------------------------------------------------------------

test.describe("Role-based access — admin", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test("admin can navigate to /user and see the Users page", async ({
    page,
  }) => {
    await page.goto("/user");
    await expect(page).toHaveURL("/user");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  });

  test("NavBar shows the Users link for admin", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Users" })).toBeVisible();
  });

  test("NavBar displays the admin user's identity", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation");
    await expect(nav).toBeVisible();
    await expect(nav.locator("span.text-sm.text-gray-600")).toBeVisible();
  });
});

test.describe("Role-based access — agent", () => {
  test.use({ storageState: AGENT_AUTH_FILE });

  test("agent visiting /user is redirected to /", async ({ page }) => {
    await page.goto("/user");
    await expect(page).toHaveURL("/");
  });

  test("NavBar does NOT show the Users link for agent", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Users" })).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// LOGOUT
// ---------------------------------------------------------------------------

test.describe("Logout — admin", () => {
  // Fresh login per test — sign-out invalidates the server session, so sharing
  // a stored auth file across logout tests would leave subsequent tests with
  // dead cookies and no NavBar.
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test("clicking Sign out clears the session and redirects to /login", async ({
    page,
  }) => {
    await logout(page);
    await expect(page.getByText("ResolveMe", { exact: true })).toBeVisible();
  });

  test("after logout, visiting / redirects back to /login", async ({
    page,
  }) => {
    await logout(page);
    await page.goto("/");
    await expect(page).toHaveURL("/login");
  });

  test("after logout, visiting /user redirects to /login", async ({
    page,
  }) => {
    await logout(page);
    await page.goto("/user");
    await expect(page).toHaveURL("/login");
  });
});

test.describe("Logout — agent", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
  });

  test("agent clicking Sign out clears the session and redirects to /login", async ({
    page,
  }) => {
    await logout(page);
  });
});
