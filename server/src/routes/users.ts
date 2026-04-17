import { Router } from "express";
import { hashPassword } from "@better-auth/utils/password";
import { z } from "zod";
import { Role } from "@prisma/client";
import { createUserSchema, editUserSchema } from "@resolveme/core";
import prisma from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

// All user management routes require authentication + admin role
router.use(requireAuth, requireAdmin);

// GET /api/users — list all non-deleted users (safe fields only)
router.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
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


// POST /api/users — create a new user account
router.post("/", async (req, res) => {
  const result = createUserSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error).fieldErrors });
    return;
  }

  const { name, email, password } = result.data;
  const role = Role.agent;

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

// DELETE /api/users/:id — soft-delete a user (admins cannot be deleted)
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  if (id === req.user!.id) {
    res.status(400).json({ error: "You cannot delete your own account." });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id, deletedAt: null } });
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  if (user.role === Role.admin) {
    res.status(403).json({ error: "Admin accounts cannot be deleted." });
    return;
  }

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: id } }),
    prisma.user.update({ where: { id }, data: { deletedAt: new Date() } }),
  ]);
  res.status(204).send();
});

// PATCH /api/users/:id — update name, email, and optionally password
router.patch("/:id", async (req, res) => {
  const { id } = req.params;

  const result = editUserSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error).fieldErrors });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { id, deletedAt: null } });
  if (!existing) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const { name, email, password } = result.data;

  if (email !== existing.email) {
    const conflict = await prisma.user.findUnique({ where: { email } });
    if (conflict) {
      res.status(409).json({ error: "A user with that email already exists." });
      return;
    }
  }

  const now = new Date();

  const updated = await prisma.user.update({
    where: { id },
    data: { name, email, updatedAt: now },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  if (password) {
    const hashedPassword = await hashPassword(password);
    await prisma.account.updateMany({
      where: { userId: id, providerId: "credential" },
      data: { password: hashedPassword, updatedAt: now },
    });
  }

  res.json(updated);
});

export default router;
