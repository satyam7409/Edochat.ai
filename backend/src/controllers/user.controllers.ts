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

async function storeRefreshToken(userId: string, refreshToken: string) {
  const tokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");
  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
}

const signup = asyncHandler(async (req, res) => {
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

export { signup, login };
