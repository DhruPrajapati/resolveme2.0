import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import api from "@/lib/api";
import type { Ticket } from "@/types/ticket";
import type { TicketSortBy, TicketSortOrder } from "@resolveme/core";

const statusStyles: Record<Ticket["status"], string> = {
  open: "bg-blue-100 text-blue-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-600",
};

const columns: ColumnDef<Ticket>[] = [
  {
    accessorKey: "subject",
    header: "Subject",
    cell: ({ getValue }) => (
      <span className="font-semibold">{getValue<string>()}</span>
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

export function TicketsTable() {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);

  const sortBy = (sorting[0]?.id ?? "createdAt") as TicketSortBy;
  const sortOrder: TicketSortOrder = sorting[0]?.desc === false ? "asc" : "desc";

  const { data: tickets = [], isPending: isLoading, isError: loadError } = useQuery({
    queryKey: ["tickets", sortBy, sortOrder],
    queryFn: () =>
      api.get<Ticket[]>("/api/tickets", { params: { sortBy, sortOrder } }).then((r) => r.data),
  });

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
      </CardContent>
    </Card>
  );
}
