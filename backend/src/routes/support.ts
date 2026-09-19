import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import type { UserContextDocument } from "../types/context.js";

export const supportRouter = Router();

supportRouter.post("/support/analyze", async (req, res) => {
  const body = (req.body ?? {}) as {
    userIdA?: string;
    userIdB?: string;
  };
  const { userIdA, userIdB } = body;

  let userAId = userIdA;
  let userBId = userIdB;

  if (!userAId || !userBId) {
    const demos = await prisma.user.findMany({
      where: { demoRole: { in: ["A", "B"] } },
    });
    userAId = demos.find((d) => d.demoRole === "A")?.id;
    userBId = demos.find((d) => d.demoRole === "B")?.id;
  }

  if (!userAId || !userBId) {
    return res.status(404).json({ error: "demo_users_not_found" });
  }

  const [ctxA, ctxB, ticketA, ticketB] = await Promise.all([
    prisma.userContext.findUnique({ where: { userId: userAId } }),
    prisma.userContext.findUnique({ where: { userId: userBId } }),
    prisma.supportCase.findFirst({
      where: { userId: userAId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.supportCase.findFirst({
      where: { userId: userBId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  res.json({
    message: ticketA?.message ?? ticketB?.message ?? "My API has stopped working",
    userA: {
      userId: userAId,
      ticket: ticketA?.message,
      context: ctxA?.context as UserContextDocument | undefined,
    },
    userB: {
      userId: userBId,
      ticket: ticketB?.message,
      context: ctxB?.context as UserContextDocument | undefined,
    },
    headline: "Same message. Different context.",
  });
});
