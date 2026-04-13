import type { auth } from "../lib/auth.js";

type BetterAuthSession = typeof auth.$Infer.Session;

declare global {
  namespace Express {
    interface Request {
      session: BetterAuthSession["session"] | null;
      user: BetterAuthSession["user"] | null;
    }
  }
}
