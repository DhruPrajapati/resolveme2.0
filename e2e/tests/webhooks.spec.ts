/**
 * Webhook + Ticket API e2e tests
 *
 * Tests the inbound email webhook and the downstream ticket endpoints it feeds.
 * All requests are made directly via Playwright's `request` fixture (no browser).
 *
 * Covers:
 *  1. Webhook security — missing/wrong x-webhook-secret → 401
 *  2. Webhook validation — missing required fields → 400 with field errors
 *  3. Happy path — valid POST creates a ticket, returns { id: <number> }
 *  4. bodyHtml optional — omitting bodyHtml still creates a ticket successfully
 *  5. bodyHtml stored — providing bodyHtml is retrievable via GET /api/tickets/:id
 *  6. Ticket appears in list — GET /api/tickets (authenticated) shows created ticket
 *  7. Status filter — ?status=open includes ticket; ?status=resolved excludes it
 *  8. PATCH ticket — update status + category; response reflects changes
 *  9. Invalid PATCH — unrecognised status value → 400
 */

import { test, expect, request as playwrightRequest } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "../helpers/auth";

// ---------------------------------------------------------------------------
// Constants — read from env so they match whatever .env.test configures
// ---------------------------------------------------------------------------
const SERVER = process.env.API_BASE_URL ?? "http://localhost:3001";
const WEBHOOK_URL = `${SERVER}/api/webhooks/email`;
const TICKETS_URL = `${SERVER}/api/tickets`;
const VALID_SECRET = process.env.WEBHOOK_SECRET ?? "dev-webhook-secret";
const WRONG_SECRET = "not-the-right-secret";

