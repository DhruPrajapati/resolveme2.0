import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { renderWithQuery } from '../test/renderWithQuery';
import { TicketsTable } from './TicketsTable';

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
  id: 1,
  subject: 'App crashes on login',
  fromName: 'Bob Smith',
  fromEmail: 'bob@example.com',
  status: 'open',
  category: 'technical_question',
  createdAt: '2024-02-15T10:00:00.000Z',
  assignedTo: null,
};

const makePage = (
  tickets: object[],
  total?: number,
  page = 1,
  pageSize = 10,
) => ({ data: tickets, total: total ?? tickets.length, page, pageSize });

// ---------------------------------------------------------------------------
// MSW server
// ---------------------------------------------------------------------------

const server = setupServer(
  http.get('http://localhost:3001/api/tickets', () =>
    HttpResponse.json(makePage([TICKET])),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const renderTable = () =>
  renderWithQuery(
    <MemoryRouter>
      <TicketsTable />
    </MemoryRouter>,
  );

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TicketsTable — pagination', () => {
  describe('footer counts', () => {
    it('shows "Showing 1–2 of 2" when two tickets are returned', async () => {
      server.use(
        http.get('http://localhost:3001/api/tickets', () =>
          HttpResponse.json(makePage([TICKET, { ...TICKET, id: 2 }], 2)),
        ),
      );

      renderTable();

      await screen.findByText('Showing 1–2 of 2');
    });

    it('shows "No tickets" in the footer when total is 0', async () => {
      server.use(
        http.get('http://localhost:3001/api/tickets', () =>
          HttpResponse.json(makePage([], 0)),
        ),
      );

      renderTable();

      await screen.findByText('No tickets');
    });

    it('shows "Showing 1–10 of 15" on the first page of a multi-page result', async () => {
      server.use(
        http.get('http://localhost:3001/api/tickets', () =>
          HttpResponse.json(makePage([TICKET], 15)),
        ),
      );

      renderTable();

      await screen.findByText('Showing 1–10 of 15');
    });
  });

  describe('page indicator', () => {
    it('shows "1 / 1" when all results fit on one page', async () => {
      renderTable();
      await screen.findByText('Bob Smith');

      expect(screen.getByText('1 / 1')).toBeInTheDocument();
    });

    it('shows "1 / 2" when there are 15 tickets with page size 10', async () => {
      server.use(
        http.get('http://localhost:3001/api/tickets', () =>
          HttpResponse.json(makePage([TICKET], 15)),
        ),
      );

      renderTable();
      await screen.findByText('Bob Smith');

      expect(screen.getByText('1 / 2')).toBeInTheDocument();
    });
  });

  describe('Previous / Next buttons', () => {
    it('disables the Previous button on page 1', async () => {
      renderTable();
      await screen.findByText('Bob Smith');

      expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
    });

    it('disables the Next button when all results fit on one page', async () => {
      renderTable();
      await screen.findByText('Bob Smith');

      expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
    });

    it('enables the Next button when there are more pages', async () => {
      server.use(
        http.get('http://localhost:3001/api/tickets', () =>
          HttpResponse.json(makePage([TICKET], 15)),
        ),
      );

      renderTable();
      await screen.findByText('Bob Smith');

      expect(screen.getByRole('button', { name: /next page/i })).not.toBeDisabled();
    });
  });

  describe('page navigation', () => {
    it('clicking Next sends page=2', async () => {
      const user = userEvent.setup();
      let capturedParams: URLSearchParams | null = null;

      server.use(
        http.get('http://localhost:3001/api/tickets', ({ request }) => {
          capturedParams = new URL(request.url).searchParams;
          return HttpResponse.json(makePage([TICKET], 15));
        }),
      );

      renderTable();
      await screen.findByText('Bob Smith');

      await user.click(screen.getByRole('button', { name: /next page/i }));

      await waitFor(() => {
        expect(capturedParams?.get('page')).toBe('2');
      });
    });

    it('clicking Next then Previous returns to page=1', async () => {
      const user = userEvent.setup();
      let capturedParams: URLSearchParams | null = null;

      server.use(
        http.get('http://localhost:3001/api/tickets', ({ request }) => {
          capturedParams = new URL(request.url).searchParams;
          return HttpResponse.json(makePage([TICKET], 15));
        }),
      );

      renderTable();
      await screen.findByText('Bob Smith');

      await user.click(screen.getByRole('button', { name: /next page/i }));
      await waitFor(() => expect(capturedParams?.get('page')).toBe('2'));

      await user.click(screen.getByRole('button', { name: /previous page/i }));
      await waitFor(() => expect(capturedParams?.get('page')).toBe('1'));
    });

    it('page resets to 1 after navigating away and changing the status filter', async () => {
      const user = userEvent.setup();
      let capturedParams: URLSearchParams | null = null;

      server.use(
        http.get('http://localhost:3001/api/tickets', ({ request }) => {
          capturedParams = new URL(request.url).searchParams;
          return HttpResponse.json(makePage([TICKET], 15));
        }),
      );

      renderTable();
      await screen.findByText('Bob Smith');

      await user.click(screen.getByRole('button', { name: /next page/i }));
      await waitFor(() => expect(capturedParams?.get('page')).toBe('2'));

      await user.selectOptions(screen.getByDisplayValue('All statuses'), 'open');

      await waitFor(() => {
        expect(capturedParams?.get('page')).toBe('1');
        expect(capturedParams?.get('status')).toBe('open');
      });
    });

    it('page resets to 1 after navigating away and changing the category filter', async () => {
      const user = userEvent.setup();
      let capturedParams: URLSearchParams | null = null;

      server.use(
        http.get('http://localhost:3001/api/tickets', ({ request }) => {
          capturedParams = new URL(request.url).searchParams;
          return HttpResponse.json(makePage([TICKET], 15));
        }),
      );

      renderTable();
      await screen.findByText('Bob Smith');

      await user.click(screen.getByRole('button', { name: /next page/i }));
      await waitFor(() => expect(capturedParams?.get('page')).toBe('2'));

      await user.selectOptions(
        screen.getByDisplayValue('All categories'),
        'technical_question',
      );

      await waitFor(() => {
        expect(capturedParams?.get('page')).toBe('1');
        expect(capturedParams?.get('category')).toBe('technical_question');
      });
    });
  });
});

