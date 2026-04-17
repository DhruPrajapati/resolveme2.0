/**
 * User management e2e tests — happy paths only.
 *
 * Covers:
 *  1. List   — admin navigates to /user and sees the users table
 *  2. Create — "Add user" dialog creates an agent; new row appears in the table
 *  3. Edit   — pencil icon opens dialog; name update is reflected in the table
 *  4. Delete — trash icon + AlertDialog confirm removes the row from the table
 *  5. Guard  — admin row has no delete button (neither self nor other admins)
 *
 * All tests run as admin (only role that can reach /user).
 *
 * Sequencing:  tests 2 → 3 → 4 share the same transient test user
 * (create → edit name → delete), so they must run in order.  Since
 * workers: 1 is set globally this is guaranteed.  `beforeAll` cleans up
 * any leftover record from a prior failed run so the suite is idempotent.
 */

import { test, expect, request } from "@playwright/test";
import path from "path";
import { UsersPage } from "../pages/UsersPage";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "../helpers/auth";

const ADMIN_AUTH_FILE = path.join(__dirname, "../.auth/admin.json");

// ---------------------------------------------------------------------------
// Transient test user — created in test 2, renamed in test 3, deleted in test 4
// ---------------------------------------------------------------------------
const NEW_USER = {
  name: "E2E Test Agent",
  email: "e2e-agent-users@test.com",
  password: "securePass99!",
  updatedName: "E2E Updated Agent",
};

// ---------------------------------------------------------------------------
// Cleanup helper — removes the transient user via the API before tests run
// so the suite is safe to re-run after a previous failure.
// ---------------------------------------------------------------------------
async function cleanupTestUser() {
  const ctx = await request.newContext({ baseURL: "http://localhost:3001" });

  await ctx.post("/api/auth/sign-in/email", {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });

  const usersRes = await ctx.get("/api/users");
  if (usersRes.ok()) {
    const users: Array<{ id: string; email: string }> = await usersRes.json();
    const target = users.find((u) => u.email === NEW_USER.email);
    if (target) {
      await ctx.delete(`/api/users/${target.id}`);
    }
  }

  await ctx.dispose();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("User management (admin)", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test.beforeAll(async () => {
    await cleanupTestUser();
  });

  // -------------------------------------------------------------------------
  // 1. List users
  // -------------------------------------------------------------------------
  test("admin navigates to /user and sees the users table with existing users", async ({
    page,
  }) => {
    const usersPage = new UsersPage(page);
    await usersPage.goto();

    // Table structure
    const table = page.locator("table");
    await expect(table).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "Name" })
    ).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "Email" })
    ).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "Role" })
    ).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "Actions" })
    ).toBeVisible();

    // Seeded admin row is present with the correct role badge
    // Seed script creates the admin with name "Admin" (server/prisma/seed.ts)
    const adminRow = usersPage.rowByName("Admin");
    await expect(adminRow).toBeVisible();
    await expect(adminRow.locator("span", { hasText: "admin" })).toBeVisible();

    // "Add user" button is accessible
    await expect(
      page.getByRole("button", { name: "Add user" })
    ).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 2. Create user
  // -------------------------------------------------------------------------
  test("filling the Add user dialog and submitting adds a new agent row to the table", async ({
    page,
  }) => {
    const usersPage = new UsersPage(page);
    await usersPage.goto();

    // Open the create dialog
    await page.getByRole("button", { name: "Add user" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "New user" })
    ).toBeVisible();

    // Fill the form — create mode uses IDs "name", "email", "password"
    await page.locator("#name").fill(NEW_USER.name);
    await page.locator("#email").fill(NEW_USER.email);
    await page.locator("#password").fill(NEW_USER.password);

    // Submit and assert the API call succeeds
    const responsePromise = page.waitForResponse(
      (r) => r.url().includes("/api/users") && r.request().method() === "POST"
    );
    await dialog.getByRole("button", { name: "Create user" }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);

    // Dialog closes automatically on success
    await expect(dialog).not.toBeVisible();

    // New agent row appears in-place (no page reload)
    const newRow = usersPage.rowByName(NEW_USER.name);
    await expect(newRow).toBeVisible();
    await expect(
      newRow.locator("td", { hasText: NEW_USER.email })
    ).toBeVisible();
    await expect(newRow.locator("span", { hasText: "agent" })).toBeVisible();

    // Agents that are not the logged-in user get a delete button
    await expect(usersPage.deleteButtonFor(NEW_USER.name)).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 3. Edit user
  // -------------------------------------------------------------------------
  test("clicking the pencil icon, updating the name and saving reflects the change in the table", async ({
    page,
  }) => {
    const usersPage = new UsersPage(page);
    await usersPage.goto();

    // The agent row from test 2 must be present
    await expect(usersPage.rowByName(NEW_USER.name)).toBeVisible();

    // Open the edit dialog
    await usersPage.openEditDialog(NEW_USER.name);
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Edit user" })
    ).toBeVisible();

    // The existing name is pre-filled
    // Edit mode uses IDs "edit-name", "edit-email", "edit-password"
    await expect(page.locator("#edit-name")).toHaveValue(NEW_USER.name);

    // Update and save
    const responsePromise = page.waitForResponse(
      (r) => r.url().includes("/api/users/") && r.request().method() === "PATCH"
    );
    await usersPage.submitEditName(NEW_USER.updatedName);
    const response = await responsePromise;
    expect(response.status()).toBe(200);

    // Dialog closes automatically on success
    await expect(dialog).not.toBeVisible();

    // Updated name is visible in the table; old name is gone
    await expect(usersPage.rowByName(NEW_USER.updatedName)).toBeVisible();
    await expect(usersPage.rowByName(NEW_USER.name)).not.toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 4. Delete user
  // -------------------------------------------------------------------------
  test("clicking the trash icon and confirming removes the agent row from the table", async ({
    page,
  }) => {
    const usersPage = new UsersPage(page);
    await usersPage.goto();

    // The agent (with updated name from test 3) must be present
    await expect(usersPage.rowByName(NEW_USER.updatedName)).toBeVisible();

    // Click the trash icon — AlertDialog should appear
    await usersPage.deleteButtonFor(NEW_USER.updatedName).click();
    const alertDialog = page.getByRole("alertdialog");
    await expect(alertDialog).toBeVisible();
    await expect(
      alertDialog.getByRole("heading", {
        name: new RegExp(`Delete ${NEW_USER.updatedName}`, "i"),
      })
    ).toBeVisible();

    // Confirm deletion and assert the API call
    const responsePromise = page.waitForResponse(
      (r) =>
        r.url().includes("/api/users/") && r.request().method() === "DELETE"
    );
    await alertDialog.getByRole("button", { name: "Delete" }).click();
    const response = await responsePromise;
    // Server returns 204 No Content on successful soft-delete
    expect(response.status()).toBe(204);

    // AlertDialog closes
    await expect(alertDialog).not.toBeVisible();

    // The deleted row is no longer in the table
    await expect(usersPage.rowByName(NEW_USER.updatedName)).not.toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 5. Admin row has no delete button
  // -------------------------------------------------------------------------
  test("the admin row does not have a delete button", async ({ page }) => {
    const usersPage = new UsersPage(page);
    await usersPage.goto();

    const adminRow = usersPage.rowByName("Admin");
    await expect(adminRow).toBeVisible();

    // canDelete = false for admin accounts — the trash button is not rendered
    await expect(
      adminRow.getByRole("button", { name: /Delete Admin/i })
    ).not.toBeVisible();
  });
});
