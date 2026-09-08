import { generateAssistant } from "../controllers/assistant.controllers";
import { Router } from "express";

const router = Router();

router.post("/:orgId/assistant/generate", generateAssistant);     


export default router;