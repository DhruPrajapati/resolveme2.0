import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { renderWithQuery } from '../test/renderWithQuery';
import Tickets from './Tickets';

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

const TICKETS = [
  {
    id: 2,
    subject: 'App crashes on login',
    fromName: 'Bob Smith',
    fromEmail: 'bob@example.com',
    status: 'open',
    category: 'technical_question',
    createdAt: '2024-02-15T10:00:00.000Z',
    assignedTo: null,
  },
  {
    id: 1,
    subject: 'Refund for order #1234',
    fromName: 'Jane Doe',
    fromEmail: 'jane@example.com',
    status: 'resolved',
    category: null,
    createdAt: '2024-02-14T09:00:00.000Z',
    assignedTo: null,
  },
];

const makePage = (tickets: typeof TICKETS, total?: number) => ({
  data: tickets,
  total: total ?? tickets.length,
  page: 1,
  pageSize: 10,
});

// ---------------------------------------------------------------------------
// MSW server
// ---------------------------------------------------------------------------

const server = setupServer(
  http.get('http://localhost:3001/api/tickets', () => HttpResponse.json(makePage(TICKETS))),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const renderTickets = () =>
  renderWithQuery(
    <MemoryRouter>
      <Tickets />
    </MemoryRouter>,
  );

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Tickets page', () => {
  describe('loading state', () => {
    it('renders skeleton rows while the request is in-flight', () => {
      server.use(
        http.get('http://localhost:3001/api/tickets', async () => {
          await new Promise(() => {}); // never resolves
        }),
      );

      renderTickets();

      expect(screen.getByText('Subject')).toBeInTheDocument();
      const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('error state', () => {
    it('shows an error message when the API call fails', async () => {
      server.use(
        http.get('http://localhost:3001/api/tickets', () =>
          HttpResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        ),
      );

      renderTickets();

      await screen.findByText('Could not load tickets. Please try again.');
    });
  });

  describe('empty state', () => {
    it('shows "No tickets yet." when the list is empty', async () => {
      server.use(
        http.get('http://localhost:3001/api/tickets', () =>
          HttpResponse.json(makePage([])),
        ),
      );

      renderTickets();

      await screen.findByText('No tickets yet.');
    });
  });

  describe('ticket list', () => {
    it('renders every ticket row with subject, sender name, email, and date', async () => {
      renderTickets();

      const bob = await screen.findByText('Bob Smith');
      const bobRow = bob.closest('tr')!;
      expect(within(bobRow).getByText('App crashes on login')).toBeInTheDocument();
      expect(within(bobRow).getByText('bob@example.com')).toBeInTheDocument();
      expect(within(bobRow).getByText(/2024/)).toBeInTheDocument();

      const jane = screen.getByText('Jane Doe');
      const janeRow = jane.closest('tr')!;
      expect(within(janeRow).getByText('Refund for order #1234')).toBeInTheDocument();
      expect(within(janeRow).getByText('jane@example.com')).toBeInTheDocument();
    });

    it('shows "—" in the Category column when category is null', async () => {
      renderTickets();

      await screen.findByText('Jane Doe');

      const janeRow = screen.getByText('Jane Doe').closest('tr')!;
      expect(within(janeRow).getByText('—')).toBeInTheDocument();
    });

    it('displays category with underscores replaced by spaces', async () => {
      renderTickets();

      await screen.findByText('Bob Smith');

      const bobRow = screen.getByText('Bob Smith').closest('tr')!;
      expect(within(bobRow).getByText('technical question')).toBeInTheDocument();
    });

    it('renders the "open" status badge with blue styling', async () => {
      renderTickets();

      await screen.findByText('Bob Smith');

      const bobRow = screen.getByText('Bob Smith').closest('tr')!;
      const badge = within(bobRow).getByText('open');
      expect(badge.className).toMatch(/bg-blue-100/);
      expect(badge.className).toMatch(/text-blue-700/);
    });

    it('renders the "resolved" status badge with green styling', async () => {
      renderTickets();

      await screen.findByText('Jane Doe');

      const janeRow = screen.getByText('Jane Doe').closest('tr')!;
      const badge = within(janeRow).getByText('resolved');
      expect(badge.className).toMatch(/bg-green-100/);
      expect(badge.className).toMatch(/text-green-700/);
    });

    it('renders the "closed" status badge with gray styling', async () => {
      server.use(
        http.get('http://localhost:3001/api/tickets', () =>
          HttpResponse.json(makePage([{ ...TICKETS[0], status: 'closed' }])),
        ),
      );

      renderTickets();

      await screen.findByText('App crashes on login');

      const row = screen.getByText('App crashes on login').closest('tr')!;
      const badge = within(row).getByText('closed');
      expect(badge.className).toMatch(/bg-gray-100/);
      expect(badge.className).toMatch(/text-gray-600/);
    });

    it('renders the page heading', async () => {
      renderTickets();
      expect(screen.getByRole('heading', { name: 'Tickets' })).toBeInTheDocument();
    });

    it('renders the subject as a link to /tickets/:id', async () => {
      renderTickets();

      const link = await screen.findByRole('link', { name: 'App crashes on login' });
      expect(link).toHaveAttribute('href', '/tickets/2');
    });
  });

  describe('sorting', () => {
    it('shows a down-arrow on the Received header by default (createdAt desc)', async () => {
      renderTickets();
      await screen.findByText('Bob Smith');

      const receivedTh = screen.getByRole('columnheader', { name: /received/i });
      expect(receivedTh.querySelector('.lucide-arrow-down')).not.toBeNull();
    });

    it('shows neutral sort icons on non-active columns by default', async () => {
      renderTickets();
      await screen.findByText('Bob Smith');

      const subjectTh = screen.getByRole('columnheader', { name: /subject/i });
      expect(subjectTh.querySelector('.lucide-arrow-up-down')).not.toBeNull();
    });

    it('clicking Subject header sends sortBy=subject&sortOrder=asc (first click = asc for string columns)', async () => {
      const user = userEvent.setup();
      let capturedParams: URLSearchParams | null = null;

      server.use(
        http.get('http://localhost:3001/api/tickets', ({ request }) => {
          capturedParams = new URL(request.url).searchParams;
          return HttpResponse.json(makePage(TICKETS));
        }),
      );

      renderTickets();
      await screen.findByText('Bob Smith');

      await user.click(screen.getByRole('columnheader', { name: /subject/i }));

      await waitFor(() => {
        expect(capturedParams?.get('sortBy')).toBe('subject');
        expect(capturedParams?.get('sortOrder')).toBe('asc');
      });

      const subjectTh = screen.getByRole('columnheader', { name: /subject/i });
      expect(subjectTh.querySelector('.lucide-arrow-up')).not.toBeNull();
    });

    it('clicking Subject header twice sends sortOrder=desc and shows down arrow', async () => {
      const user = userEvent.setup();
      let capturedParams: URLSearchParams | null = null;

      server.use(
        http.get('http://localhost:3001/api/tickets', ({ request }) => {
          capturedParams = new URL(request.url).searchParams;
          return HttpResponse.json(makePage(TICKETS));
        }),
      );

      renderTickets();
      await screen.findByText('Bob Smith');

      const subjectTh = screen.getByRole('columnheader', { name: /subject/i });
      await user.click(subjectTh); // first click → asc
      await waitFor(() => expect(capturedParams?.get('sortBy')).toBe('subject'));

      await user.click(subjectTh); // second click → desc

      await waitFor(() => {
        expect(capturedParams?.get('sortBy')).toBe('subject');
        expect(capturedParams?.get('sortOrder')).toBe('desc');
      });

      expect(subjectTh.querySelector('.lucide-arrow-down')).not.toBeNull();
    });
  });
});
