import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Page Object for the /tickets page.
 *
 * Covers:
 *  - Navigating to the page and verifying the heading
 *  - Table structure (columns, rows)
 *  - Per-row helpers (subject, status badge, category cell)
 *  - Empty state and error state text
 */
export class TicketsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto("/tickets");
    await expect(this.page).toHaveURL("/tickets");
    await expect(
      this.page.getByRole("heading", { name: "Tickets" })
    ).toBeVisible();
  }

  // ---------------------------------------------------------------------------
  // Table structure
  // ---------------------------------------------------------------------------

  get table(): Locator {
    return this.page.locator("table");
  }

  get tableBody(): Locator {
    return this.page.locator("table tbody");
  }

  get rows(): Locator {
    return this.page.locator("table tbody tr");
  }

  // ---------------------------------------------------------------------------
  // State text
  // ---------------------------------------------------------------------------

  get emptyState(): Locator {
    return this.page.getByText("No tickets yet.");
  }

  get errorState(): Locator {
    return this.page.getByText("Could not load tickets. Please try again.");
  }

  // ---------------------------------------------------------------------------
  // Row helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns the <tr> whose Subject cell matches the given text exactly.
   */
  rowBySubject(subject: string): Locator {
    return this.page.locator("table tbody tr").filter({
      has: this.page.locator("td", { hasText: subject }),
    });
  }

  /**
   * The status badge <span> within the row for a given subject.
   * Matches the inline-flex badge rendered by TicketsTable.
   */
  statusBadgeFor(subject: string): Locator {
    return this.rowBySubject(subject).locator(
      "span.inline-flex.rounded-full"
    );
  }

  /**
   * The category cell <td> within the row for a given subject.
   */
  categoryCellFor(subject: string): Locator {
    // Category is the 3rd column (index 2)
    return this.rowBySubject(subject).locator("td").nth(2);
  }
}
