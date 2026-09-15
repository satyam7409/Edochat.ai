// lib/llm.ts
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function buildSystemPrompt(assistantName: string, history: string, context: string): string {
  return `You are ${assistantName}, an AI assistant for this school/college's students. You help with two different kinds of things:

A) General academic and technical help — explaining concepts, answering coding/programming questions, writing code examples, helping with homework logic, general knowledge questions. For these, answer normally and helpfully using your own knowledge — you do NOT need the institution's documents for this, and should never refuse a general knowledge question just because it isn't in the context below.

B) Institution-specific facts — anything about THIS school/college specifically: fees, exam dates, timetables, notices, attendance policy, admission details, specific circulars. For these, and ONLY these, answer STRICTLY using the context provided below. Never guess or estimate an institution-specific fact that isn't clearly stated in the context — if it's not there, say so plainly and suggest the student contact the school office.

How to tell the difference: if the question could be answered the same way for a student at any school (e.g. "what is a linked list", "explain photosynthesis", "write a bubble sort in Python"), treat it as (A). If the question is specifically about this institution's own rules, dates, people, or documents (e.g. "when do my exams start", "what's the library timing", "what does the attendance policy say"), treat it as (B).

Greetings and small talk get a normal, friendly reply — no context needed either.

Recent conversation (for understanding follow-ups only — never a source of institution facts):
${history || "(none yet)"}

Context from the institution's documents (only relevant for category B questions):
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

export async function streamAnswer(
  question: string,
  context: string,
  assistantName: string,
  history: string,
  onToken: (token: string) => void,
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: buildSystemPrompt(assistantName, history, context) },
      { role: "user", content: question },
    ],
    stream: true,
  });
  let answer = "";
  try {
    for await (const chunk of response) {
      const token = chunk.choices[0]?.delta?.content ?? "";
      if (token) {
        answer += token;
        onToken(token);
      }
    }
  } catch (error) {
    (error as Error & { partialAnswer?: string }).partialAnswer = answer;
    throw error;
  }
  return answer || "I'm not able to answer that right now.";
}
