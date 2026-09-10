import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import { ApiError } from "../utils/ApiError";

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "PDF files must be 10 MB or smaller" : err.message;
    return res.status(400).json({ success: false, message });
  }
  const apiError = err instanceof ApiError ? err : new ApiError(500, "Internal Server Error");
  if (!(err instanceof ApiError)) console.error(err);

  return res.status(apiError.statusCode).json({
    success: false,
    message: apiError.message,
  });
};
