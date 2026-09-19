import { Router } from "express";
import { handleAgentQuery } from "../services/agent/queryAgent.js";

export const agentRouter = Router();

agentRouter.post("/agent/query", async (req, res) => {
  const { message } = req.body as { message?: string };
  if (!message?.trim()) {
    return res.status(400).json({ error: "missing_message" });
  }

  try {
    const result = await handleAgentQuery(message);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "agent_failed",
      detail: err instanceof Error ? err.message : "Unknown",
    });
  }
});
