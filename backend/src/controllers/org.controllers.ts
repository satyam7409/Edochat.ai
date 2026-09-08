import { PDFParse } from "pdf-parse";
import multer from "multer";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asynchandler";
import { prisma } from "../lib/prisma";
import { customAlphabet } from "nanoid";
import { uploadDocumentFile } from "../lib/supabaseStorage";
import { chunkText } from "../utils/chunkText";
import { ingestDocument } from "../qdrant/vectorClient";
import { deleteDocumentChunks } from "../qdrant/vectorClient";

export const upload = multer({ storage: multer.memoryStorage() });
const generateSiteKey = customAlphabet(
  "abcdefghijklmnopqrstuvwxyz0123456789",
  24,
);

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

const createKnowledgebase = asyncHandler(async (req, res) => {
  const { userId, orgName, type, address } = req.body;

  // 1. Validate input up front — don't hit the DB with garbage
  if (!orgName || !type) {
    throw new ApiError(400, "Organization name and type are required");
  }
  if (!["SCHOOL", "COLLEGE"].includes(type)) {
    throw new ApiError(400, "Type must be SCHOOL or COLLEGE");
  }

  // 2. Confirm the user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // 3. Guard against a user who already belongs to an org
  if (user.orgId) {
    throw new ApiError(409, "This user already has a knowledge base");
  }

  // 4. Build a unique slug — this becomes the public URL, so it must not collide
  const baseSlug = slugify(orgName);
  let slug = baseSlug;
  let counter = 1;
  while (await prisma.org.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter++}`;
  }

  // 5. Create the org, link the existing user to it, and create a draft assistant —
  //    all three together, so a failure partway through doesn't leave a half-created org
  const { org, assistant } = await prisma.$transaction(async (tx) => {
    const org = await tx.org.create({
      data: {
        name: orgName,
        slug,
        type,
        address,
        users: { connect: { id: userId } }, // sets this user's orgId to the new org's id
      },
    });

    const assistant = await tx.assistant.create({
      data: {
        orgId: org.id,
        publicSiteKey: generateSiteKey(),
      },
    });

    return { org, assistant };
  });

  return res.status(201).json(
    new ApiResponse(201, "Knowledge base successfully created", {
      org,
      assistant,
    }),
  );
});


async function processDocumentAsync(
  documentId: string,
  orgId: string,
  category: string,
  pdfBuffer: Buffer,
) {
  try {
    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const result = await parser.getText();
    const textChunks = chunkText(result.text);
    await ingestDocument(documentId, orgId, category, textChunks);
  } catch (err) {
    console.error(`Ingestion failed for document ${documentId}:`, err);
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "FAILED" },
    });
  }
}

//crud
const uploadDocument = asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const { category } = req.body;

  if (typeof orgId !== "string") {
    throw new Error("Invalid orgId");
  }

  if (!req.file) throw new ApiError(400, "No file uploaded");
  if (req.file.mimetype !== "application/pdf")
    throw new ApiError(400, "Only PDF files allowed");
  if (!category) throw new ApiError(400, "Category is required");

  console.log("orfid", orgId);

  const org = await prisma.org.findUnique({ where: { id: orgId } });
  if (!org) throw new ApiError(404, "Organization not found");
  console.log("buffer", req.file.buffer);

  console.log(`${orgId}/${Date.now()}-${req.file.originalname}`);

  const fileUrl = await uploadDocumentFile(
    req.file.buffer,
    `${orgId}/${Date.now()}-${req.file.originalname}`,
  );
  console.log("filurl", fileUrl);

  const document = await prisma.document.create({
    data: {
      orgId,
      category,
      title: req.file.originalname,
      sourceType: "FILE",
      fileUrl,
      status: "PROCESSING",
    },
  });

  // respond now — don't make the admin wait for embedding to finish
  res
    .status(202)
    .json(
      new ApiResponse(202, "Upload received, processing started", { document }),
    );

  // heavy work happens after the response is sent
  processDocumentAsync(document.id, orgId, category, req.file.buffer);
  console.log("masla khtm");
});

export const listDocuments = asyncHandler(async (req, res) => {
  const { orgId } = req.params;
  const { category } = req.query;

  if (typeof orgId !== "string") {
    throw new Error("Invalid orgId");
  }

  const documents = await prisma.document.findMany({
    where: { orgId, ...(category ? { category: category as any } : {}) },
    orderBy: { createdAt: "desc" },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Documents fetched", { documents }));
});

export const getDocument = asyncHandler(async (req, res) => {
  const { orgId, docId } = req.params;
  if (typeof orgId !== "string") {
    throw new Error("Invalid orgId");
  }
  // matching on BOTH id and orgId matters — it's what stops one school from fetching another's doc by guessing an ID
  const document = await prisma.document.findFirst({
    where: { id: docId as string, orgId },
  });
  if (!document) throw new ApiError(404, "Document not found");
  return res
    .status(200)
    .json(new ApiResponse(200, "Document fetched", { document }));
});

export const deleteDocument = asyncHandler(async (req, res) => {
  const { orgId, docId } = req.params;
  if (typeof orgId !== "string") {
    throw new Error("Invalid orgId");
  }
  const document = await prisma.document.findFirst({
    where: { id: docId as string, orgId },
  });
  if (!document) throw new ApiError(404, "Document not found");

  await deleteDocumentChunks(docId as string); // Qdrant vectors + Postgres pointer rows, in that order
  await prisma.document.delete({ where: { id: docId as string } });

  return res.status(200).json(new ApiResponse(200, "Document deleted", {}));
});

async function reprocessDocumentAsync(
  documentId: string,
  orgId: string,
  category: string,
  pdfBuffer: Buffer,
) {
  try {
    await deleteDocumentChunks(documentId); // clear the old chunks before bringing in new ones
    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const result = await parser.getText();
    const textChunks = chunkText(result.text);
    await ingestDocument(documentId, orgId, category, textChunks);
  } catch (err) {
    console.error(`Reprocessing failed for document ${documentId}:`, err);
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "FAILED" },
    });
  }
}

export const updateDocument = asyncHandler(async (req, res) => {
  const { orgId, docId } = req.params;
  if (typeof orgId !== "string") {
    throw new Error("Invalid orgId");
  }
  const document = await prisma.document.findFirst({
    where: { id: docId as string, orgId },
  });
  if (!document) throw new ApiError(404, "Document not found");
  if (!req.file) throw new ApiError(400, "No file uploaded");

  const fileUrl = await uploadDocumentFile(
    req.file.buffer,
    `${orgId}/${Date.now()}-${req.file.originalname}`,
  );
  await prisma.document.update({
    where: { id: docId as string },
    data: { fileUrl, title: req.file.originalname, status: "PROCESSING" },
  });

  res
    .status(202)
    .json(new ApiResponse(202, "Update received, reprocessing started", {}));
  reprocessDocumentAsync(
    docId as string,
    orgId,
    document.category,
    req.file.buffer,
  );
});

export { uploadDocument, createKnowledgebase };