describe('TicketsTable — filters', () => {
  it('selecting a status sends the status param in the request', async () => {
    const user = userEvent.setup();
    let capturedParams: URLSearchParams | null = null;

    server.use(
      http.get('http://localhost:3001/api/tickets', ({ request }) => {
        capturedParams = new URL(request.url).searchParams;
        return HttpResponse.json(makePage([TICKET]));
      }),
    );

    renderTable();
    await screen.findByText('Bob Smith');

    await user.selectOptions(screen.getByDisplayValue('All statuses'), 'open');

    await waitFor(() => {
      expect(capturedParams?.get('status')).toBe('open');
    });
  });

  it('selecting a category sends the category param in the request', async () => {
    const user = userEvent.setup();
    let capturedParams: URLSearchParams | null = null;

    server.use(
      http.get('http://localhost:3001/api/tickets', ({ request }) => {
        capturedParams = new URL(request.url).searchParams;
        return HttpResponse.json(makePage([TICKET]));
      }),
    );

    renderTable();
    await screen.findByText('Bob Smith');

    await user.selectOptions(
      screen.getByDisplayValue('All categories'),
      'technical_question',
    );

    await waitFor(() => {
      expect(capturedParams?.get('category')).toBe('technical_question');
    });
  });

  it('selecting both status and category sends both params', async () => {
    const user = userEvent.setup();
    let capturedParams: URLSearchParams | null = null;

    server.use(
      http.get('http://localhost:3001/api/tickets', ({ request }) => {
        capturedParams = new URL(request.url).searchParams;
        return HttpResponse.json(makePage([TICKET]));
      }),
    );

    renderTable();
    await screen.findByText('Bob Smith');

    await user.selectOptions(screen.getByDisplayValue('All statuses'), 'resolved');
    await user.selectOptions(
      screen.getByDisplayValue('All categories'),
      'refund_request',
    );

    await waitFor(() => {
      expect(capturedParams?.get('status')).toBe('resolved');
      expect(capturedParams?.get('category')).toBe('refund_request');
    });
  });

  it('Clear filters button is hidden when no filter is active', async () => {
    renderTable();
    await screen.findByText('Bob Smith');

    expect(
      screen.queryByRole('button', { name: /clear filters/i }),
    ).not.toBeInTheDocument();
  });

  it('Clear filters button appears when a status filter is active', async () => {
    const user = userEvent.setup();
    renderTable();
    await screen.findByText('Bob Smith');

    await user.selectOptions(screen.getByDisplayValue('All statuses'), 'open');

    expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
  });

  it('clicking Clear filters resets both dropdowns to "All"', async () => {
    const user = userEvent.setup();
    renderTable();
    await screen.findByText('Bob Smith');

    await user.selectOptions(screen.getByDisplayValue('All statuses'), 'resolved');
    await user.selectOptions(
      screen.getByDisplayValue('All categories'),
      'refund_request',
    );

    await user.click(screen.getByRole('button', { name: /clear filters/i }));

    expect(screen.getByDisplayValue('All statuses')).toBeInTheDocument();
    expect(screen.getByDisplayValue('All categories')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /clear filters/i }),
    ).not.toBeInTheDocument();
  });
});

