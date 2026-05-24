import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/api";
import type { TicketDetail } from "@/types/ticket";
import type { UpdateTicketFields, TicketStatusType, TicketCategoryType } from "@resolveme/core";
import type { AxiosError } from "axios";

type Agent = { id: string; name: string };

const statusOptions: { label: string; value: TicketStatusType }[] = [
  { label: "Open", value: "open" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
];

const categoryOptions: { label: string; value: TicketCategoryType }[] = [
  { label: "General question", value: "general_question" },
  { label: "Technical question", value: "technical_question" },
  { label: "Refund request", value: "refund_request" },
];

const selectClass =
  "w-full rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50";

function SidebarField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      {children}
    </div>
  );
}

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

  const { mutate: patchTicket, isPending: isSaving } = useMutation({
    mutationFn: (patch: UpdateTicketFields) =>
      api.patch<TicketDetail>(`/api/tickets/${id}`, patch).then((r) => r.data),
    onSuccess: (updated) => {
      queryClient.setQueryData(["ticket", id], updated);
    },
    onError: (err: AxiosError<{ error?: string }>) => {
      console.error("Failed to update ticket", err.response?.data?.error);
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
        <div className="space-y-4">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-64" />
          <div className="grid grid-cols-[1fr_220px] gap-6 pt-2">
            <div className="space-y-3">
              <Skeleton className="h-32 w-full" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        </div>
      )}

      {isError && (
        <p className="text-destructive text-sm">Could not load ticket. Please try again.</p>
      )}

      {ticket && (
        <div className="space-y-4">
          <div>
            <h1 className="text-xl font-semibold">{ticket.subject}</h1>
            <div className="flex gap-3 text-sm text-muted-foreground mt-1">
              <span>
                <span className="font-medium text-foreground">{ticket.fromName}</span>
                <span className="ml-1">&lt;{ticket.fromEmail}&gt;</span>
              </span>
              <span>·</span>
              <span>{new Date(ticket.createdAt).toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_220px] gap-6 pt-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Message</p>
              <div className="rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-wrap font-mono leading-relaxed">
                {ticket.body}
              </div>
            </div>

            <div className="space-y-4 border-l pl-6">
              <SidebarField label="Status">
                <select
                  aria-label="Status"
                  value={ticket.status}
                  disabled={isSaving}
                  onChange={(e) => patchTicket({ status: e.target.value as TicketStatusType })}
                  className={selectClass}
                >
                  {statusOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </SidebarField>

              <SidebarField label="Category">
                <select
                  aria-label="Category"
                  value={ticket.category ?? ""}
                  disabled={isSaving}
                  onChange={(e) =>
                    patchTicket({ category: (e.target.value as TicketCategoryType) || undefined })
                  }
                  className={selectClass}
                >
                  <option value="">Uncategorised</option>
                  {categoryOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </SidebarField>

              <SidebarField label="Assigned to">
                <select
                  aria-label="Assigned to"
                  value={ticket.assignedTo?.id ?? ""}
                  disabled={isSaving}
                  onChange={(e) => patchTicket({ assignedToId: e.target.value || null })}
                  className={selectClass}
                >
                  <option value="">Unassigned</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </SidebarField>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
