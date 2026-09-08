// lib/supabaseStorage.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!   // service role, not the anon key — this runs server-side only, never expose it to a client
);

const BUCKET = "documents";

export async function uploadDocumentFile(buffer: Buffer, path: string): Promise<string> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: "application/pdf", upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  // bucket is private, so we store the path and generate signed URLs on demand — not a permanent public link
  return path;
}

export async function getSignedDocumentUrl(path: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw new Error(`Failed to sign URL: ${error.message}`);
  return data.signedUrl;
}

export async function deleteDocumentFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}