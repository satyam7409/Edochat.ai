import {
  generateAssistant,
  getPublicAssistantConfig,
  publicChat,
} from "../controllers/assistant.controllers.js";
import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { chatRateLimiter } from "../middlewares/rateLimitor.middleware.js";
import { verifyOrgAccess } from "../middlewares/verifyOrgAcess.middleware.js";

const router = Router();


router.get("/chat/:slug/config", getPublicAssistantConfig);
router.post(
  "/:orgId/assistant/generate",
  authenticate,
  verifyOrgAccess,
  generateAssistant,
);
router.post("/chat/:slug", chatRateLimiter, publicChat);

export default router;
