import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Page Object for the /user page (admin-only user management).
 *
 * Covers:
 *  - The users table (rows, columns, action buttons)
 *  - The edit dialog (opened via pencil icon)
 *  - The delete AlertDialog (opened via trash icon)
 *
 * The create dialog is intentionally left as inline interactions in the test
 * because the form IDs ("name", "email", "password") are straightforward
 * and the full flow is described in users.spec.ts.
 */
export class UsersPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto("/user");
    await expect(this.page).toHaveURL("/user");
    await expect(
      this.page.getByRole("heading", { name: "Users" })
    ).toBeVisible();
  }

  // ---------------------------------------------------------------------------
  // Table helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns the <tr> row whose Name cell contains the given text.
   * Uses a cell-level text match so it is resilient to column reordering.
   */
  rowByName(name: string): Locator {
    return this.page.locator("table tbody tr").filter({
      has: this.page.locator("td", { hasText: name }),
    });
  }

  /** Pencil (edit) button within a specific row — matched by aria-label. */
  editButtonFor(name: string): Locator {
    return this.rowByName(name).getByRole("button", {
      name: new RegExp(`Edit ${name}`, "i"),
    });
  }

  /** Trash (delete) button within a specific row — matched by aria-label. */
  deleteButtonFor(name: string): Locator {
    return this.rowByName(name).getByRole("button", {
      name: new RegExp(`Delete ${name}`, "i"),
    });
  }

  // ---------------------------------------------------------------------------
  // Edit dialog helpers
  // ---------------------------------------------------------------------------

  /**
   * Click the pencil icon for the named user and wait for the dialog to open.
   */
  async openEditDialog(name: string): Promise<void> {
    await this.editButtonFor(name).click();
    await expect(this.page.getByRole("dialog")).toBeVisible();
  }

  /**
   * With the edit dialog already open, clear the Name field and type a new
   * value, then save. Waits for the PATCH /api/users/:id response.
   *
   * The edit dialog renders IDs as "edit-name", "edit-email", "edit-password"
   * (see UserDialog.tsx: `const prefix = isEdit ? "edit-" : ""`).
   */
  async submitEditName(newName: string): Promise<void> {
    const dialog = this.page.getByRole("dialog");
    const nameInput = this.page.locator("#edit-name");
    await nameInput.clear();
    await nameInput.fill(newName);

    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes("/api/users/") && r.request().method() === "PATCH"
    );
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await responsePromise;
  }

  // ---------------------------------------------------------------------------
  // Delete AlertDialog helpers
  // ---------------------------------------------------------------------------

  /**
   * Click the trash icon, confirm in the AlertDialog, and wait for the
   * DELETE /api/users/:id response.
   */
  async confirmDelete(name: string): Promise<void> {
    await this.deleteButtonFor(name).click();

    const alertDialog = this.page.getByRole("alertdialog");
    await expect(alertDialog).toBeVisible();

    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes("/api/users/") && r.request().method() === "DELETE"
    );
    await alertDialog.getByRole("button", { name: "Delete" }).click();
    await responsePromise;
  }
}
