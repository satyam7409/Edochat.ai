import { PDFParse } from "pdf-parse";
import multer from "multer";
import { customAlphabet } from "nanoid";
import { deleteDocumentFile, getSignedDocumentUrl, uploadDocumentFile } from "../lib/supabaseStorage";
import { prisma } from "../lib/prisma";
import { deleteDocumentChunks, ingestDocument } from "../qdrant/vectorClient";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asynchandler";
import { chunkText } from "../utils/chunkText";
import { createOrgSchema, documentParamsSchema, documentQuerySchema, orgParamsSchema, parseInput, uploadDocumentSchema } from "../utils/validation";

export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_req, file, callback) => callback(null, file.mimetype === "application/pdf") });
const generateSiteKey = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 24);

function slugify(name: string) { return name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-"); }
async function uniqueSlug(name: string) { const base = slugify(name); let slug = base; let suffix = 1; while (await prisma.org.findUnique({ where: { slug } })) slug = `${base}-${suffix++}`; return slug; }

async function processDocumentAsync(documentId: string, orgId: string, category: string, content: Buffer | string) {
  try {
    const text = Buffer.isBuffer(content) ? (await new PDFParse({ data: new Uint8Array(content) }).getText()).text : content;
    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error("The document contains no readable text");
    await ingestDocument(documentId, orgId, category, chunks);
  } catch (error) {
    console.error(`Ingestion failed for document ${documentId}:`, error);
    await prisma.document.update({ where: { id: documentId }, data: { status: "FAILED" } });
  }
}

async function readDocumentContent(document: { sourceType: "FILE" | "TEXT"; fileUrl: string | null; textContent: string | null }) {
  if (document.sourceType === "TEXT") {
    if (!document.textContent) throw new Error("Text source is unavailable for reprocessing");
    return document.textContent;
  }
  if (!document.fileUrl) throw new Error("PDF source is unavailable for reprocessing");
  const signedUrl = await getSignedDocumentUrl(document.fileUrl);
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error("Unable to download the uploaded PDF for reprocessing");
  return Buffer.from(await response.arrayBuffer());
}

// Recover uploads left in PROCESSING after an interrupted process or deployment.
export async function retryProcessingDocuments() {
  const documents = await prisma.document.findMany({
    where: { status: "PROCESSING" },
    select: { id: true, orgId: true, category: true, sourceType: true, fileUrl: true, textContent: true },
  });
  await Promise.allSettled(documents.map(async (document) => {
    await deleteDocumentChunks(document.id);
    await processDocumentAsync(document.id, document.orgId, document.category, await readDocumentContent(document));
  }));
}

export const createKnowledgebase = asyncHandler(async (req, res) => {
  const { orgName, type, address } = parseInput(createOrgSchema, req.body);
  const userId = req.user!.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(401, "User no longer exists");
  if (user.orgId) throw new ApiError(409, "This user already has a knowledge base");
  const slug = await uniqueSlug(orgName);
  const { org, assistant } = await prisma.$transaction(async (tx) => {
    const org = await tx.org.create({ data: { name: orgName, slug, type, ...(address ? { address } : {}), users: { connect: { id: userId } } } });
    const assistant = await tx.assistant.create({ data: { orgId: org.id, publicSiteKey: generateSiteKey() } });
    return { org, assistant };
  });
  return res.status(201).json(new ApiResponse(201, "Knowledge base successfully created", { org, assistant }));
});

export const uploadDocument = asyncHandler(async (req, res) => {
  const { orgId } = parseInput(orgParamsSchema, req.params);
  const { category, text, title } = parseInput(uploadDocumentSchema, req.body);
  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!org) throw new ApiError(404, "Organization not found");
  if (req.file) {
    if (req.file.mimetype !== "application/pdf") throw new ApiError(400, "Only PDF files allowed");
    const fileUrl = await uploadDocumentFile(req.file.buffer, `${orgId}/${Date.now()}-${req.file.originalname}`);
    const document = await prisma.document.create({ data: { orgId, category, title: req.file.originalname, sourceType: "FILE", fileUrl, textContent: null, status: "PROCESSING" } });
    res.status(202).json(new ApiResponse(202, "Upload received, processing started", { document }));
    void processDocumentAsync(document.id, orgId, category, req.file.buffer);
    return;
  }
  if (text && title) {
    const document = await prisma.document.create({ data: { orgId, category, title, sourceType: "TEXT", fileUrl: null, textContent: text, status: "PROCESSING" } });
    res.status(202).json(new ApiResponse(202, "Text received, processing started", { document }));
    void processDocumentAsync(document.id, orgId, category, text);
    return;
  }
  throw new ApiError(400, "Provide either a PDF file or pasted text content");
});

export const listDocuments = asyncHandler(async (req, res) => {
  const { orgId } = parseInput(orgParamsSchema, req.params);
  const { category } = parseInput(documentQuerySchema, req.query);
  const documents = await prisma.document.findMany({ where: { orgId, ...(category ? { category } : {}) }, orderBy: { createdAt: "desc" } });
  return res.status(200).json(new ApiResponse(200, "Documents fetched", { documents }));
});

export const getDocument = asyncHandler(async (req, res) => {
  const { orgId, docId } = parseInput(documentParamsSchema, req.params);
  const document = await prisma.document.findFirst({ where: { id: docId, orgId } });
  if (!document) throw new ApiError(404, "Document not found");
  return res.status(200).json(new ApiResponse(200, "Document fetched", { document }));
});

export const deleteDocument = asyncHandler(async (req, res) => {
  const { orgId, docId } = parseInput(documentParamsSchema, req.params);
  const document = await prisma.document.findFirst({ where: { id: docId, orgId } });
  if (!document) throw new ApiError(404, "Document not found");
  await deleteDocumentChunks(docId);
  await prisma.document.delete({ where: { id: docId } });
  if (document.fileUrl) {
    try {
      await deleteDocumentFile(document.fileUrl);
    } catch (error) {
      // The database/vector state is already gone; log so this can be retried from storage tooling.
      console.error(`Failed to delete storage file for document ${docId}:`, error);
    }
  }
  return res.status(200).json(new ApiResponse(200, "Document deleted", {}));
});

export const updateDocument = asyncHandler(async (req, res) => {
  const { orgId, docId } = parseInput(documentParamsSchema, req.params);
  const document = await prisma.document.findFirst({ where: { id: docId, orgId } });
  if (!document) throw new ApiError(404, "Document not found");
  if (!req.file || req.file.mimetype !== "application/pdf") throw new ApiError(400, "A PDF file is required");
  const fileUrl = await uploadDocumentFile(req.file.buffer, `${orgId}/${Date.now()}-${req.file.originalname}`);
  await prisma.document.update({ where: { id: docId }, data: { fileUrl, title: req.file.originalname, sourceType: "FILE", textContent: null, status: "PROCESSING" } });
  if (document.fileUrl) {
    try {
      await deleteDocumentFile(document.fileUrl);
    } catch (error) {
      console.error(`Failed to delete replaced storage file for document ${docId}:`, error);
    }
  }
  res.status(202).json(new ApiResponse(202, "Update received, reprocessing started", {}));
  void deleteDocumentChunks(docId).then(() => processDocumentAsync(docId, orgId, document.category, req.file!.buffer));
});
