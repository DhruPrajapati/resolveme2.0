import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { renderWithQuery } from '../test/renderWithQuery';
import { CreateUserDialog } from './CreateUserDialog';

// ---------------------------------------------------------------------------
// MSW server
// ---------------------------------------------------------------------------

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderDialog(onOpenChange = vi.fn()) {
  return {
    onOpenChange,
    ...renderWithQuery(<CreateUserDialog open onOpenChange={onOpenChange} />),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CreateUserDialog', () => {
  describe('rendering', () => {
    it('renders the title and all three fields', () => {
      renderDialog();

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
      renderDialog();

      await user.click(screen.getByRole('button', { name: /create user/i }));

      await screen.findByText('Name must be at least 3 characters');
      expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });

    it('shows an error when name is too short', async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.type(screen.getByLabelText(/name/i), 'ab');
      await user.click(screen.getByRole('button', { name: /create user/i }));

      await screen.findByText('Name must be at least 3 characters');
    });

    it('shows an error when the email is invalid', async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.type(screen.getByLabelText(/email/i), 'not-an-email');
      await user.click(screen.getByRole('button', { name: /create user/i }));

      await screen.findByText('Enter a valid email');
    });

    it('shows an error when the password is too short', async () => {
      const user = userEvent.setup();
      renderDialog();

      await user.type(screen.getByLabelText(/password/i), 'short1');
      await user.click(screen.getByRole('button', { name: /create user/i }));

      await screen.findByText('Password must be at least 8 characters');
    });
  });

  describe('submission', () => {
    const validFields = async (user: ReturnType<typeof userEvent.setup>) => {
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
      const { onOpenChange } = renderDialog();

      await validFields(user);
      await user.click(screen.getByRole('button', { name: /create user/i }));

      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });

    it('shows "Creating…" on the button while the request is in-flight', async () => {
      let resolve: () => void;
      server.use(
        http.post('http://localhost:3001/api/users', () =>
          new Promise((res) => { resolve = () => res(HttpResponse.json({})); }),
        ),
      );

      const user = userEvent.setup();
      renderDialog();

      await validFields(user);
      await user.click(screen.getByRole('button', { name: /create user/i }));

      expect(await screen.findByRole('button', { name: /creating…/i })).toBeDisabled();
      resolve!();
    });

    it('shows the email field error on 409 conflict', async () => {
      server.use(
        http.post('http://localhost:3001/api/users', () =>
          HttpResponse.json({ error: 'Conflict' }, { status: 409 }),
        ),
      );

      const user = userEvent.setup();
      renderDialog();

      await validFields(user);
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
      renderDialog();

      await validFields(user);
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
      renderDialog();

      await validFields(user);
      await user.click(screen.getByRole('button', { name: /create user/i }));

      await screen.findByText('Internal server error');
    });
  });
});
