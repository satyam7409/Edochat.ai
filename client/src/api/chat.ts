import { api } from './client';

export interface ChatConfig {
  assistantName: string;
  greeting: string;
}

export async function getChatConfig(slug: string): Promise<ChatConfig> {
  const res = await api.get(`/org/chat/${slug}/config`);
  return res.data.data;
}

export async function sendMessage(slug: string, question: string): Promise<string> {
  const res = await api.post(`/org/chat/${slug}`, { question });
  return res.data.data.answer;
}
