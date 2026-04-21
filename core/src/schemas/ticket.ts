import { z } from "zod";

export const TicketStatus = z.enum(["open", "resolved", "closed"]);
export const TicketCategory = z.enum([
  "general_question",
  "technical_question",
  "refund_request",
]);

export const inboundEmailSchema = z.object({
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
  fromName: z.string().trim().min(1),
  fromEmail: z.email().trim(),
  bodyHtml: z.string().optional(),
});

export const updateTicketSchema = z.object({
  status: TicketStatus.optional(),
  category: TicketCategory.optional(),
  assignedToId: z.string().optional(),
});

export type TicketStatusType = z.infer<typeof TicketStatus>;
export type TicketCategoryType = z.infer<typeof TicketCategory>;
export type InboundEmailFields = z.infer<typeof inboundEmailSchema>;
export type UpdateTicketFields = z.infer<typeof updateTicketSchema>;
