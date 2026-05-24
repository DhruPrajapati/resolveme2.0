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

// helpers
const statusSelect = () => screen.getByRole<HTMLSelectElement>('combobox', { name: 'Status' });
const categorySelect = () => screen.getByRole<HTMLSelectElement>('combobox', { name: 'Category' });
const assignSelect = () => screen.getByRole<HTMLSelectElement>('combobox', { name: 'Assigned to' });

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

  describe('status', () => {
    it('pre-selects the current status', async () => {
      renderDetail();
      await screen.findByRole('combobox', { name: 'Status' });
      expect(statusSelect().value).toBe('open');
    });

    it('sends PATCH with the new status when changed', async () => {
      const user = userEvent.setup();
      let patchBody: unknown;

      server.use(
        http.patch('http://localhost:3001/api/tickets/47', async ({ request }) => {
          patchBody = await request.json();
          return HttpResponse.json({ ...TICKET, status: 'resolved' });
        }),
      );

      renderDetail();
      await screen.findByRole('combobox', { name: 'Status' });
      await user.selectOptions(statusSelect(), 'resolved');

      await waitFor(() => expect(patchBody).toEqual({ status: 'resolved' }));
    });

  });

  describe('category', () => {
    it('pre-selects the current category', async () => {
      renderDetail();
      await screen.findByRole('combobox', { name: 'Category' });
      expect(categorySelect().value).toBe('technical_question');
    });

    it('shows empty value when category is null', async () => {
      server.use(
        http.get('http://localhost:3001/api/tickets/47', () =>
          HttpResponse.json({ ...TICKET, category: null }),
        ),
      );

      renderDetail();
      await screen.findByRole('combobox', { name: 'Category' });
      expect(categorySelect().value).toBe('');
    });

    it('sends PATCH with the new category when changed', async () => {
      const user = userEvent.setup();
      let patchBody: unknown;

      server.use(
        http.patch('http://localhost:3001/api/tickets/47', async ({ request }) => {
          patchBody = await request.json();
          return HttpResponse.json({ ...TICKET, category: 'refund_request' });
        }),
      );

      renderDetail();
      await screen.findByRole('combobox', { name: 'Category' });
      await user.selectOptions(categorySelect(), 'refund_request');

      await waitFor(() => expect(patchBody).toEqual({ category: 'refund_request' }));
    });

    it('sends PATCH with undefined when Uncategorised is selected', async () => {
      const user = userEvent.setup();
      let patchBody: unknown;

      server.use(
        http.patch('http://localhost:3001/api/tickets/47', async ({ request }) => {
          patchBody = await request.json();
          return HttpResponse.json({ ...TICKET, category: null });
        }),
      );

      renderDetail();
      await screen.findByRole('combobox', { name: 'Category' });
      await user.selectOptions(categorySelect(), '');

      await waitFor(() => expect(patchBody).toEqual({}));
    });

  });

  describe('assignment', () => {
    it('shows "Unassigned" selected when assignedTo is null', async () => {
      renderDetail();
      await screen.findByRole('combobox', { name: 'Assigned to' });
      expect(assignSelect().value).toBe('');
    });

    it('pre-selects the current agent when ticket is already assigned', async () => {
      server.use(
        http.get('http://localhost:3001/api/tickets/47', () =>
          HttpResponse.json({ ...TICKET, assignedTo: { id: 'agent-1', name: 'John' } }),
        ),
      );

      renderDetail();
      await screen.findByRole('combobox', { name: 'Assigned to' });
      await waitFor(() => expect(assignSelect().value).toBe('agent-1'));
    });

    it('lists all users (admins and agents) plus Unassigned in the dropdown', async () => {
      renderDetail();
      await screen.findByRole('combobox', { name: 'Assigned to' });

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
      await screen.findByRole('combobox', { name: 'Assigned to' });
      await user.selectOptions(assignSelect(), 'agent-1');

      await waitFor(() => expect(patchBody).toEqual({ assignedToId: 'agent-1' }));
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
      await screen.findByRole('combobox', { name: 'Assigned to' });
      await waitFor(() => expect(assignSelect().value).toBe('agent-1'));
      await user.selectOptions(assignSelect(), '');

      await waitFor(() => expect(patchBody).toEqual({ assignedToId: null }));
    });

    it('does not crash when the PATCH fails', async () => {
      const user = userEvent.setup();

      server.use(
        http.patch('http://localhost:3001/api/tickets/47', () =>
          HttpResponse.json({ error: 'Server error' }, { status: 500 }),
        ),
      );

      renderDetail();
      await screen.findByRole('combobox', { name: 'Assigned to' });
      await user.selectOptions(assignSelect(), 'agent-1');

      await waitFor(() => expect(screen.queryByText('Saving…')).toBeNull());
      expect(assignSelect()).toBeInTheDocument();
    });

    it('does not crash when PATCH returns 422 for an invalid user', async () => {
      const user = userEvent.setup();

      server.use(
        http.patch('http://localhost:3001/api/tickets/47', () =>
          HttpResponse.json({ error: 'Assigned user not found' }, { status: 422 }),
        ),
      );

      renderDetail();
      await screen.findByRole('combobox', { name: 'Assigned to' });
      await user.selectOptions(assignSelect(), 'agent-1');

      await waitFor(() => expect(screen.queryByText('Saving…')).toBeNull());
      expect(assignSelect()).toBeInTheDocument();
    });
  });
});
