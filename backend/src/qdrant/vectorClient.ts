import { QdrantClient } from "@qdrant/js-client-rest";
import { v4 as uuidv4 } from 'uuid';
import { createEmbedding } from "../lib/embeddings";
import {prisma} from "../lib/prisma";

const client = new QdrantClient({ url: process.env.QDRANT_URL!, apiKey: process.env.QDRANT_API_KEY! });
const COLLECTION = "knowledge_chunks";

export async function upsertChunk(params: {
  documentId: string; orgId: string; category: string; chunkText: string; embedding: number[];
}) {
  const vectorId = uuidv4();
  await client.upsert(COLLECTION, {
    points: [{
      id: vectorId,
      vector: params.embedding,
      payload: {
        document_id: params.documentId,
        org_id: params.orgId,
        category: params.category,
        chunk_text: params.chunkText,
      },
    }],
  });
  return vectorId;
}

// export async function searchChunks(params: {
//   queryEmbedding: number[]; orgId: string; category?: string; limit?: number;
// }) {
//   const filter: any = { must: [{ key: "org_id", match: { value: params.orgId } }] };
//   if (params.category) filter.must.push({ key: "category", match: { value: params.category } });

//   const results = await client.search(COLLECTION, {
//     vector: params.queryEmbedding,
//     filter,
//     limit: params.limit ?? 5,
//   });
//   return results.map(r => r.payload?.chunk_text as string);
// }

export async function deleteChunksByVectorIds(vectorIds: string[]) {
  if (vectorIds.length === 0) return;
  await client.delete(COLLECTION, { points: vectorIds });
}


// ingestion.service.ts — runs when a doc is uploaded
export async function ingestChunks(documentId: string, orgId: string, category: string, textChunks: string[]) {
  for (const chunkText of textChunks) {
    const embedding = await createEmbedding(chunkText);
    const vectorId = await upsertChunk({ documentId, orgId, category, chunkText, embedding });
    await prisma.documentChunk.create({
      data: { documentId, vectorId, preview: chunkText.slice(0, 100) },
    });
  }
}

// runs on delete
export async function deleteDocumentChunks(documentId: string) {
  const chunks = await prisma.documentChunk.findMany({ where: { documentId }, select: { vectorId: true } });
  await deleteChunksByVectorIds(chunks.map(c => c.vectorId));
  await prisma.documentChunk.deleteMany({ where: { documentId } });
}

// retrieval.service.ts — runs when a student asks a question
// export async function retrieveContext(question: string, orgId: string, category?: string) {
//   const queryEmbedding = await createEmbedding(question);
//   const chunks = await searchChunks({ queryEmbedding, orgId, category });
//   return chunks.join("\n\n");
// }



// ingestion.service.ts
async function ingestOneChunk(params: {
  documentId: string; orgId: string; category: string; chunkText: string; embedding: number[];
}) {
  const vectorId = await upsertChunk(params);   // Qdrant write happens first
  try {
    await prisma.documentChunk.create({
      data: { documentId: params.documentId, vectorId, preview: params.chunkText.slice(0, 100) },
    });
  } catch (err) {
    await deleteChunksByVectorIds([vectorId]);  // undo the orphaned Qdrant write
    throw err;
  }
}

export async function ingestDocument(documentId: string, orgId: string, category: string, textChunks: string[]) {
  try {
    for (const chunkText of textChunks) {
      const embedding = await createEmbedding(chunkText);
      await ingestOneChunk({ documentId, orgId, category, chunkText, embedding });
    }
    await prisma.document.update({ where: { id: documentId }, data: { status: "READY" } });
  } catch (err) {
    await deleteDocumentChunks(documentId);     // clean up any chunks that did succeed
    await prisma.document.update({ where: { id: documentId }, data: { status: "FAILED" } });
    throw err;
  }
}