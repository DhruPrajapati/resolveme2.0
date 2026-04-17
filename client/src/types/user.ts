import type { Role } from "@resolveme/core";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}
