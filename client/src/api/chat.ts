import { api } from './client';

export interface ChatConfig {
  assistantName: string;
  greeting: string;
  publicSiteKey: string;
}

export async function getChatConfig(slug: string): Promise<ChatConfig> {
  const res = await api.get(`/org/chat/${slug}/config`);
  return res.data.data;
}

export async function sendMessage(slug: string, question: string, publicSiteKey: string, sessionId?: string): Promise<{ answer: string; sessionId: string }> {
  const res = await api.post(`/org/chat/${slug}`, { question, ...(sessionId ? { sessionId } : {}) }, {
    headers: { 'X-Assistant-Key': publicSiteKey },
  });
  return res.data.data;
}
