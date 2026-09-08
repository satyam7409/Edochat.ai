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
const router = Router();

router.post("/", createKnowledgebase);
router.post("/:orgId/documents", upload.single("pdfFile"), uploadDocument);
router.get("/:orgId/documents", listDocuments);
router.get("/:orgId/documents/:docId", getDocument);
router.delete("/orgs/:orgId/documents/:docId", deleteDocument);
router.patch(
  "/orgs/:orgId/documents/:docId",
  upload.single("pdfFile"),
  updateDocument,
);

export default router;
