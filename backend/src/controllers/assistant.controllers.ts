import { asyncHandler } from "../utils/asynchandler";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { retrieveContext } from "../qdrant/vectorClient";
import { generateAnswer } from "../lib/llm";
import { assistantKeySchema, chatRequestSchema, orgParamsSchema, parseInput, slugParamsSchema } from "../utils/validation";

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
  const org = await prisma.org.findUnique({ where: { slug }, include: { assistant: true } });
  if (!org?.assistant || org.assistant.status !== "LIVE") throw new ApiError(404, "Assistant not available");

  return res.status(200).json(new ApiResponse(200,"Config fetched",{
    assistantName: org.assistant.name,
    greeting: org.assistant.greetingMessage,
    publicSiteKey: org.assistant.publicSiteKey,
  }));
});

export const publicChat = asyncHandler(async (req, res) => {
  const { slug } = parseInput(slugParamsSchema, req.params);
  const { question, sessionId } = parseInput(chatRequestSchema, req.body);
  const assistantKey = parseInput(assistantKeySchema, req.header("x-assistant-key"));

  const org = await prisma.org.findUnique({ where: { slug }, include: { assistant: true } });
  if (!org?.assistant || org.assistant.status !== "LIVE") throw new ApiError(404, "Assistant not available");
  if (assistantKey !== org.assistant.publicSiteKey) throw new ApiError(403, "Invalid assistant key");

  let session;
  if (sessionId) {
    session = await prisma.chatSession.findFirst({ where: { id: sessionId, orgId: org.id } });
    if (!session) throw new ApiError(404, "Chat session not found");
  } else {
    session = await prisma.chatSession.create({ data: { orgId: org.id } });
  }
  await prisma.chatMessage.create({ data: { sessionId: session.id, role: "USER", content: question } });

  const historyMessages = await prisma.chatMessage.findMany({
    where: { sessionId: session.id }, orderBy: { createdAt: "desc" }, take: 6,
  });
  const history = historyMessages.reverse().map((message) => `${message.role}: ${message.content}`).join("\n");
  
  const context = await retrieveContext(question, org.id);
  if (!context.trim()) {
    const answer = "I couldn't find anything about that in our records. Please contact the office directly.";
    await prisma.chatMessage.create({ data: { sessionId: session.id, role: "ASSISTANT", content: answer } });
    return res.status(200).json(new ApiResponse(200,"No matching content", {
      answer, sessionId: session.id,
    }));
  }

  const answer = await generateAnswer(question, context, org.assistant.name, history);
  await prisma.chatMessage.create({ data: { sessionId: session.id, role: "ASSISTANT", content: answer } });
  return res.status(200).json(new ApiResponse(200,"Answer generated", { answer, sessionId: session.id }, ));
});
