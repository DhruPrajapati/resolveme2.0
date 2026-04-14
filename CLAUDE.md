# ResolveMe — Project Memory

## What this project is

An AI-powered ticket management system that receives support emails, auto-classifies them, and helps agents respond faster using AI-generated summaries and suggested replies.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS + React Router (Vite) |
| Backend | Node.js + Express + TypeScript (Bun runtime) |
| Database | PostgreSQL + Prisma ORM |
| Auth | Better Auth (email/password, database sessions) |
| AI | Anthropic Claude API |
| Email | SendGrid or Mailgun |
| Deployment | Docker + cloud provider |

## Project Structure

```
resolveme/
├── client/       # React + Vite frontend (port 5173)
├── server/       # Express backend (port 3000)
└── e2e/          # Playwright end-to-end tests
```

## Running the project

```bash
# Server (from server/)
bun --watch src/index.ts

# Client (from client/)
bun run dev
```

## Authentication

Auth is handled by **Better Auth** across both server and client.

### Server (`server/src/lib/auth.ts`)
- Configured with `prismaAdapter` (PostgreSQL)
- Email/password only — **sign-up is disabled** (`disableSignUp: true`); accounts are seeded
- Auth routes mounted at `/api/auth/*` via `toNodeHandler(auth)`
- `trustedOrigins` reads from `CLIENT_URL` env var

### Client (`client/src/lib/auth-client.ts`)
- `createAuthClient` pointed at `import.meta.env.VITE_API_URL ?? "http://localhost:3000"`
- Exports `signIn`, `signOut`, `useSession` for use in components

### Protecting routes (server)
Use the `requireAuth` middleware (`server/src/middleware/requireAuth.ts`). It calls `auth.api.getSession` and attaches `req.session` and `req.user` (typed via `server/src/types/express.d.ts`). Returns `401` if no valid session.

```ts
import { requireAuth } from "./middleware/requireAuth.js";

router.get("/protected", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
```

### Protecting routes (client)
Use `<ProtectedRoute>` (`client/src/components/ProtectedRoute.tsx`) which wraps `useSession` to redirect unauthenticated users to `/login`.

### Protecting admin routes (server)
Use `requireAdmin` middleware (`server/src/middleware/requireAdmin.ts`). Always chain after `requireAuth`. Returns `403` if `req.user.role !== "admin"`.

```ts
import { requireAuth } from "./middleware/requireAuth.js";
import { requireAdmin } from "./middleware/requireAdmin.js";

// Apply at router level so every route in the file is protected
router.use(requireAuth, requireAdmin);
```

**Never rely on `<AdminRoute>` alone** — it only protects the UI. Every admin-only API endpoint must enforce role server-side.

## Key domain rules

- Ticket statuses: `open`, `resolved`, `closed`
- Ticket categories: `general_question`, `technical_question`, `refund_request`
- Roles: `admin` (seeded at deploy) and `agent` (created by admin)
- Admin has full access; agents handle tickets

## E2E Tests

Always use the **`playwright-e2e-writer`** agent to write Playwright tests. Never write e2e tests inline.

Trigger it whenever:
- A new page or feature is implemented
- An existing flow changes (auth, forms, navigation)
- A new role-gated route is added

```
use the playwright-e2e-writer agent to write tests for <feature>
```

The agent knows the test infrastructure (ports, DB, credentials, config location) and will keep its own memory of selectors, page objects, and patterns across conversations.

## Security

- **`helmet()`** applied globally — sets CSP, X-Frame-Options, HSTS, and other security headers
- **CORS** locked to `CLIENT_URL` env var — no fallback, no wildcard
- **Rate limiting** on `/api/auth/*` — 20 req / 15 min, **production only** (`NODE_ENV === "production"`)
- **Startup validation** — server throws at boot if `DATABASE_URL`, `CLIENT_URL`, `BETTER_AUTH_SECRET`, or `BETTER_AUTH_URL` is missing
- **`/api/me`** returns `{ id, name, email, role }` only — never expose session token in responses
- **Password minimum** — 12 characters enforced in seed script and `POST /api/users`

## Documentation

Always use **context7** to fetch up-to-date documentation before working with any library or framework in this project — including React, Express, Vite, Prisma, Tailwind, React Router, and the Anthropic SDK. Do not rely on training data alone for API usage, configuration, or version-specific behaviour.

To use context7:
1. Call `mcp__context7__resolve-library-id` with the library name
2. Call `mcp__context7__query-docs` with the resolved ID and a specific question
