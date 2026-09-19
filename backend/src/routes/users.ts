import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { buildContext } from "../services/context/buildContext.js";
import { findSimilarUsers } from "../services/context/similarUsers.js";
import type { UserContextDocument } from "../types/context.js";

export const usersRouter = Router();

usersRouter.get("/users", async (req, res) => {
  const search = String(req.query.search ?? "").trim();
  const users = await prisma.user.findMany({
    where: search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { organization: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    take: 50,
    orderBy: [{ demoRole: "asc" }, { firstName: "asc" }],
    include: {
      context: { select: { updatedAt: true } },
    },
  });

  res.json({
    users: users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      organization: u.organization,
      jobTitle: u.jobTitle,
      github: u.github,
      linkedin: u.linkedin,
      demoRole: u.demoRole,
      contextStatus: u.context ? "ready" : "pending",
      contextUpdatedAt: u.context?.updatedAt ?? null,
    })),
  });
});

usersRouter.get("/users/demo", async (_req, res) => {
  const demos = await prisma.user.findMany({
    where: { demoRole: { in: ["A", "B"] } },
    include: {
      supportCases: { orderBy: { createdAt: "desc" }, take: 1 },
      context: true,
    },
  });
  const a = demos.find((d) => d.demoRole === "A");
  const b = demos.find((d) => d.demoRole === "B");
  res.json({ userA: a, userB: b });
});

usersRouter.get("/users/:id", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: {
      activity: true,
      supportCases: { orderBy: { createdAt: "desc" }, take: 5 },
      context: true,
    },
  });
  if (!user) return res.status(404).json({ error: "not_found" });
  res.json({ user });
});

usersRouter.get("/users/:id/context", async (req, res) => {
  const row = await prisma.userContext.findUnique({
    where: { userId: req.params.id },
  });
  if (!row) {
    return res.status(404).json({ error: "context_not_found" });
  }
  res.json({
    userId: req.params.id,
    context: row.context as UserContextDocument,
    updatedAt: row.updatedAt,
  });
});

usersRouter.post("/users/:id/context/refresh", async (req, res) => {
  try {
    const context = await buildContext(req.params.id);
    res.json({ userId: req.params.id, context });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "context_build_failed",
      detail: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

usersRouter.post("/users/:id/simulate-spike", async (req, res) => {
  const activity = await prisma.platformActivity.findUnique({
    where: { userId: req.params.id },
  });
  if (!activity) return res.status(404).json({ error: "activity_not_found" });

  await prisma.platformActivity.update({
    where: { userId: req.params.id },
    data: {
      currentErrorRate: 0.87,
      historicalErrorRate: activity.historicalErrorRate || 0.003,
    },
  });

  const context = await buildContext(req.params.id);
  res.json({ userId: req.params.id, context, simulated: true });
});

usersRouter.get("/users/:id/similar", async (req, res) => {
  const similar = await findSimilarUsers(req.params.id, 8);
  res.json({ userId: req.params.id, similar });
});
