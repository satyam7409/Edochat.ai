// lib/llm.ts
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv"
dotenv.config();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function generateAnswer(question: string, context: string, assistantName: string, history = ""): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",   // the free-tier model — check AI Studio for the latest flash version when you set this up
    contents: `${question}`,
    config: {
      systemInstruction: `You are ${assistantName}, a helpful assistant for students at this institution.
Answer ONLY using the context below. Conversation history is for resolving references only; it is not a source of facts. If the answer isn't in the context, say you don't have that information and suggest they contact the school office. Never guess dates, fees, or policies.

Recent conversation:
${history || "(none)"}

Context:
${context}`,
    },
  });

  return response.text ?? "I'm not able to answer that right now.";
}
