import { type Page, type Locator, expect } from "@playwright/test";

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly emailError: Locator;
  readonly passwordError: Locator;
  readonly rootError: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel("Email");
    this.passwordInput = page.getByLabel("Password");
    // Use type="submit" — the text changes to "Signing in…" while loading,
    // which would break a name-based role selector.
    this.submitButton = page.locator('button[type="submit"]');
    // Validation error messages rendered under each field
    this.emailError = page.locator("input#email ~ p.text-destructive");
    this.passwordError = page.locator("input#password ~ p.text-destructive");
    // Root-level error (wrong credentials etc.)
    this.rootError = page.locator("form p.text-destructive").last();
  }

  async goto() {
    await this.page.goto("/login");
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectOnLoginPage() {
    await expect(this.page).toHaveURL("/login");
    // CardTitle renders as a <div>, not a heading element — match by text instead.
    await expect(
      this.page.getByText("ResolveMe", { exact: true })
    ).toBeVisible();
  }
}
