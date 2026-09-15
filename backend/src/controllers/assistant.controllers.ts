import { asyncHandler } from "../utils/asynchandler.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { retrieveContext } from "../qdrant/vectorClient.js";
import { streamAnswer } from "../lib/llm.js";
import {
  assistantKeySchema,
  chatRequestSchema,
  orgParamsSchema,
  parseInput,
  slugParamsSchema,
} from "../utils/validation.js";
import type { ChatMessage } from "../generated/prisma/client.js";


const DEFAULT_MONTHLY_CHAT_LIMIT = 1000;

function monthlyChatLimit() {
  const configured = Number(process.env.PUBLIC_CHAT_MONTHLY_LIMIT ?? DEFAULT_MONTHLY_CHAT_LIMIT);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : DEFAULT_MONTHLY_CHAT_LIMIT;
}

async function reserveChatUsage(orgId: string) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  await prisma.org.updateMany({
    where: { id: orgId, chatUsageMonth: { lt: monthStart } },
    data: { chatUsageMonth: monthStart, chatUsageCount: 0 },
  });
  const reserved = await prisma.org.updateMany({
    where: { id: orgId, chatUsageMonth: monthStart, chatUsageCount: { lt: monthlyChatLimit() } },
    data: { chatUsageCount: { increment: 1 } },
  });
  if (reserved.count === 0) throw new ApiError(429, "This assistant has reached its monthly question limit. Please contact the institution for access.");
}

export const generateAssistant = asyncHandler(async (req, res) => {
  const { orgId } = parseInput(orgParamsSchema, req.params);
  const readyDocsCount = await prisma.document.count({
    where: { orgId, status: "READY" },
  });
  if (readyDocsCount === 0) {
    throw new ApiError(
      400,
      "Upload at least one document before generating your assistant",
    );
  }

  const assistant = await prisma.assistant.update({
    where: { orgId },
    data: { status: "LIVE" },
  });
  const org = await prisma.org.findUnique({ where: { id: orgId } });

  const publicUrl = `${process.env.PUBLIC_APP_URL}/chat/${org!.slug}`;
  const embedSnippet = `<script async src="${process.env.PUBLIC_APP_URL}/widget.js" data-org="${org!.slug}" data-assistant-key="${assistant.publicSiteKey}"></script>`;

  return res.status(200).json(
    new ApiResponse(200, "Assistant is now live", {
      assistant,
      publicUrl,
      embedSnippet,
    }),
  );
});

export const getPublicAssistantConfig = asyncHandler(async (req, res) => {
  const { slug } = parseInput(slugParamsSchema, req.params);
  const org = await prisma.org.findUnique({
    where: { slug },
    include: { assistant: true },
  });
  if (!org?.assistant || org.assistant.status !== "LIVE")
    throw new ApiError(404, "Assistant not available");

  return res.status(200).json(
    new ApiResponse(200, "Config fetched", {
      assistantName: org.assistant.name,
      greeting: org.assistant.greetingMessage,
      publicSiteKey: org.assistant.publicSiteKey,
    }),
  );
});

export const publicChat = asyncHandler(async (req, res) => {
  const { slug } = parseInput(slugParamsSchema, req.params);
  const { question, sessionId } = parseInput(chatRequestSchema, req.body);
  const assistantKey = parseInput(
    assistantKeySchema,
    req.header("x-assistant-key"),
  );

  const org = await prisma.org.findUnique({
    where: { slug },
    include: { assistant: true },
  });
  if (!org?.assistant || org.assistant.status !== "LIVE")
    throw new ApiError(404, "Assistant not available");
  if (assistantKey !== org.assistant.publicSiteKey)
    throw new ApiError(403, "Invalid assistant key");

  // await reserveChatUsage(org.id);   // ← confirm intentional: no monthly cap is currently enforced

  let session;
  if (sessionId) {
    session = await prisma.chatSession.findFirst({
      where: { id: sessionId, orgId: org.id },
    });
    if (!session) throw new ApiError(404, "Chat session not found");
  } else {
    session = await prisma.chatSession.create({ data: { orgId: org.id } });
  }

  // FIX: fetch history BEFORE saving the current question, so the question
  // never ends up counted as its own prior context.
  const historyMessages = await prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "desc" },
    take: 6,
  });
  const history = historyMessages
    .reverse()
    .map((message: ChatMessage) => `${message.role}: ${message.content}`)
    .join("\n");

  await prisma.chatMessage.create({
    data: { sessionId: session.id, role: "USER", content: question },
  });

  const context = await retrieveContext(question, org.id);
  res.status(200).set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  let disconnected = false;
  res.on("close", () => { disconnected = true; });
  const send = (event: string, data: unknown) => {
    if (!disconnected) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      // res.flush?.();
    }
  };

  try {
  // Always call the LLM — the system prompt already knows how to handle
  // "context is empty because this is a general question" vs.
  // "context is empty because the docs genuinely don't cover this."
  const answer = await streamAnswer(question, context, org.assistant.name, history, (token) => {
    send("token", { token });
  });

  await prisma.chatMessage.create({
    data: { sessionId: session.id, role: "ASSISTANT", content: answer },
  });
  send("done", { answer, sessionId: session.id });
  } catch (error) {
    const partialAnswer = (error as Error & { partialAnswer?: string }).partialAnswer;
    if (partialAnswer) {
      await prisma.chatMessage.create({
        data: { sessionId: session.id, role: "ASSISTANT", content: partialAnswer },
      });
    }
    send("error", { message: error instanceof Error ? error.message : "Unable to generate an answer" });
  } finally {
    if (!res.writableEnded) res.end();
  }
});