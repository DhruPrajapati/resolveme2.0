import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/api";
import type { TicketDetail } from "@/types/ticket";
import type { AxiosError } from "axios";

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

type Agent = { id: string; name: string };

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: ticket, isPending, isError } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => api.get<TicketDetail>(`/api/tickets/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.get<Agent[]>("/api/agents").then((r) => r.data),
  });

  const { mutate: assign, isPending: isAssigning } = useMutation({
    mutationFn: (assignedToId: string | null) =>
      api.patch<TicketDetail>(`/api/tickets/${id}`, { assignedToId }).then((r) => r.data),
    onSuccess: (updated) => {
      queryClient.setQueryData(["ticket", id], updated);
    },
    onError: (err: AxiosError<{ error?: string }>) => {
      console.error("Failed to assign ticket", err.response?.data?.error);
    },
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
              <MetaRow label="Assigned to">
                <select
                  value={ticket.assignedTo?.id ?? ""}
                  disabled={isAssigning}
                  onChange={(e) => assign(e.target.value || null)}
                  className="rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 w-48"
                >
                  <option value="">Unassigned</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                {isAssigning && (
                  <span className="ml-2 text-xs text-muted-foreground">Saving…</span>
                )}
              </MetaRow>
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
