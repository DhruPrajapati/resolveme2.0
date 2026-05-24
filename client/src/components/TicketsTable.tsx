import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import { ArrowUp, ArrowDown, ArrowUpDown, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import api from "@/lib/api";
import type { Ticket } from "@/types/ticket";
import type { TicketSortBy, TicketSortOrder, TicketStatusType, TicketCategoryType } from "@resolveme/core";

const PAGE_SIZE = 10;

const statusStyles: Record<Ticket["status"], string> = {
  open: "bg-blue-100 text-blue-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-600",
};

const columns: ColumnDef<Ticket>[] = [
  {
    accessorKey: "subject",
    header: "Subject",
    cell: ({ row }) => (
      <Link to={`/tickets/${row.original.id}`} className="link">
        {row.original.subject}
      </Link>
    ),
  },
  {
    accessorKey: "fromName",
    header: "From",
    cell: ({ row }) => (
      <div>
        <span className="font-medium">{row.original.fromName}</span>
        <span className="block text-xs text-muted-foreground">{row.original.fromEmail}</span>
      </div>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ getValue }) => {
      const value = getValue<string | null>();
      return value
        ? value.replace(/_/g, " ")
        : <span className="text-muted-foreground">—</span>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => {
      const status = getValue<Ticket["status"]>();
      return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[status]}`}>
          {status}
        </span>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Received",
    cell: ({ getValue }) => new Date(getValue<string>()).toLocaleDateString(),
  },
];

const statusOptions: { label: string; value: TicketStatusType | "" }[] = [
  { label: "All statuses", value: "" },
  { label: "Open", value: "open" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
];

const categoryOptions: { label: string; value: TicketCategoryType | "" }[] = [
  { label: "All categories", value: "" },
  { label: "General question", value: "general_question" },
  { label: "Technical question", value: "technical_question" },
  { label: "Refund request", value: "refund_request" },
];

export function TicketsTable() {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [statusFilter, setStatusFilter] = useState<TicketStatusType | "">("");
  const [categoryFilter, setCategoryFilter] = useState<TicketCategoryType | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [statusFilter, categoryFilter, search, sorting]);

  const sortBy = (sorting[0]?.id ?? "createdAt") as TicketSortBy;
  const sortOrder: TicketSortOrder = sorting[0]?.desc === false ? "asc" : "desc";

  const { data, isPending: isLoading, isError: loadError } = useQuery({
    queryKey: ["tickets", sortBy, sortOrder, statusFilter, categoryFilter, search, page],
    queryFn: () =>
      api.get<{ data: Ticket[]; total: number; page: number; pageSize: number }>("/api/tickets", {
        params: {
          sortBy,
          sortOrder,
          page,
          pageSize: PAGE_SIZE,
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(categoryFilter ? { category: categoryFilter } : {}),
          ...(search ? { search } : {}),
        },
      }).then((r) => r.data),
  });

  const tickets = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const table = useReactTable({
    data: tickets,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    manualSorting: true,
    enableMultiSort: false,
    getCoreRowModel: getCoreRowModel(),
  });

  if (loadError) {
    return <p className="text-destructive text-sm">Could not load tickets. Please try again.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Search ticket"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring w-64"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TicketStatusType | "")}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as TicketCategoryType | "")}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {categoryOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {(statusFilter || categoryFilter || searchInput) && (
          <button
            onClick={() => { setStatusFilter(""); setCategoryFilter(""); setSearchInput(""); }}
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Clear filters
          </button>
        )}
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b text-left text-muted-foreground">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-6 py-3 font-semibold cursor-pointer select-none hover:text-foreground"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc" && (
                          <ArrowUp className="h-3.5 w-3.5" />
                        )}
                        {header.column.getIsSorted() === "desc" && (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )}
                        {!header.column.getIsSorted() && (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-6 py-3"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-6 py-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-6 py-3"><Skeleton className="h-5 w-24 rounded-full" /></td>
                    <td className="px-6 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                    <td className="px-6 py-3"><Skeleton className="h-4 w-20" /></td>
                  </tr>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-6 text-center text-muted-foreground">
                    No tickets yet.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/40">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-6 py-3 border-t text-sm text-muted-foreground">
            <span>
              {total === 0 ? "No tickets" : `Showing ${from}–${to} of ${total}`}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1}
                className="inline-flex items-center justify-center rounded-md p-1 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="inline-flex items-center justify-center rounded-md p-1 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
