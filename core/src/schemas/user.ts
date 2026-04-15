import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters").max(100),
  email: z.string().email("Enter a valid email"),
  password: z.string().trim().min(8, "Password must be at least 8 characters"),
});

export type CreateUserFields = z.infer<typeof createUserSchema>;

export const editUserSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters").max(100),
  email: z.string().email("Enter a valid email"),
  password: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().trim().min(8, "Password must be at least 8 characters").optional(),
  ),
});

export type EditUserFields = z.infer<typeof editUserSchema>;
