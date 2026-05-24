import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { renderWithQuery } from '../test/renderWithQuery';
import TicketDetailPage from './TicketDetail';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../lib/auth-client', () => ({
  useSession: () => ({
    data: { user: { id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: 'admin' } },
  }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TICKET = {
  id: 47,
  subject: 'OAuth2 redirect URI mismatch',
  fromName: 'Alex Turner',
  fromEmail: 'alex@example.com',
  status: 'open',
  category: 'technical_question',
  body: 'Getting redirect_uri_mismatch when logging in.',
  bodyHtml: null,
  createdAt: '2024-04-21T10:29:24.000Z',
  updatedAt: '2024-04-21T10:29:24.000Z',
  assignedTo: null,
};

const AGENTS = [
  { id: 'admin-1', name: 'Admin' },
  { id: 'agent-1', name: 'John' },
  { id: 'agent-2', name: 'Jane' },
];

// ---------------------------------------------------------------------------
// MSW server
// ---------------------------------------------------------------------------

const server = setupServer(
  http.get('http://localhost:3001/api/tickets/47', () => HttpResponse.json(TICKET)),
  http.get('http://localhost:3001/api/agents', () => HttpResponse.json(AGENTS)),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const renderDetail = (id = '47') =>
  renderWithQuery(
    <MemoryRouter initialEntries={[`/tickets/${id}`]}>
      <Routes>
        <Route path="/tickets/:id" element={<TicketDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TicketDetail page', () => {
  describe('loading state', () => {
    it('renders skeletons while the request is in-flight', () => {
      server.use(
        http.get('http://localhost:3001/api/tickets/47', async () => {
          await new Promise(() => {});
        }),
      );

      renderDetail();

      const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('error state', () => {
    it('shows an error message when the ticket cannot be loaded', async () => {
      server.use(
        http.get('http://localhost:3001/api/tickets/47', () =>
          HttpResponse.json({ error: 'Not found' }, { status: 404 }),
        ),
      );

      renderDetail();

      await screen.findByText('Could not load ticket. Please try again.');
    });
  });

  describe('ticket data', () => {
    it('renders the subject as the card title', async () => {
      renderDetail();
      await screen.findByText('OAuth2 redirect URI mismatch');
    });

    it('renders the sender name and email', async () => {
      renderDetail();
      await screen.findByText('Alex Turner');
      expect(screen.getByText(/<alex@example.com>/)).toBeInTheDocument();
    });

    it('renders the status badge with correct styling', async () => {
      renderDetail();
      const badge = await screen.findByText('open');
      expect(badge.className).toMatch(/bg-blue-100/);
      expect(badge.className).toMatch(/text-blue-700/);
    });

    it('renders the category with underscores replaced by spaces', async () => {
      renderDetail();
      await screen.findByText('technical question');
    });

    it('shows "—" for category when null', async () => {
      server.use(
        http.get('http://localhost:3001/api/tickets/47', () =>
          HttpResponse.json({ ...TICKET, category: null }),
        ),
      );

      renderDetail();

      await screen.findByText('—');
    });

    it('renders the message body', async () => {
      renderDetail();
      await screen.findByText('Getting redirect_uri_mismatch when logging in.');
    });

    it('renders a back link to /tickets', async () => {
      renderDetail();
      await screen.findByText('OAuth2 redirect URI mismatch');

      const backLink = screen.getByRole('link', { name: /back to tickets/i });
      expect(backLink).toHaveAttribute('href', '/tickets');
    });
  });

  describe('assignment', () => {
    it('shows "Unassigned" selected when assignedTo is null', async () => {
      renderDetail();
      const select = await screen.findByRole<HTMLSelectElement>('combobox');
      expect(select.value).toBe('');
    });

    it('pre-selects the current agent when ticket is already assigned', async () => {
      server.use(
        http.get('http://localhost:3001/api/tickets/47', () =>
          HttpResponse.json({ ...TICKET, assignedTo: { id: 'agent-1', name: 'John' } }),
        ),
      );

      renderDetail();

      const select = await screen.findByRole<HTMLSelectElement>('combobox');
      await waitFor(() => expect(select.value).toBe('agent-1'));
    });

    it('lists all users (admins and agents) plus the Unassigned option in the dropdown', async () => {
      renderDetail();
      await screen.findByRole('combobox');

      expect(screen.getByRole('option', { name: 'Unassigned' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Admin' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'John' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Jane' })).toBeInTheDocument();
    });

    it('sends PATCH with the chosen agent id when an agent is selected', async () => {
      const user = userEvent.setup();
      let patchBody: unknown;

      server.use(
        http.patch('http://localhost:3001/api/tickets/47', async ({ request }) => {
          patchBody = await request.json();
          return HttpResponse.json({ ...TICKET, assignedTo: { id: 'agent-1', name: 'John' } });
        }),
      );

      renderDetail();
      const select = await screen.findByRole('combobox');
      await user.selectOptions(select, 'agent-1');

      await waitFor(() => {
        expect(patchBody).toEqual({ assignedToId: 'agent-1' });
      });
    });

    it('sends PATCH with null when Unassigned is selected', async () => {
      const user = userEvent.setup();
      let patchBody: unknown;

      server.use(
        http.get('http://localhost:3001/api/tickets/47', () =>
          HttpResponse.json({ ...TICKET, assignedTo: { id: 'agent-1', name: 'John' } }),
        ),
        http.patch('http://localhost:3001/api/tickets/47', async ({ request }) => {
          patchBody = await request.json();
          return HttpResponse.json({ ...TICKET, assignedTo: null });
        }),
      );

      renderDetail();
      const select = await screen.findByRole<HTMLSelectElement>('combobox');
      await waitFor(() => expect(select.value).toBe('agent-1'));

      await user.selectOptions(select, '');

      await waitFor(() => {
        expect(patchBody).toEqual({ assignedToId: null });
      });
    });

    it('shows "Saving…" while the mutation is in-flight', async () => {
      const user = userEvent.setup();

      server.use(
        http.patch('http://localhost:3001/api/tickets/47', async () => {
          await new Promise(() => {});
        }),
      );

      renderDetail();
      const select = await screen.findByRole('combobox');
      await user.selectOptions(select, 'agent-1');

      await screen.findByText('Saving…');
    });

    it('does not crash when the PATCH fails', async () => {
      const user = userEvent.setup();

      server.use(
        http.patch('http://localhost:3001/api/tickets/47', () =>
          HttpResponse.json({ error: 'Server error' }, { status: 500 }),
        ),
      );

      renderDetail();
      const select = await screen.findByRole('combobox');
      await user.selectOptions(select, 'agent-1');

      // spinner disappears once mutation settles; no crash or thrown error
      await waitFor(() => expect(screen.queryByText('Saving…')).toBeNull());
      expect(select).toBeInTheDocument();
    });

    it('does not crash when PATCH returns 422 for an invalid user', async () => {
      const user = userEvent.setup();

      server.use(
        http.patch('http://localhost:3001/api/tickets/47', () =>
          HttpResponse.json({ error: 'Assigned user not found' }, { status: 422 }),
        ),
      );

      renderDetail();
      const select = await screen.findByRole('combobox');
      await user.selectOptions(select, 'agent-1');

      await waitFor(() => expect(screen.queryByText('Saving…')).toBeNull());
      expect(select).toBeInTheDocument();
    });
  });
});
