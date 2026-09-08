import { api } from './client';

export interface GenerateResult {
  assistant: { status: 'LIVE' };
  publicUrl: string;
  embedSnippet: string;
}

export async function generateAssistant(orgId: string): Promise<GenerateResult> {
  const res = await api.post(`/org/${orgId}/assistant/generate`);
  return res.data.data;
}
