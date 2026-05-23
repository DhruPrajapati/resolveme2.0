import { Router } from "express";
import { updateTicketSchema, TicketStatus, TicketCategory, ticketSortBySchema, ticketSortOrderSchema } from "@resolveme/core";
import prisma from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  const statusParam = req.query.status as string | undefined;
  const statusResult = statusParam ? TicketStatus.safeParse(statusParam) : null;

  if (statusResult && !statusResult.success) {
    res.status(400).json({ error: "Invalid status value" });
    return;
  }

  const categoryParam = req.query.category as string | undefined;
  const categoryResult = categoryParam ? TicketCategory.safeParse(categoryParam) : null;

  if (categoryResult && !categoryResult.success) {
    res.status(400).json({ error: "Invalid category value" });
    return;
  }

  const search = (req.query.search as string | undefined)?.trim() || undefined;

  const sortBy = ticketSortBySchema.catch("createdAt").parse(req.query.sortBy);
  const sortOrder = ticketSortOrderSchema.catch("desc").parse(req.query.sortOrder);

  const where = {
    ...(statusResult ? { status: statusResult.data } : {}),
    ...(categoryResult ? { category: categoryResult.data } : {}),
    ...(search ? {
      OR: [
        { subject: { contains: search, mode: "insensitive" as const } },
        { fromName: { contains: search, mode: "insensitive" as const } },
        { fromEmail: { contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const tickets = await prisma.ticket.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    orderBy: { [sortBy]: sortOrder },
    select: {
      id: true,
      subject: true,
      fromName: true,
      fromEmail: true,
      status: true,
      category: true,
      createdAt: true,
      assignedTo: { select: { id: true, name: true } },
    },
  });

  res.json(tickets);
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ticket id" });
    return;
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { assignedTo: { select: { id: true, name: true } } },
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  res.json(ticket);
});

router.patch("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ticket id" });
    return;
  }

  const result = updateTicketSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten().fieldErrors });
    return;
  }

  const existing = await prisma.ticket.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const ticket = await prisma.ticket.update({
    where: { id },
    data: result.data,
    include: { assignedTo: { select: { id: true, name: true } } },
  });

  res.json(ticket);
});

export default router;
