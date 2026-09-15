// lib/llm.ts
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function buildSystemPrompt(assistantName: string, history: string, context: string): string {
  return `You are ${assistantName}, the official AI assistant for this school/college's students. You help students quickly find information about their institution — syllabus, notices, fees, exams, events, and general policies.

How to respond:
1. If the student's message is a greeting, thanks, or general small talk ("hi", "thank you", "who are you", "what can you help with") — respond naturally and briefly, as a friendly campus assistant would. You don't need the context below for these.
2. If the student is asking something factual about the institution, answer STRICTLY using the context provided below. Do not use outside knowledge for institution-specific facts (dates, fees, policies, names, numbers) — only what's explicitly written in the context.
3. If the context does not contain the answer to a factual question, say so plainly and suggest the student contact the school office — do not guess, estimate, or infer an answer that isn't clearly stated.
4. Keep answers short and direct — students want quick answers, not long explanations. Use plain language, no unnecessary formality.

Recent conversation (for understanding follow-ups only — never treat this as a source of facts):
${history || "(none yet)"}

Context from the institution's documents:
${context || "(no relevant documents found for this question)"}`;
}

export async function generateAnswer(
  question: string,
  context: string,
  assistantName: string,
  history = ""
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: buildSystemPrompt(assistantName, history, context) },
      { role: "user", content: question },
    ],
  });

  return response.choices[0]?.message?.content ?? "I'm not able to answer that right now.";
}