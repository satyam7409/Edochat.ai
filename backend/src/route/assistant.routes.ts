import { generateAssistant,getPublicAssistantConfig, publicChat } from "../controllers/assistant.controllers";
import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { chatRateLimiter } from "../middlewares/rateLimitor.middleware";
import { verifyOrgAccess } from "../middlewares/verifyOrgAcess.middleware";

const router = Router();

router.post("/:orgId/assistant/generate", authenticate, verifyOrgAccess, generateAssistant);
router.get("/chat/:slug/config", getPublicAssistantConfig);                 
router.post("/chat/:slug", chatRateLimiter, publicChat);


export default router;
