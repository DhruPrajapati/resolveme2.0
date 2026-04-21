/**
 * Tickets list page e2e tests.
 *
 * Covers only what requires a real browser + auth session + DB:
 *  1. Nav link visible — admin and agent see "Tickets" in the NavBar
 *  2. Nav link hidden when logged out — login page has no "Tickets" link
 *  3. Unauthenticated redirect — /tickets redirects to /login
 *  4. Newest first — second ticket from DB appears above the first in the DOM
 *  5. Agent access — agent can navigate to /tickets and see the heading
 *
 * Rendering concerns (empty state, status badges, category formatting, etc.)
 * are covered by the component test at client/src/pages/Tickets.test.tsx.
 *
 * Each test that creates tickets uses a unique fromEmail so rows are
 * unambiguously identifiable even after prior tests have left data in the DB.
 * Tests within this file are guaranteed sequential (workers: 1 globally).
 */

import { test, expect, request as playwrightRequest } from "@playwright/test";
import path from "path";
import { TicketsPage } from "../pages/TicketsPage";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ADMIN_AUTH_FILE = path.join(__dirname, "../.auth/admin.json");
const AGENT_AUTH_FILE = path.join(__dirname, "../.auth/agent.json");

const SERVER = process.env.API_BASE_URL ?? "http://localhost:3001";
const WEBHOOK_URL = `${SERVER}/api/webhooks/email`;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "dev-webhook-secret";

// ---------------------------------------------------------------------------
// Webhook helper — creates a ticket directly via the API (no browser UI)
// ---------------------------------------------------------------------------
async function createTicket(
  overrides: Record<string, string> = {}
): Promise<number> {
  const ctx = await playwrightRequest.newContext({ baseURL: SERVER });
  try {
    const res = await ctx.post(WEBHOOK_URL, {
      headers: { "x-webhook-secret": WEBHOOK_SECRET },
      data: {
        subject: "Test Ticket",
        body: "Plain text body.",
        fromName: "Test Sender",
        fromEmail: "tickets-test@example.com",
        ...overrides,
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    return body.id as number;
  } finally {
    await ctx.dispose();
  }
}

// ---------------------------------------------------------------------------
// 1 + 2: NavBar link visibility
// ---------------------------------------------------------------------------

// Tests that need admin session
test.describe("NavBar — authenticated (admin)", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test("Tickets link is visible in the NavBar for admin", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Tickets" })).toBeVisible();
  });
});

// Tests that need agent session
test.describe("NavBar — authenticated (agent)", () => {
  test.use({ storageState: AGENT_AUTH_FILE });

  test("Tickets link is visible in the NavBar for agent", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Tickets" })).toBeVisible();
  });
});

// Unauthenticated — no stored session
test.describe("NavBar — unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("Tickets link is not visible on the login page", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("link", { name: "Tickets" })
    ).not.toBeVisible();
  });

  test("unauthenticated user visiting /tickets is redirected to /login", async ({
    page,
  }) => {
    await page.goto("/tickets");
    await expect(page).toHaveURL("/login");
  });
});

// ---------------------------------------------------------------------------
// 4: Newest first ordering
// ---------------------------------------------------------------------------

test.describe("Tickets page — newest first ordering", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  const SUBJECT_FIRST = "E2E Order Test — First Ticket";
  const SUBJECT_SECOND = "E2E Order Test — Second Ticket";

  test.beforeAll(async () => {
    await createTicket({
      subject: SUBJECT_FIRST,
      fromEmail: "e2e-order-first@example.com",
      fromName: "Order First",
    });
    // Small delay ensures the second ticket has a later createdAt timestamp
    await new Promise((resolve) => setTimeout(resolve, 50));
    await createTicket({
      subject: SUBJECT_SECOND,
      fromEmail: "e2e-order-second@example.com",
      fromName: "Order Second",
    });
  });

  test("second ticket appears above the first ticket in the list (newest first)", async ({
    page,
  }) => {
    const ticketsPage = new TicketsPage(page);
    await ticketsPage.goto();

    // Both rows must be present
    const firstRow = ticketsPage.rowBySubject(SUBJECT_FIRST);
    const secondRow = ticketsPage.rowBySubject(SUBJECT_SECOND);
    await expect(firstRow).toBeVisible();
    await expect(secondRow).toBeVisible();

    // Use DOM position: second ticket should appear earlier in the <tbody>
    const allRows = ticketsPage.rows;
    const count = await allRows.count();

    let firstIdx = -1;
    let secondIdx = -1;

    for (let i = 0; i < count; i++) {
      const text = await allRows.nth(i).textContent();
      if (text?.includes(SUBJECT_SECOND) && secondIdx === -1) secondIdx = i;
      if (text?.includes(SUBJECT_FIRST) && firstIdx === -1) firstIdx = i;
    }

    expect(secondIdx).toBeGreaterThanOrEqual(0);
    expect(firstIdx).toBeGreaterThanOrEqual(0);
    expect(secondIdx).toBeLessThan(firstIdx);
  });
});

// ---------------------------------------------------------------------------
// 8: Agent can see tickets
// ---------------------------------------------------------------------------

test.describe("Tickets page — agent access", () => {
  test.use({ storageState: AGENT_AUTH_FILE });

  test("agent can navigate to /tickets and see the page heading", async ({
    page,
  }) => {
    const ticketsPage = new TicketsPage(page);
    await ticketsPage.goto();
    await expect(
      page.getByRole("heading", { name: "Tickets" })
    ).toBeVisible();
    // Table is rendered (not an error or redirect)
    await expect(ticketsPage.table).toBeVisible();
  });

  test("Tickets link navigates agent to /tickets", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Tickets" }).click();
    await expect(page).toHaveURL("/tickets");
    await expect(
      page.getByRole("heading", { name: "Tickets" })
    ).toBeVisible();
  });
});
