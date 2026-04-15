import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { renderWithQuery } from '../test/renderWithQuery';
import { UserDialog } from './UserDialog';
import type { User } from '../types/user';

// ---------------------------------------------------------------------------
// MSW server
// ---------------------------------------------------------------------------

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderCreate(onOpenChange = vi.fn()) {
  return {
    onOpenChange,
    ...renderWithQuery(<UserDialog open onOpenChange={onOpenChange} />),
  };
}

const JANE: User = {
  id: 'u1',
  name: 'Jane Smith',
  email: 'jane@example.com',
  role: 'agent',
  createdAt: '2024-01-01T00:00:00.000Z',
};

function renderEdit(user: User = JANE, onOpenChange = vi.fn()) {
  return {
    onOpenChange,
    ...renderWithQuery(<UserDialog open onOpenChange={onOpenChange} user={user} />),
  };
}

// ---------------------------------------------------------------------------
// Create mode
// ---------------------------------------------------------------------------

describe('UserDialog — create mode', () => {
  describe('rendering', () => {
    it('renders the title and all three fields', () => {
      renderCreate();

      expect(screen.getByText('New user')).toBeInTheDocument();
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create user/i })).toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('shows all field errors when submitted empty', async () => {
      const user = userEvent.setup();
      renderCreate();

      await user.click(screen.getByRole('button', { name: /create user/i }));

      await screen.findByText('Name must be at least 3 characters');
      expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });

    it('shows an error when name is too short', async () => {
      const user = userEvent.setup();
      renderCreate();

      await user.type(screen.getByLabelText(/name/i), 'ab');
      await user.click(screen.getByRole('button', { name: /create user/i }));

      await screen.findByText('Name must be at least 3 characters');
    });

    it('shows an error when the email is invalid', async () => {
      const user = userEvent.setup();
      renderCreate();

      await user.type(screen.getByLabelText(/email/i), 'not-an-email');
      await user.click(screen.getByRole('button', { name: /create user/i }));

      await screen.findByText('Enter a valid email');
    });

    it('shows an error when the password is too short', async () => {
      const user = userEvent.setup();
      renderCreate();

      await user.type(screen.getByLabelText(/password/i), 'short1');
      await user.click(screen.getByRole('button', { name: /create user/i }));

      await screen.findByText('Password must be at least 8 characters');
    });
  });

  describe('submission', () => {
    const fillCreate = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.type(screen.getByLabelText(/name/i), 'Jane Smith');
      await user.type(screen.getByLabelText(/email/i), 'jane@example.com');
      await user.type(screen.getByLabelText(/password/i), 'securepassword1');
    };

    it('calls onOpenChange(false) and closes after a successful create', async () => {
      server.use(
        http.post('http://localhost:3001/api/users', () =>
          HttpResponse.json(
            { id: 'u1', name: 'Jane Smith', email: 'jane@example.com', role: 'agent', createdAt: new Date().toISOString() },
            { status: 201 },
          ),
        ),
      );

      const user = userEvent.setup();
      const { onOpenChange } = renderCreate();

      await fillCreate(user);
      await user.click(screen.getByRole('button', { name: /create user/i }));

      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });

    it('shows "Creating…" on the button while the request is in-flight', async () => {
      let resolve!: () => void;
      server.use(
        http.post('http://localhost:3001/api/users', () =>
          new Promise((res) => { resolve = () => res(HttpResponse.json({})); }),
        ),
      );

      const user = userEvent.setup();
      renderCreate();

      await fillCreate(user);
      await user.click(screen.getByRole('button', { name: /create user/i }));

      expect(await screen.findByRole('button', { name: /creating…/i })).toBeDisabled();
      resolve();
    });

    it('shows the email field error on 409 conflict', async () => {
      server.use(
        http.post('http://localhost:3001/api/users', () =>
          HttpResponse.json({ error: 'Conflict' }, { status: 409 }),
        ),
      );

      const user = userEvent.setup();
      renderCreate();

      await fillCreate(user);
      await user.click(screen.getByRole('button', { name: /create user/i }));

      await screen.findByText('A user with that email already exists.');
    });

    it('maps 400 field errors back to the correct inputs', async () => {
      server.use(
        http.post('http://localhost:3001/api/users', () =>
          HttpResponse.json(
            { error: { password: ['String must contain at least 8 character(s)'] } },
            { status: 400 },
          ),
        ),
      );

      const user = userEvent.setup();
      renderCreate();

      await fillCreate(user);
      await user.click(screen.getByRole('button', { name: /create user/i }));

      await screen.findByText('String must contain at least 8 character(s)');
    });

    it('shows a root error message for unexpected server failures', async () => {
      server.use(
        http.post('http://localhost:3001/api/users', () =>
          HttpResponse.json({ error: 'Internal server error' }, { status: 500 }),
        ),
      );

      const user = userEvent.setup();
      renderCreate();

      await fillCreate(user);
      await user.click(screen.getByRole('button', { name: /create user/i }));

      await screen.findByText('Internal server error');
    });
  });
});

