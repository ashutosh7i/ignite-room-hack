import { createDecisions } from "./decisions.js";
import { contextQuestions } from "./contextQuestions.js";
import type { NormalizedAnswers, PlatformFacts } from "./types.js";

export type EvaluatePlatformContextResult = {
  model: string;
  provider?: string;
  usage: {
    cost?: number;
    inputTokens: number;
    outputTokens: number;
  };
  facts: PlatformFacts;
  judgements: NormalizedAnswers;
};

export async function evaluatePlatformContext(
  facts: PlatformFacts,
): Promise<EvaluatePlatformContextResult> {
  const state = {
    platform_facts: facts,
    summary: [
      `SDK: ${facts.sdk}${facts.sdkVersion ? ` v${facts.sdkVersion}` : ""}`,
      `Account age: ${facts.accountAgeDays} days`,
      `Daily requests: ${facts.dailyRequests}`,
      `Error rate: ${facts.currentErrorRate} (normal ${facts.normalErrorRate})`,
      facts.recentTicketText
        ? `Recent ticket: ${facts.recentTicketText}`
        : null,
    ]
      .filter(Boolean)
      .join(" | "),
  };

  const result = await createDecisions({
    state,
    questions: contextQuestions,
  });

  return {
    model: result.model,
    provider: result.provider,
    usage: result.usage,
    facts,
    judgements: result.answers,
  };
}
