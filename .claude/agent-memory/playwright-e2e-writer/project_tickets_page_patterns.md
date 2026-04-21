---
name: Tickets page e2e patterns
description: Selectors, helpers, and test patterns for /tickets — TicketsTable component, status badges, empty/error states, webhook setup
type: project
---

## Route and heading
- Route: `/tickets` — accessible to both `admin` and `agent`; unauthenticated users redirect to `/login`
- Page heading: `<h1>Tickets</h1>` — `getByRole("heading", { name: "Tickets" })`

## NavBar Tickets link
- Rendered for ALL authenticated users (admin and agent); NavBar only gates the "Users" link by role
- Selector: `page.getByRole("link", { name: "Tickets" })`
- Not rendered on `/login` page (NavBar is not mounted there)

## TicketsTable selectors
- Table: `page.locator("table")`
- Rows: `page.locator("table tbody tr")`
- Row by subject: filter tbody tr with `locator("td", { hasText: subject })`
- Status badge: `row.locator("span.inline-flex.rounded-full")` — badge is `span` with Tailwind classes `inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium`
- Status badge colors: open = `bg-blue-100 text-blue-700`, resolved = `bg-green-100 text-green-700`, closed = `bg-gray-100 text-gray-600`
- Category cell: `row.locator("td").nth(2)` — null category renders `—` (em dash `\u2014`), non-null replaces `_` with spaces
- From cell: `row.locator("td").nth(1)` — contains `fromName` and `fromEmail` as block spans
- Subject cell: `row.locator("td").nth(0)`

## State messages
- Empty state: `page.getByText("No tickets yet.")` — appears when API returns `[]`
- Error state: `page.getByText("Could not load tickets. Please try again.")` — `p.text-destructive`
- Loading state: 4 skeleton rows (no text — not typically asserted in e2e)

## Empty state test strategy
Use `page.route("**/api/tickets", route => route.fulfill({ status: 200, body: "[]" }))` to force empty state regardless of what tickets exist in the test DB. This is the only safe pattern given tests share a database.

## Creating tickets in tests
Use `POST /api/webhooks/email` with header `x-webhook-secret: dev-webhook-secret` (from `process.env.WEBHOOK_SECRET`). No auth needed. Returns `{ id: number }`. Use `playwrightRequest.newContext` (a fresh context, not the browser session).

## Patching tickets in tests
`PATCH /api/tickets/:id` requires auth. In helpers, create a fresh `playwrightRequest.newContext`, sign in via `POST /api/auth/sign-in/email`, then patch. The session cookie is carried automatically within the same context.

## Ordering assertion
To assert newest-first, iterate `allRows` collecting row indices for two known subjects, then `expect(newerIdx).toBeLessThan(olderIdx)`. Insert a `setTimeout(resolve, 50)` between two consecutive `createTicket` calls to guarantee distinct `createdAt` timestamps.

## POM location
`e2e/pages/TicketsPage.ts` — exposes `goto()`, `rowBySubject()`, `statusBadgeFor()`, `categoryCellFor()`, `rows`, `table`, `emptyState`, `errorState`.

## Test file location
`e2e/tests/tickets.spec.ts`
