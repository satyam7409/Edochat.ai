import { Router } from "express";
import {
  createKnowledgebase,
  uploadDocument,
  listDocuments,
  getDocument,
  deleteDocument,
  updateDocument,
  upload,
} from "../controllers/org.controllers";
import { authenticate } from "../middlewares/auth.middleware";
import { verifyOrgAccess } from "../middlewares/verifyOrgAcess.middleware";
const router = Router();

router.use(authenticate);
router.post("/", createKnowledgebase);
router.use("/:orgId", verifyOrgAccess);
router.post("/:orgId/documents", upload.single("pdfFile"), uploadDocument);
router.get("/:orgId/documents", listDocuments);
router.get("/:orgId/documents/:docId", getDocument);
router.delete("/:orgId/documents/:docId", deleteDocument);
router.patch("/:orgId/documents/:docId", upload.single("pdfFile"), updateDocument);

export default router;
