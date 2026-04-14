import globalSetup from "../global-setup";

globalSetup().catch((err) => {
  console.error("[e2e] Setup failed:", err);
  process.exit(1);
});
