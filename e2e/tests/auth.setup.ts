/**
 * Auth setup: logs in as each role and saves storage state to e2e/.auth/.
 * These files are consumed by auth.spec.ts via test.use({ storageState }).
 *
 * Runs as a Playwright "setup" project — see playwright.config.ts.
 * Tests in this file are intentionally sequential (workers: 1 is set globally).
 */
import { test as setup, expect, request } from "@playwright/test";
import path from "path";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  AGENT_EMAIL,
  AGENT_PASSWORD,
} from "../helpers/auth";

export const ADMIN_AUTH_FILE = path.join(__dirname, "../.auth/admin.json");
export const AGENT_AUTH_FILE = path.join(__dirname, "../.auth/agent.json");

// ---------------------------------------------------------------------------
// Step 1: Authenticate as admin and save storage state.
// ---------------------------------------------------------------------------
setup("create admin storage state", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("/");
  await expect(page.getByText("Welcome to ResolveMe")).toBeVisible();
  await page.context().storageState({ path: ADMIN_AUTH_FILE });
});

// ---------------------------------------------------------------------------
// Step 2: Use the saved admin session to provision the agent account, then
// log in as the agent and save that storage state.
//
// We create a separate APIRequestContext loaded with the admin cookies so we
// can call POST /api/users without going through the browser.
// ---------------------------------------------------------------------------
setup("provision agent user and create agent storage state", async ({
  page,
}) => {
  // Build a request context that carries the admin session cookies.
  const adminContext = await request.newContext({
    baseURL: "http://localhost:3001",
    storageState: ADMIN_AUTH_FILE,
  });

  // Create the agent user — 201 (created) or 409 (already exists) are both fine.
  const res = await adminContext.post("/api/users", {
    data: {
      name: "Test Agent",
      email: AGENT_EMAIL,
      password: AGENT_PASSWORD,
      role: "agent",
    },
  });

  await adminContext.dispose();

  if (res.status() !== 201 && res.status() !== 409) {
    throw new Error(
      `Failed to provision agent user: HTTP ${res.status()} — ${await res.text()}`
    );
  }

  // Log in as the agent and persist the session.
  await page.goto("/login");
  await page.getByLabel("Email").fill(AGENT_EMAIL);
  await page.getByLabel("Password").fill(AGENT_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("/");
  await expect(page.getByText("Welcome to ResolveMe")).toBeVisible();
  await page.context().storageState({ path: AGENT_AUTH_FILE });
});
