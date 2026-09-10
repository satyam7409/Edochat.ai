// middleware/rateLimiters.ts
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

export const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  keyGenerator: (req) => `${req.params.slug ?? "public"}-${ipKeyGenerator(req.ip ?? "")}`,
  message: { success: false, message: "Too many questions — please wait a moment." },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many attempts — please try again later." },
});
