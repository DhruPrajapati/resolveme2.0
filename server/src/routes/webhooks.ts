import { Router } from "express";
import { inboundEmailSchema } from "@resolveme/core";
import prisma from "../db.js";
import { requireWebhookSecret } from "../middleware/requireWebhookSecret.js";

const router = Router();

router.post("/email", requireWebhookSecret, async (req, res) => {
  const result = inboundEmailSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten().fieldErrors });
    return;
  }

  try {
    const ticket = await prisma.ticket.create({
      data: result.data,
    });
    res.status(200).json({ id: ticket.id });
  } catch (err) {
    console.error("Failed to create ticket from inbound email:", err);
    res.status(200).json({ error: "Internal error" });
  }
});

export default router;
