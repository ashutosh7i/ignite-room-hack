import { Router } from "express";
import { handleAgentQuery } from "../services/agent/queryAgent.js";

export const agentRouter = Router();

agentRouter.post("/agent/query", async (req, res) => {
  const { message, userId } = req.body as {
    message?: string;
    userId?: string;
  };
  if (!message?.trim()) {
    return res.status(400).json({ error: "missing_message" });
  }

  try {
    const serverStart = performance.now();
    const result = await handleAgentQuery(message, userId);
    const serverMs = Math.round(performance.now() - serverStart);
    res.json({
      ...result,
      timing: {
        ...result.timing,
        serverMs,
        grounded: result.timing?.grounded ?? false,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "agent_failed",
      detail: err instanceof Error ? err.message : "Unknown",
    });
  }
});
