import type { DecisionsResponse } from "@openrouter/sdk/models/decisionsresponse.js";
import {
  assertOpenRouterConfigured,
  getJevModel,
  getOpenRouterClient,
  OpenRouterConfigError,
} from "../../lib/openrouter.js";
import { normalizeAnswers } from "./normalizeAnswers.js";
import type { JevQuestions, JevState, NormalizedAnswers } from "./types.js";

const DECISIONS_TIMEOUT_MS = 15_000;

export class JevUnavailableError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "JevUnavailableError";
  }
}

export type CreateDecisionsResult = {
  model: string;
  provider?: string;
  usage: DecisionsResponse["usage"];
  answers: NormalizedAnswers;
  rawAnswers: DecisionsResponse["answers"];
};

export async function createDecisions(input: {
  state: JevState;
  questions: JevQuestions;
  model?: string;
}): Promise<CreateDecisionsResult> {
  assertOpenRouterConfigured();

  const client = getOpenRouterClient();
  const model = input.model ?? getJevModel();

  try {
    const response = await client.alpha.decisions.create(
      {
        httpReferer: process.env.OPENROUTER_HTTP_REFERER,
        appTitle: process.env.OPENROUTER_X_TITLE,
        decisionsRequest: {
          model,
          state: input.state,
          questions: input.questions,
        },
      },
      { timeoutMs: DECISIONS_TIMEOUT_MS },
    );

    return {
      model: response.model,
      provider: response.provider,
      usage: response.usage,
      answers: normalizeAnswers(response.answers),
      rawAnswers: response.answers,
    };
  } catch (err) {
    if (err instanceof OpenRouterConfigError) {
      throw err;
    }
    const detail = err instanceof Error ? err.message : "Unknown error";
    throw new JevUnavailableError(detail, err);
  }
}
