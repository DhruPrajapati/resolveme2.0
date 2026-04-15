---
name: Auth test patterns and selector strategies
description: How auth tests are structured, what selectors work, and key gotchas for the ResolveMe login/session/RBAC flows
type: project
---

Auth tests written to `e2e/tests/auth.spec.ts` with setup in `e2e/tests/auth.setup.ts` and page object at `e2e/pages/LoginPage.ts`.

## Routes and roles
- `/login` — public; `Login.tsx` redirects to `/` via `useEffect` when session exists
- `/` — protected via `<ProtectedRoute>` — redirects to `/login` when unauthenticated
- `/user` — admin-only via `<AdminRoute>` — redirects non-admins to `/` (not `/login`)
  - Unauthenticated users hitting `/user` go to `/login` first (ProtectedRoute fires before AdminRoute)

## Selectors that work
- Email field: `page.getByLabel("Email")` (label `htmlFor="email"`)
- Password field: `page.getByLabel("Password")` (label `htmlFor="password"`)
- Submit button: `page.getByRole("button", { name: /sign in/i })`
- Sign out button: `page.getByRole("button", { name: /sign out/i })`
- Field error (email): `input#email ~ p.text-destructive`
- Field error (password): `input#password ~ p.text-destructive`
- Root/server error: `form p.text-destructive` last match (setError("root", ...))
- Dashboard landmark: `page.getByText("Welcome to ResolveMe")` (h1 in Home.tsx)
- Login card heading: `page.getByRole("heading", { name: "ResolveMe" })`
- Users page heading: `page.getByRole("heading", { name: "Users" })`
- NavBar Users link: `page.getByRole("link", { name: "Users" })` (only visible for admin)
- NavBar identity span: `nav span.text-sm.text-gray-600`

## Validation messages (Zod schema in Login.tsx)
- Empty/invalid email: "Enter a valid email address"
- Empty password: "Password is required"
- Wrong credentials: Better Auth returns a message set via `setError("root", ...)`

## Auth storage state files
- `e2e/.auth/admin.json` — saved by `auth.setup.ts` step 1
- `e2e/.auth/agent.json` — saved by `auth.setup.ts` step 2
- Both files are gitignored via `e2e/.auth/` entry in root `.gitignore`

## Agent provisioning pattern
Auth setup uses `request.newContext({ baseURL, storageState: ADMIN_AUTH_FILE })` to make an authenticated API call to `POST /api/users` to create the test agent. 409 is treated as idempotent.

**Why:** Sign-up is disabled; agents must be created via the admin API. The setup runs sequentially (workers: 1) so admin state is written before the agent step reads it.

## Loading state test pattern
To reliably assert the button's `isSubmitting` state, intercept `**/api/auth/sign-in/email` with `page.route(...)` and block it via a `Promise` that is resolved after assertions pass. This avoids `waitForTimeout`.

**How to apply:** Use the same blocker pattern for any other form that shows a loading state during async submission.
