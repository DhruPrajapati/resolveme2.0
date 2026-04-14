import { execSync } from "child_process";
import path from "path";
import { Client } from "pg";

const serverDir = path.resolve(__dirname, "../server");

const TEST_DB_NAME = "resolveme_test";
const TEST_DB_URL = `postgresql://dhruprajapati@localhost:5432/${TEST_DB_NAME}?schema=public`;

async function ensureTestDatabase() {
  // Connect to the default postgres database to check/create the test DB
  const client = new Client({
    host: "localhost",
    port: 5432,
    user: "dhruprajapati",
    database: "postgres",
  });

  await client.connect();

  const { rowCount } = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [TEST_DB_NAME]
  );

  if (!rowCount) {
    await client.query(`CREATE DATABASE ${TEST_DB_NAME}`);
    console.log(`[e2e] Created database: ${TEST_DB_NAME}`);
  } else {
    console.log(`[e2e] Database already exists: ${TEST_DB_NAME}`);
  }

  await client.end();
}

export default async function globalSetup() {
  await ensureTestDatabase();

  // Run all pending migrations against the test database
  console.log("[e2e] Running migrations...");
  execSync("bunx prisma migrate deploy", {
    cwd: serverDir,
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: "inherit",
  });

  // Seed the test admin user
  console.log("[e2e] Seeding test admin user...");
  execSync("bun prisma/seed.ts", {
    cwd: serverDir,
    env: {
      ...process.env,
      DATABASE_URL: TEST_DB_URL,
      ADMIN_EMAIL: "admin@test.com",
      ADMIN_PASSWORD: "testAdmin1234!",
    },
    stdio: "inherit",
  });

  console.log("[e2e] Test database ready.");
}
