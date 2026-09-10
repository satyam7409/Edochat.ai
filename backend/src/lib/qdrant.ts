import { QdrantClient } from "@qdrant/js-client-rest";
import dotenv from "dotenv"
dotenv.config();

const client = new QdrantClient({
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY!,
});

export async function ensureKnowledgeCollection() {
  const exists = await client.collectionExists("knowledge_chunks");
  if (exists.exists) return;
  await client.createCollection("knowledge_chunks", {
    vectors: { size: 384, distance: "Cosine" },   
  });
  await client.createPayloadIndex("knowledge_chunks", { field_name: "org_id", field_schema: "keyword" });
}
