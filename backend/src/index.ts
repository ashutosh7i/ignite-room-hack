import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { prisma } from "./lib/prisma.js";

import { jevRouter } from "./routes/jev.js";
import { usersRouter } from "./routes/users.js";
import { supportRouter } from "./routes/support.js";
import { agentRouter } from "./routes/agent.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.use("/api", jevRouter);
app.use("/api", usersRouter);
app.use("/api", supportRouter);
app.use("/api", agentRouter);

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: "backend", db: "connected" });
  } catch {
    res.status(503).json({ ok: false, service: "backend", db: "error" });
  }
});

const server = app.listen(port, async () => {
  try {
    await prisma.$connect();
    console.log("Database connected");
  } catch (err) {
    console.error("Database connection failed:", err);
  }
  console.log(`Backend listening on http://localhost:${port}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
