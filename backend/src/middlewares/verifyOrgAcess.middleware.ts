// middleware/verifyOrgAccess.middleware.ts
import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";

export function verifyOrgAccess(req: Request, _res: Response, next: NextFunction) {
  const { orgId } = req.params;

  if (!req.user?.orgId) {
    throw new ApiError(403, "You don't have a knowledge base yet");
  }
  if (req.user.orgId !== orgId) {
    throw new ApiError(403, "You don't have access to this organization");
  }

  next();
}
