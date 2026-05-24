import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/api";
import type { TicketDetail } from "@/types/ticket";

const statusStyles = {
  open: "bg-blue-100 text-blue-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-600",
} as const;

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 items-start">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: ticket, isPending, isError } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => api.get<TicketDetail>(`/api/tickets/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  return (
    <div className="space-y-4">
      <Link
        to="/tickets"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tickets
      </Link>

      {isPending && (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-2/3" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-24 w-full mt-2" />
          </CardContent>
        </Card>
      )}

      {isError && (
        <p className="text-destructive text-sm">Could not load ticket. Please try again.</p>
      )}

      {ticket && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">{ticket.subject}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <dl className="space-y-3">
              <MetaRow label="From">
                <span className="font-medium">{ticket.fromName}</span>
                <span className="text-muted-foreground ml-1">&lt;{ticket.fromEmail}&gt;</span>
              </MetaRow>
              <MetaRow label="Received">
                {new Date(ticket.createdAt).toLocaleString()}
              </MetaRow>
              <MetaRow label="Status">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[ticket.status]}`}>
                  {ticket.status}
                </span>
              </MetaRow>
              <MetaRow label="Category">
                {ticket.category
                  ? ticket.category.replace(/_/g, " ")
                  : <span className="text-muted-foreground">—</span>}
              </MetaRow>
              {ticket.assignedTo && (
                <MetaRow label="Assigned to">
                  {ticket.assignedTo.name}
                </MetaRow>
              )}
            </dl>

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Message</p>
              <div className="rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-wrap font-mono leading-relaxed">
                {ticket.body}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