// ---------------------------------------------------------------------------
// Edit mode
// ---------------------------------------------------------------------------

describe('UserDialog — edit mode', () => {
  describe('rendering', () => {
    it('shows "Edit user" title and pre-populates name and email', () => {
      renderEdit();

      expect(screen.getByText('Edit user')).toBeInTheDocument();
      expect(screen.getByLabelText(/name/i)).toHaveValue('Jane Smith');
      expect(screen.getByLabelText(/email/i)).toHaveValue('jane@example.com');
      expect(screen.getByLabelText(/password/i)).toHaveValue('');
    });

    it('shows the "leave blank to keep unchanged" password hint', () => {
      renderEdit();

      expect(screen.getByText(/leave blank to keep unchanged/i)).toBeInTheDocument();
    });

    it('shows the "Save changes" submit button', () => {
      renderEdit();

      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('allows submitting with a blank password', async () => {
      server.use(
        http.patch('http://localhost:3001/api/users/u1', () =>
          HttpResponse.json({ ...JANE }),
        ),
      );

      const user = userEvent.setup();
      const { onOpenChange } = renderEdit();

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });

    it('shows a password error when a non-empty password is too short', async () => {
      const user = userEvent.setup();
      renderEdit();

      await user.type(screen.getByPlaceholderText('min. 8 characters'), 'short1');
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await screen.findByText('Password must be at least 8 characters');
    });

    it('shows a name error when name is cleared', async () => {
      const user = userEvent.setup();
      renderEdit();

      await user.clear(screen.getByLabelText(/name/i));
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await screen.findByText('Name must be at least 3 characters');
    });
  });

  describe('submission', () => {
    it('sends PATCH without a password key when password field is blank', async () => {
      let capturedBody: Record<string, unknown> = {};
      server.use(
        http.patch('http://localhost:3001/api/users/u1', async ({ request }) => {
          capturedBody = await request.json() as Record<string, unknown>;
          return HttpResponse.json({ ...JANE });
        }),
      );

      const user = userEvent.setup();
      renderEdit();

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => expect(capturedBody).not.toHaveProperty('password'));
    });

    it('sends PATCH with password when the field is filled', async () => {
      let capturedBody: Record<string, unknown> = {};
      server.use(
        http.patch('http://localhost:3001/api/users/u1', async ({ request }) => {
          capturedBody = await request.json() as Record<string, unknown>;
          return HttpResponse.json({ ...JANE });
        }),
      );

      const user = userEvent.setup();
      const { onOpenChange } = renderEdit();

      // Use fireEvent.change to reliably set the password value on the uncontrolled input
      const passwordInput = screen.getByPlaceholderText('min. 8 characters');
      fireEvent.change(passwordInput, { target: { value: 'newpassword1' } });

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      // Wait for onSuccess (dialog closes) which means the PATCH completed
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
      expect(capturedBody).toHaveProperty('password', 'newpassword1');
    });

    it('calls onOpenChange(false) after a successful edit', async () => {
      server.use(
        http.patch('http://localhost:3001/api/users/u1', () =>
          HttpResponse.json({ ...JANE }),
        ),
      );

      const user = userEvent.setup();
      const { onOpenChange } = renderEdit();

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });

    it('shows "Saving…" on the button while the request is in-flight', async () => {
      let resolve!: () => void;
      server.use(
        http.patch('http://localhost:3001/api/users/u1', () =>
          new Promise((res) => { resolve = () => res(HttpResponse.json({ ...JANE })); }),
        ),
      );

      const user = userEvent.setup();
      renderEdit();

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      expect(await screen.findByRole('button', { name: /saving…/i })).toBeDisabled();
      resolve();
    });

    it('shows the email field error on 409 conflict', async () => {
      server.use(
        http.patch('http://localhost:3001/api/users/u1', () =>
          HttpResponse.json({ error: 'Conflict' }, { status: 409 }),
        ),
      );

      const user = userEvent.setup();
      renderEdit();

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await screen.findByText('A user with that email already exists.');
    });

    it('maps 400 field errors back to the correct inputs', async () => {
      server.use(
        http.patch('http://localhost:3001/api/users/u1', () =>
          HttpResponse.json(
            { error: { name: ['Name must be at least 3 characters'] } },
            { status: 400 },
          ),
        ),
      );

      const user = userEvent.setup();
      renderEdit();

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await screen.findByText('Name must be at least 3 characters');
    });

    it('shows a root error message for unexpected server failures', async () => {
      server.use(
        http.patch('http://localhost:3001/api/users/u1', () =>
          HttpResponse.json({ error: 'Internal server error' }, { status: 500 }),
        ),
      );

      const user = userEvent.setup();
      renderEdit();

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await screen.findByText('Internal server error');
    });
  });
});
