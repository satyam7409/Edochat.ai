import { z } from "zod";
import { ApiError } from "./ApiError";

export const documentCategorySchema = z.enum([
  "FINANCE",
  "SYLLABUS",
  "TEST_PAPER",
  "NOTICE",
  "EVENTS",
  "OTHER",
]);

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
}).strict();

export const loginSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z.string().min(1, "Password is required").max(128),
}).strict();

export const createOrgSchema = z.object({
  orgName: z.string().trim().min(2).max(120).refine((name) => /[a-zA-Z0-9]/.test(name), "Institution name must include letters or numbers"),
  type: z.enum(["SCHOOL", "COLLEGE"]),
  address: z.string().trim().max(300).optional(),
}).strict();

export const orgParamsSchema = z.object({ orgId: z.string().min(1, "Invalid organization id").max(100) });
export const documentParamsSchema = orgParamsSchema.extend({ docId: z.string().min(1, "Invalid document id").max(100) });
export const slugParamsSchema = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid institution slug").max(160) });
export const documentQuerySchema = z.object({ category: documentCategorySchema.optional() });
export const uploadDocumentSchema = z.object({
  category: documentCategorySchema,
  text: z.string().trim().min(1).max(200_000).optional(),
  title: z.string().trim().min(1).max(200).optional(),
}).superRefine((value, ctx) => {
  if (!value.text && value.title) ctx.addIssue({ code: "custom", path: ["text"], message: "Text content is required when providing a title" });
  if (value.text && !value.title) ctx.addIssue({ code: "custom", path: ["title"], message: "A title is required for pasted text" });
});
export const questionSchema = z.object({ question: z.string().trim().min(2, "Question must be at least 2 characters").max(2_000) }).strict();
export const chatRequestSchema = questionSchema.extend({
  sessionId: z.string().cuid("Invalid chat session").optional(),
}).strict();
export const assistantKeySchema = z.string().regex(/^[a-z0-9]{24}$/, "Invalid assistant key");

export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApiError(400, result.error.issues.map((issue) => issue.message).join(", "));
  }
  return result.data;
}