describe('TicketsTable — search', () => {
  it('typing in the search box sends the search param after the debounce', async () => {
    const user = userEvent.setup();
    let capturedParams: URLSearchParams | null = null;

    server.use(
      http.get('http://localhost:3001/api/tickets', ({ request }) => {
        capturedParams = new URL(request.url).searchParams;
        return HttpResponse.json(makePage([TICKET]));
      }),
    );

    renderTable();
    await screen.findByText('Bob Smith');

    await user.type(screen.getByPlaceholderText('Search ticket'), 'bob');

    await waitFor(
      () => expect(capturedParams?.get('search')).toBe('bob'),
      { timeout: 2000 },
    );
  });

  it('Clear filters button appears when search is active', async () => {
    const user = userEvent.setup();
    renderTable();
    await screen.findByText('Bob Smith');

    await user.type(screen.getByPlaceholderText('Search ticket'), 'bob');

    await waitFor(
      () =>
        expect(
          screen.getByRole('button', { name: /clear filters/i }),
        ).toBeInTheDocument(),
      { timeout: 2000 },
    );
  });

  it('clicking Clear filters clears the search input', async () => {
    const user = userEvent.setup();
    renderTable();
    await screen.findByText('Bob Smith');

    await user.type(screen.getByPlaceholderText('Search ticket'), 'bob');

    await waitFor(
      () =>
        expect(
          screen.getByRole('button', { name: /clear filters/i }),
        ).toBeInTheDocument(),
      { timeout: 2000 },
    );

    await user.click(screen.getByRole('button', { name: /clear filters/i }));

    expect(screen.getByPlaceholderText('Search ticket')).toHaveValue('');
  });

  it('omits the search param when the search box is empty', async () => {
    let capturedParams: URLSearchParams | null = null;

    server.use(
      http.get('http://localhost:3001/api/tickets', ({ request }) => {
        capturedParams = new URL(request.url).searchParams;
        return HttpResponse.json(makePage([TICKET]));
      }),
    );

    renderTable();
    await screen.findByText('Bob Smith');

    expect(capturedParams?.has('search')).toBe(false);
  });
});
