import { Router, type Response } from "express";
import { OpenRouterConfigError } from "../lib/openrouter.js";
import {
  createDecisions,
  JevUnavailableError,
} from "../services/jev/decisions.js";
import { evaluatePlatformContext } from "../services/jev/evaluatePlatformContext.js";
import type {
  JevQuestions,
  JevState,
  PlatformFacts,
} from "../services/jev/types.js";

export const jevRouter = Router();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function handleJevError(res: Response, err: unknown) {
  if (err instanceof OpenRouterConfigError) {
    return res
      .status(503)
      .json({ error: "jev_not_configured", detail: err.message });
  }
  if (err instanceof JevUnavailableError) {
    console.error("Jev request failed:", err.message, err.cause);
    return res
      .status(502)
      .json({ error: "jev_unavailable", detail: err.message });
  }
  console.error("Unexpected Jev error:", err);
  return res.status(500).json({ error: "internal_error" });
}

jevRouter.post("/jev/evaluate", async (req, res) => {
  const body = req.body as {
    state?: JevState;
    questions?: JevQuestions;
    model?: string;
  };

  if (body.state === undefined || body.state === null) {
    return res.status(400).json({ error: "missing_state" });
  }
  if (!body.questions || !isRecord(body.questions)) {
    return res.status(400).json({ error: "missing_questions" });
  }

  try {
    const result = await createDecisions({
      state: body.state,
      questions: body.questions,
      model: body.model,
    });
    return res.json({
      model: result.model,
      provider: result.provider,
      usage: result.usage,
      answers: result.answers,
    });
  } catch (err) {
    return handleJevError(res, err);
  }
});

function parsePlatformFacts(body: unknown): PlatformFacts | null {
  if (!isRecord(body)) return null;
  const required = [
    "accountAgeDays",
    "dailyRequests",
    "normalErrorRate",
    "currentErrorRate",
    "sdk",
  ] as const;
  for (const key of required) {
    if (body[key] === undefined) return null;
  }
  return {
    accountAgeDays: Number(body.accountAgeDays),
    dailyRequests: Number(body.dailyRequests),
    normalErrorRate: Number(body.normalErrorRate),
    currentErrorRate: Number(body.currentErrorRate),
    sdk: String(body.sdk),
    sdkVersion:
      body.sdkVersion !== undefined ? String(body.sdkVersion) : undefined,
    recentTicketText:
      body.recentTicketText !== undefined
        ? String(body.recentTicketText)
        : undefined,
  };
}

jevRouter.post("/context/evaluate", async (req, res) => {
  const facts = parsePlatformFacts(req.body);
  if (!facts || Number.isNaN(facts.accountAgeDays)) {
    return res.status(400).json({
      error: "invalid_facts",
      detail:
        "Required: accountAgeDays, dailyRequests, normalErrorRate, currentErrorRate, sdk",
    });
  }

  try {
    const result = await evaluatePlatformContext(facts);
    return res.json(result);
  } catch (err) {
    return handleJevError(res, err);
  }
});
