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

export async function streamMessage(
  slug: string,
  question: string,
  publicSiteKey: string,
  onToken: (token: string) => void,
  sessionId?: string,
): Promise<{ answer: string; sessionId: string }> {
  const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/org/chat/${slug}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Assistant-Key': publicSiteKey },
    body: JSON.stringify({ question, ...(sessionId ? { sessionId } : {}) }),
  });
  if (!response.ok || !response.body) {
    let message = 'Unable to start the response';
    try { message = (await response.json()).message || message; } catch { /* non-JSON error */ }
    throw new Error(message);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: { answer: string; sessionId: string } | undefined;
  const handleEvent = (block: string) => {
    const event = block.match(/^event: (.+)$/m)?.[1];
    const data = block.match(/^data: (.+)$/m)?.[1];
    if (!event || !data) return;
    const payload = JSON.parse(data) as { token?: string; answer?: string; sessionId?: string; message?: string };
    if (event === 'token' && payload.token) onToken(payload.token);
    if (event === 'done' && payload.answer && payload.sessionId) result = { answer: payload.answer, sessionId: payload.sessionId };
    if (event === 'error') throw new Error(payload.message || 'Unable to generate an answer');
  };
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() || '';
    blocks.forEach(handleEvent);
    if (done) break;
  }
  if (buffer.trim()) handleEvent(buffer);
  if (!result) throw new Error('The response ended unexpectedly');
  return result;
}
