import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",

  // Single worker — tests share a database, so run sequentially
  workers: 1,
  fullyParallel: false,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  reporter: [["html", { open: "never" }], ["list"]],

  globalSetup: "./global-setup.ts",

  use: {
    baseURL: "http://localhost:5174",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // Run auth setup (login + save storageState) before any test project.
    {
      name: "setup",
      testMatch: "**/auth.setup.ts",
    },
    // Main test project — depends on setup so storage state files exist.
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],

  webServer: [
    {
      // Server: port 3001, test database, no file watching
      command: "bun --env-file .env.test src/index.ts",
      cwd: "../server",
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
    {
      // Client: port 5174, test mode loads client/.env.test (VITE_API_URL)
      command: "bunx vite --port 5174 --mode test",
      cwd: "../client",
      port: 5174,
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
  ],
});
