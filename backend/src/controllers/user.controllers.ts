import { asyncHandler } from "../utils/asynchandler";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { loginSchema, parseInput, signupSchema } from "../utils/validation";

function issueTokens(userId: string) {
  const accessToken = jwt.sign({ userId }, process.env.JWT_ACCESS_SECRET!, {
    expiresIn: "1d",
  });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: "30d",
  });
  return { accessToken, refreshToken };
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function storeRefreshToken(userId: string, refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
}

const signup = asyncHandler(async (req, res) => {
  console.log("yh agayga baii");
  
  const { name, email, password } = parseInput(signupSchema, req.body);

  // check by email, not name — email is the actual unique field on this model
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError(409, "An account with this email already exists");
  }

  const hash = await bcrypt.hash(password, 10);
  const newUser = await prisma.user.create({
    data: { email, passwordHash: hash, name, role: "ADMIN" },
  });

  const { accessToken, refreshToken } = issueTokens(newUser.id);
  await storeRefreshToken(newUser.id, refreshToken);

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  return res.status(201).json(
    new ApiResponse(201, "Signup Successfull", {
      user: { id: newUser.id, name: newUser.name, email: newUser.email },
      accessToken,
    }),
  );
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = parseInput(loginSchema, req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  // deliberately vague error either way — never reveal whether the email exists
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new ApiError(401, "Invalid email or password");
  }

  const { accessToken, refreshToken } = issueTokens(user.id);
  await storeRefreshToken(user.id, refreshToken);

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  return res.status(200).json(
    new ApiResponse(200, "Login successful", {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        orgId: user.orgId,
      },
      accessToken,
    }),
  );
});

function readRefreshToken(cookieHeader: string | undefined) {
  return cookieHeader?.split(";").map((part) => part.trim()).find((part) => part.startsWith("refreshToken="))?.slice("refreshToken=".length);
}

const refresh = asyncHandler(async (req, res) => {
  const refreshToken = readRefreshToken(req.headers.cookie);
  if (!refreshToken) throw new ApiError(401, "Refresh token required");

  let payload: { userId: string };
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!);
    if (typeof decoded === "string" || typeof decoded.userId !== "string") throw new Error("Invalid token payload");
    payload = { userId: decoded.userId };
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }
  const storedToken = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } });
  if (!storedToken || storedToken.userId !== payload.userId || storedToken.expiresAt <= new Date()) {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  await prisma.refreshToken.delete({ where: { id: storedToken.id } });
  const { accessToken, refreshToken: rotatedRefreshToken } = issueTokens(payload.userId);
  await storeRefreshToken(payload.userId, rotatedRefreshToken);
  res.cookie("refreshToken", rotatedRefreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: 30 * 24 * 60 * 60 * 1000 });
  return res.status(200).json(new ApiResponse(200, "Token refreshed", { accessToken }));
});

const logout = asyncHandler(async (req, res) => {
  const refreshToken = readRefreshToken(req.headers.cookie);
  if (refreshToken) await prisma.refreshToken.deleteMany({ where: { tokenHash: hashToken(refreshToken) } });
  res.clearCookie("refreshToken", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" });
  return res.status(200).json(new ApiResponse(200, "Logged out", {}));
});

export { signup, login, refresh, logout };
