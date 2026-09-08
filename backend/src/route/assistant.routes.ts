import { generateAssistant,getPublicAssistantConfig, publicChat } from "../controllers/assistant.controllers";
import { Router } from "express";

const router = Router();

router.post("/:orgId/assistant/generate", generateAssistant);    
router.get("/chat/:slug/config", getPublicAssistantConfig);                 
router.post("/chat/:slug", publicChat);  


export default router;