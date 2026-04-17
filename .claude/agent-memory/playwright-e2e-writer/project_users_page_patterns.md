---
name: Users page e2e patterns
description: Selector patterns, form IDs, API responses, and page object design for the /user management feature
type: project
---

## Key facts established when writing users.spec.ts

**Seeded admin name**: The seed script (`server/prisma/seed.ts`) creates the admin with `name: "Admin"` — not "Test Admin" or anything else. Use `rowByName("Admin")` to target that row.

**Form element IDs** (from `UserDialog.tsx`):
- Create mode: `#name`, `#email`, `#password`
- Edit mode: `#edit-name`, `#edit-email`, `#edit-password`
  (controlled by `const prefix = isEdit ? "edit-" : ""`)

**API response statuses** (from `server/src/routes/users.ts`):
- `POST /api/users` → `201`
- `PATCH /api/users/:id` → `200` with updated user JSON
- `DELETE /api/users/:id` → `204` No Content (soft-delete)

**Delete button logic** (`UsersTable.tsx`):
- `canDelete = !isSelf && !isAdmin`
- Admin rows and the logged-in user's own row get a placeholder `<span>` instead of the trash `<Button>`
- The delete button has `aria-label="Delete {user.name}"` — use `getByRole("button", { name: /Delete Name/i })`

**Edit button**: always present for every row — `aria-label="Edit {user.name}"`

**Table row selector**: `rowByName(name)` filters `table tbody tr` by a `td` containing the text. This is robust against column reordering.

**Dialog vs AlertDialog**:
- Create/Edit use shadcn `<Dialog>` → `page.getByRole("dialog")`
- Delete confirmation uses `<AlertDialog>` → `page.getByRole("alertdialog")`

**Submit button text**:
- Create: "Create user" (loading: "Creating…")
- Edit: "Save changes" (loading: "Saving…")

**Test isolation strategy**: `beforeAll` in the describe block calls `cleanupTestUser()`, which signs in via `request.newContext` and soft-deletes the transient test user if it exists. This makes the suite idempotent across repeated runs.

**Why:** the create → edit → delete tests share one transient user and must run in order (workers:1 guarantees this). The `beforeAll` cleanup handles leftover state from prior failures.
