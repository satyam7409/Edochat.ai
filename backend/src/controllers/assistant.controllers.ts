import { asyncHandler } from "../utils/asynchandler";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";

export const generateAssistant = asyncHandler(async (req, res) => {
  const { orgId } = req.params;

  if (typeof orgId !== "string") {
    throw new Error("Invalid orgId");
  }
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
