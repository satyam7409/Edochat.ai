// middleware/auth.middleware.ts
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asynchandler";

export const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(401, "Authentication required");
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) throw new ApiError(401, "Authentication required");

  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new ApiError(500, "Authentication is not configured");

  let payload: { userId: string };
  try {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded === "string" || !decoded.userId || typeof decoded.userId !== "string") {
      throw new Error("Invalid token payload");
    }
    payload = { userId: decoded.userId };
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }

  // fetch fresh from the DB rather than trusting anything baked into the token —
  // orgId can change after a token was issued (e.g. right after signup, before an org exists)
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true, orgId: true, role: true },
  });

  if (!user) throw new ApiError(401, "User no longer exists");

  req.user = user;
  next();
});
