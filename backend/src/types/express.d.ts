import type { Role } from "../generated/prisma/enums";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        orgId: string | null;
        role: Role;
      };
    }
  }
}

export {};