/** Build the base webhook payload. bodyHtml is omitted by default. */
function makePayload(overrides: Record<string, string> = {}) {
  return {
    subject: "E2E Test Ticket",
    body: "This is the plain-text body of the test email.",
    fromName: "E2E Sender",
    fromEmail: "e2e-sender@example.com",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helper: obtain an authenticated API request context for admin.
// We call Better Auth's sign-in endpoint directly; the resulting session
// cookie is carried by the context for all subsequent requests.
// ---------------------------------------------------------------------------
async function adminRequestContext(
  request: import("@playwright/test").APIRequestContext
) {
  const signIn = await request.post(`${SERVER}/api/auth/sign-in/email`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(signIn.ok()).toBe(true);
  return request; // same context now carries the session cookie
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
test.describe("Inbound email webhook", () => {
  // -------------------------------------------------------------------------
  // 1. Missing secret → 401
  // -------------------------------------------------------------------------
  test("returns 401 when x-webhook-secret header is absent", async ({
    request,
  }) => {
    const res = await request.post(WEBHOOK_URL, {
      data: makePayload(),
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  // -------------------------------------------------------------------------
  // 2. Wrong secret → 401
  // -------------------------------------------------------------------------
  test("returns 401 when x-webhook-secret header has the wrong value", async ({
    request,
  }) => {
    const res = await request.post(WEBHOOK_URL, {
      headers: { "x-webhook-secret": WRONG_SECRET },
      data: makePayload(),
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  // -------------------------------------------------------------------------
  // 3. Missing required fields → 400
  // -------------------------------------------------------------------------
  test("returns 400 with field errors when required fields are missing", async ({
    request,
  }) => {
    const res = await request.post(WEBHOOK_URL, {
      headers: { "x-webhook-secret": VALID_SECRET },
      data: {
        // subject, body, fromName all missing
        fromEmail: "sender@example.com",
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    // error is the fieldErrors map from zod flatten()
    expect(body.error).toBeDefined();
    expect(body.error.subject).toBeDefined();
    expect(body.error.body).toBeDefined();
    expect(body.error.fromName).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // 4. Missing required field — invalid email
  // -------------------------------------------------------------------------
  test("returns 400 when fromEmail is not a valid email address", async ({
    request,
  }) => {
    const res = await request.post(WEBHOOK_URL, {
      headers: { "x-webhook-secret": VALID_SECRET },
      data: makePayload({ fromEmail: "not-an-email" }),
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.fromEmail).toBeDefined();
  });
});

test.describe("Webhook happy path and ticket API", () => {
  // Ticket IDs created during this suite — tracked so tests can reference them
  let ticketIdWithoutHtml: number;
  let ticketIdWithHtml: number;

  // -------------------------------------------------------------------------
  // 5. Happy path — without bodyHtml
  // -------------------------------------------------------------------------
  test("valid POST without bodyHtml creates a ticket with bodyHtml null", async ({
    request,
  }) => {
    const res = await request.post(WEBHOOK_URL, {
      headers: { "x-webhook-secret": VALID_SECRET },
      data: makePayload(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.id).toBe("number");
    ticketIdWithoutHtml = body.id;

    // Authenticate then fetch the ticket to verify bodyHtml is null
    await adminRequestContext(request);
    const getRes = await request.get(`${TICKETS_URL}/${ticketIdWithoutHtml}`);
    expect(getRes.status()).toBe(200);
    const ticket = await getRes.json();
    expect(ticket.bodyHtml).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 6. Happy path — with bodyHtml stored and retrievable
  // -------------------------------------------------------------------------
  test("valid POST with bodyHtml stores it; GET /api/tickets/:id returns it", async ({
    request,
  }) => {
    const htmlContent = "<p>This is the <strong>HTML</strong> body.</p>";

    // Create ticket with bodyHtml
    const createRes = await request.post(WEBHOOK_URL, {
      headers: { "x-webhook-secret": VALID_SECRET },
      data: makePayload({ bodyHtml: htmlContent }),
    });
    expect(createRes.status()).toBe(200);
    const createBody = await createRes.json();
    expect(typeof createBody.id).toBe("number");
    ticketIdWithHtml = createBody.id;

    // Authenticate then fetch the ticket
    await adminRequestContext(request);
    const getRes = await request.get(`${TICKETS_URL}/${ticketIdWithHtml}`);
    expect(getRes.status()).toBe(200);
    const ticket = await getRes.json();
    expect(ticket.bodyHtml).toBe(htmlContent);
  });

  // -------------------------------------------------------------------------
  // 7. Ticket appears in list with correct fields
  // -------------------------------------------------------------------------
  test("GET /api/tickets (authenticated) shows created ticket with correct fields", async ({
    request,
  }) => {
    // Ensure we have at least one ticket (relies on test 5 having run)
    // Re-create one here in case tests run in isolation or order shifts
    const createRes = await request.post(WEBHOOK_URL, {
      headers: { "x-webhook-secret": VALID_SECRET },
      data: makePayload({
        subject: "List Check Subject",
        fromName: "List Sender",
        fromEmail: "list-sender@example.com",
      }),
    });
    expect(createRes.status()).toBe(200);
    const { id } = await createRes.json();

    // Authenticate
    await adminRequestContext(request);

    const listRes = await request.get(TICKETS_URL);
    expect(listRes.status()).toBe(200);
    const tickets: Array<{
      id: number;
      subject: string;
      fromName: string;
      fromEmail: string;
      status: string;
      category: string | null;
    }> = await listRes.json();

    const found = tickets.find((t) => t.id === id);
    expect(found).toBeDefined();
    expect(found!.subject).toBe("List Check Subject");
    expect(found!.fromName).toBe("List Sender");
    expect(found!.fromEmail).toBe("list-sender@example.com");
    expect(found!.status).toBe("open");
    expect(found!.category).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 8. Status filter — ?status=open includes; ?status=resolved excludes
  // -------------------------------------------------------------------------
  test("GET /api/tickets?status=open includes ticket; ?status=resolved excludes it", async ({
    request,
  }) => {
    // Create a fresh ticket to target
    const createRes = await request.post(WEBHOOK_URL, {
      headers: { "x-webhook-secret": VALID_SECRET },
      data: makePayload({
        subject: "Filter Test Ticket",
        fromEmail: "filter-test@example.com",
      }),
    });
    expect(createRes.status()).toBe(200);
    const { id } = await createRes.json();

    await adminRequestContext(request);

    // Filter for open
    const openRes = await request.get(`${TICKETS_URL}?status=open`);
    expect(openRes.status()).toBe(200);
    const openTickets: Array<{ id: number }> = await openRes.json();
    expect(openTickets.some((t) => t.id === id)).toBe(true);

    // Filter for resolved — the new ticket has not been patched yet
    const resolvedRes = await request.get(`${TICKETS_URL}?status=resolved`);
    expect(resolvedRes.status()).toBe(200);
    const resolvedTickets: Array<{ id: number }> = await resolvedRes.json();
    expect(resolvedTickets.some((t) => t.id === id)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 9. PATCH ticket — update status and category
  // -------------------------------------------------------------------------
  test("PATCH /api/tickets/:id updates status and category; response reflects changes", async ({
    request,
  }) => {
    // Create a ticket to patch
    const createRes = await request.post(WEBHOOK_URL, {
      headers: { "x-webhook-secret": VALID_SECRET },
      data: makePayload({ subject: "Patch Target Ticket" }),
    });
    expect(createRes.status()).toBe(200);
    const { id } = await createRes.json();

    await adminRequestContext(request);

    const patchRes = await request.patch(`${TICKETS_URL}/${id}`, {
      data: { status: "resolved", category: "technical_question" },
    });
    expect(patchRes.status()).toBe(200);
    const updated = await patchRes.json();
    expect(updated.status).toBe("resolved");
    expect(updated.category).toBe("technical_question");
    expect(updated.id).toBe(id);
  });

  // -------------------------------------------------------------------------
  // 10. Invalid PATCH — unrecognised status value → 400
  // -------------------------------------------------------------------------
  test("PATCH /api/tickets/:id with an invalid status returns 400", async ({
    request,
  }) => {
    // Create a ticket to target
    const createRes = await request.post(WEBHOOK_URL, {
      headers: { "x-webhook-secret": VALID_SECRET },
      data: makePayload({ subject: "Bad Patch Target" }),
    });
    expect(createRes.status()).toBe(200);
    const { id } = await createRes.json();

    await adminRequestContext(request);

    const patchRes = await request.patch(`${TICKETS_URL}/${id}`, {
      data: { status: "not_a_real_status" },
    });
    expect(patchRes.status()).toBe(400);
    const body = await patchRes.json();
    expect(body.error).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // 11. GET /api/tickets/:id — 404 for unknown id
  // -------------------------------------------------------------------------
  test("GET /api/tickets/:id returns 404 for a non-existent ticket", async ({
    request,
  }) => {
    await adminRequestContext(request);

    const res = await request.get(`${TICKETS_URL}/999999999`);
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Ticket not found");
  });

  // -------------------------------------------------------------------------
  // 12. GET /api/tickets — requires authentication
  // -------------------------------------------------------------------------
  test("GET /api/tickets returns 401 when not authenticated", async () => {
    // Fresh context with no session cookie
    const unauthCtx = await playwrightRequest.newContext({ baseURL: SERVER });
    try {
      const res = await unauthCtx.get(TICKETS_URL);
      // requireAuth middleware responds with 401
      expect(res.status()).toBe(401);
    } finally {
      await unauthCtx.dispose();
    }
  });
});
