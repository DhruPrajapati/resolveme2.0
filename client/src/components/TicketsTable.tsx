import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import api from "@/lib/api";
import type { Ticket } from "@/types/ticket";

const statusStyles: Record<Ticket["status"], string> = {
  open: "bg-blue-100 text-blue-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-600",
};

export function TicketsTable() {
  const { data: tickets = [], isPending: isLoading, isError: loadError } = useQuery({
    queryKey: ["tickets"],
    queryFn: () => api.get<Ticket[]>("/api/tickets").then((r) => r.data),
  });

  if (loadError) {
    return <p className="text-destructive text-sm">Could not load tickets. Please try again.</p>;
  }

  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-6 py-3 font-medium">Subject</th>
              <th className="px-6 py-3 font-medium">From</th>
              <th className="px-6 py-3 font-medium">Category</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Received</th>
            </tr>
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
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  No tickets yet.
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => (
                <tr key={ticket.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-6 py-3 font-medium">{ticket.subject}</td>
                  <td className="px-6 py-3">
                    <span>{ticket.fromName}</span>
                    <span className="block text-xs text-muted-foreground">{ticket.fromEmail}</span>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">
                    {ticket.category
                      ? ticket.category.replace(/_/g, " ")
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[ticket.status]}`}>
                      {ticket.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
