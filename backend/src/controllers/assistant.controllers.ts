import { asyncHandler } from "../utils/asynchandler";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { retrieveContext } from "../qdrant/vectorClient";
import { generateAnswer } from "../lib/llm";
import { orgParamsSchema, parseInput, questionSchema, slugParamsSchema } from "../utils/validation";

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
  const embedSnippet = `<script src="${process.env.PUBLIC_APP_URL}/widget.js" data-org="${org!.slug}"></script>`;

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
  }));
});

export const publicChat = asyncHandler(async (req, res) => {
  const { slug } = parseInput(slugParamsSchema, req.params);
  const { question } = parseInput(questionSchema, req.body);

  const org = await prisma.org.findUnique({ where: { slug }, include: { assistant: true } });
  if (!org?.assistant || org.assistant.status !== "LIVE") throw new ApiError(404, "Assistant not available");
  
  const context = await retrieveContext(question, org.id);
  if (!context.trim()) {
    return res.status(200).json(new ApiResponse(200,"No matching content", {
      answer: "I couldn't find anything about that in our records. Please contact the office directly.",
    }));
  }

  const answer = await generateAnswer(question, context, org.assistant.name);
  return res.status(200).json(new ApiResponse(200,"Answer generated", { answer }, ));
});
