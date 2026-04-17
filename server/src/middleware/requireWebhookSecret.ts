import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";

export function requireWebhookSecret(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.WEBHOOK_SECRET;
  const incoming = req.headers["x-webhook-secret"];

  if (!incoming || typeof incoming !== "string" || !secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const secretBuf = Buffer.from(secret);
  const incomingBuf = Buffer.from(incoming);

  if (secretBuf.length !== incomingBuf.length || !timingSafeEqual(secretBuf, incomingBuf)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
