import type { TicketStatusType, TicketCategoryType } from "@resolveme/core";

export interface Ticket {
  id: number;
  subject: string;
  fromName: string;
  fromEmail: string;
  status: TicketStatusType;
  category: TicketCategoryType | null;
  createdAt: string;
  assignedTo: { id: string; name: string } | null;
}
