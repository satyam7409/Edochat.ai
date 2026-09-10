import dotenv from "dotenv";
dotenv.config(); // must be first so env vars are available everywhere

import express from "express";
import cors from "cors";
import { errorHandler } from "./middlewares/error.middleware";
import orgRoutes from "./route/org.routes";
import userRoutes from "./route/user.routes";
import assistantRoutes from "./route/assistant.routes";

const app = express();
const PORT = process.env.PORT;

// ── CORS — must be registered before all routes ───────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,                                   // allow cookies (refresh token)
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.status(200).json({ success: true, message: "EduChat API is healthy" });
});

app.use("/org", orgRoutes);
app.use("/user", userRoutes);
app.use("/org", assistantRoutes);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
