import { Router } from "express";
import { hashPassword } from "@better-auth/utils/password";
import { z } from "zod";
import prisma from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

// All user management routes require authentication + admin role
router.use(requireAuth, requireAdmin);

// GET /api/users — list all users (safe fields only)
router.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  res.json(users);
});

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(12),
  role: z.enum(["agent", "admin"]).default("agent"),
});

// POST /api/users — create a new user account
router.post("/", async (req, res) => {
  const result = createUserSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error).fieldErrors });
    return;
  }

  const { name, email, password, role } = result.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "A user with that email already exists." });
    return;
  }

  const id = crypto.randomUUID();
  const now = new Date();
  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      id,
      name,
      email,
      emailVerified: true,
      role,
      createdAt: now,
      updatedAt: now,
      accounts: {
        create: {
          id: crypto.randomUUID(),
          accountId: id,
          providerId: "credential",
          password: hashedPassword,
          createdAt: now,
          updatedAt: now,
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  res.status(201).json(user);
});

// DELETE /api/users/:id — remove a user
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  // Prevent admin from deleting themselves
  if (id === req.user!.id) {
    res.status(400).json({ error: "You cannot delete your own account." });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  await prisma.user.delete({ where: { id } });
  res.status(204).send();
});

export default router;
