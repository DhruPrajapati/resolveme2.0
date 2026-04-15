import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { renderWithQuery } from '../test/renderWithQuery';
import Users from './Users';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock better-auth's useSession so we control the current user identity.
// The component calls: const { data: session } = useSession()
// so useSession() must return { data: { user: { ... } } }.
vi.mock('../lib/auth-client', () => ({
  useSession: () => ({
    data: { user: { id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: 'admin' } },
  }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USERS = [
  { id: 'admin-1', name: 'Admin User', email: 'admin@example.com', role: 'admin', createdAt: '2024-01-01T00:00:00.000Z' },
  { id: 'agent-1', name: 'Jane Smith', email: 'jane@example.com', role: 'agent', createdAt: '2024-02-15T00:00:00.000Z' },
];

// ---------------------------------------------------------------------------
// MSW server
// ---------------------------------------------------------------------------

const server = setupServer(
  http.get('http://localhost:3001/api/users', () => HttpResponse.json(USERS)),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const renderUsers = () => renderWithQuery(<Users />);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Users page', () => {
  describe('loading state', () => {
    it('renders skeleton rows while the request is in-flight', () => {
      // Delay the response so the component stays in loading state.
      server.use(
        http.get('http://localhost:3001/api/users', async () => {
          await new Promise(() => {}); // never resolves during this test
        }),
      );

      renderUsers();

      // The table header should be visible immediately.
      expect(screen.getByText('Name')).toBeInTheDocument();

      // Skeletons render inside <td> elements — there should be 4 rows × 3
      // skeleton cells each (name, email, role, date).
      const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('error state', () => {
    it('shows an error message when the API call fails', async () => {
      server.use(
        http.get('http://localhost:3001/api/users', () =>
          HttpResponse.json({ error: 'Forbidden' }, { status: 403 }),
        ),
      );

      renderUsers();

      await screen.findByText('Could not load users. Please try again.');
    });
  });

  describe('empty state', () => {
    it('shows "No users found" when the list is empty', async () => {
      server.use(
        http.get('http://localhost:3001/api/users', () => HttpResponse.json([])),
      );

      renderUsers();

      await screen.findByText('No users found.');
    });
  });

  describe('user list', () => {
    it('renders every user row with name, email, role badge, and formatted date', async () => {
      renderUsers();

      // Jane Smith row
      const jane = await screen.findByText('Jane Smith');
      const row = jane.closest('tr')!;
      expect(within(row).getByText('jane@example.com')).toBeInTheDocument();
      expect(within(row).getByText('agent')).toBeInTheDocument();
      // Date formatted from 2024-02-15 — exact string depends on locale but must be present
      expect(within(row).getByText(/2024/)).toBeInTheDocument();

      // Admin User row
      const admin = screen.getByText('Admin User');
      const adminRow = admin.closest('tr')!;
      expect(within(adminRow).getByText('admin@example.com')).toBeInTheDocument();
      expect(within(adminRow).getByText('admin')).toBeInTheDocument();
    });

    it('hides the Delete button for the currently logged-in user', async () => {
      renderUsers();

      // Wait for data to load
      await screen.findByText('Admin User');

      // The admin row (id === session user id) must NOT have a Delete button
      const adminRow = screen.getByText('Admin User').closest('tr')!;
      expect(within(adminRow).queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();

      // Other rows should have a Delete button
      const agentRow = screen.getByText('Jane Smith').closest('tr')!;
      expect(within(agentRow).getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });
  });

  describe('Add user form', () => {
    it('toggles the form when "Add user" / "Cancel" is clicked', async () => {
      const user = userEvent.setup();
      renderUsers();

      // Form is hidden initially
      expect(screen.queryByText('New user')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /add user/i }));
      expect(screen.getByText('New user')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /cancel/i }));
      expect(screen.queryByText('New user')).not.toBeInTheDocument();
    });

    it('shows validation errors when the form is submitted empty', async () => {
      const user = userEvent.setup();
      renderUsers();

      await user.click(screen.getByRole('button', { name: /add user/i }));
      await user.click(screen.getByRole('button', { name: /create user/i }));

      await screen.findByText('Name is required');
      expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
      expect(screen.getByText('Password must be at least 12 characters')).toBeInTheDocument();
    });

    it('creates a user and closes the form on success', async () => {
      const newUser = {
        id: 'agent-2',
        name: 'New Agent',
        email: 'new@example.com',
        role: 'agent',
        createdAt: '2024-03-01T00:00:00.000Z',
      };

      server.use(
        http.post('http://localhost:3001/api/users', () => HttpResponse.json(newUser, { status: 201 })),
      );

      const user = userEvent.setup();
      renderUsers();

      await user.click(screen.getByRole('button', { name: /add user/i }));

      await user.type(screen.getByLabelText(/name/i), 'New Agent');
      await user.type(screen.getByLabelText(/email/i), 'new@example.com');
      await user.type(screen.getByLabelText(/password/i), 'securepassword123');

      await user.click(screen.getByRole('button', { name: /create user/i }));

      // Form closes after success
      await waitFor(() =>
        expect(screen.queryByText('New user')).not.toBeInTheDocument(),
      );

      // New user appears in the table
      expect(await screen.findByText('New Agent')).toBeInTheDocument();
    });

    it('shows a conflict error when the email is already taken', async () => {
      server.use(
        http.post('http://localhost:3001/api/users', () =>
          HttpResponse.json({ error: 'Email already exists' }, { status: 409 }),
        ),
      );

      const user = userEvent.setup();
      renderUsers();

      await user.click(screen.getByRole('button', { name: /add user/i }));
      await user.type(screen.getByLabelText(/name/i), 'Duplicate');
      await user.type(screen.getByLabelText(/email/i), 'jane@example.com');
      await user.type(screen.getByLabelText(/password/i), 'securepassword123');

      await user.click(screen.getByRole('button', { name: /create user/i }));

      await screen.findByText('A user with that email already exists.');
    });

    it('shows a generic root error for non-409 API failures', async () => {
      server.use(
        http.post('http://localhost:3001/api/users', () =>
          HttpResponse.json({ error: 'Internal server error' }, { status: 500 }),
        ),
      );

      const user = userEvent.setup();
      renderUsers();

      await user.click(screen.getByRole('button', { name: /add user/i }));
      await user.type(screen.getByLabelText(/name/i), 'Test');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'securepassword123');

      await user.click(screen.getByRole('button', { name: /create user/i }));

      await screen.findByText('Internal server error');
    });
  });

  describe('Delete user', () => {
    it('removes the user row from the table after a successful delete', async () => {
      server.use(
        http.delete('http://localhost:3001/api/users/:id', () =>
          new HttpResponse(null, { status: 204 }),
        ),
      );

      const user = userEvent.setup();
      renderUsers();

      // Wait for Jane's row to appear
      await screen.findByText('Jane Smith');

      await user.click(
        within(screen.getByText('Jane Smith').closest('tr')!).getByRole('button', { name: /delete/i }),
      );

      await waitFor(() =>
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument(),
      );
    });

    it('shows a delete error message when the API returns an error', async () => {
      server.use(
        http.delete('http://localhost:3001/api/users/:id', () =>
          HttpResponse.json({ error: 'Cannot delete the last admin.' }, { status: 400 }),
        ),
      );

      const user = userEvent.setup();
      renderUsers();

      await screen.findByText('Jane Smith');

      await user.click(
        within(screen.getByText('Jane Smith').closest('tr')!).getByRole('button', { name: /delete/i }),
      );

      await screen.findByText('Cannot delete the last admin.');
    });
  });
});
