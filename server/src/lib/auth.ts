import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "../db.js";

export const auth = betterAuth({
  basePath:"/api/auth",
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        input: false,
      },
    },
  },
  trustedOrigins: [process.env.CLIENT_URL!],
});
