import type { UserContextDocument } from "../../types/context.js";

export type GroundedAnswerResult = {
  answer: string;
  sources: string[];
  structured?: unknown;
};

/** Strip heavy Jev payloads; keep what the agent needs for answers. */
export function compactContextForAgent(ctx: UserContextDocument) {
  return {
    identity: ctx.identity,
    facts: ctx.facts,
    usage: ctx.usage,
    behaviour: ctx.behaviour,
    support: ctx.support,
    evidence: ctx.evidence.map((e) => ({ text: e.text, source: e.source })),
    updatedAt: ctx.updatedAt,
  };
}

/** Instant answers from stored context — no LLM round-trip. */
export function tryGroundedAnswer(
  question: string,
  ctx: UserContextDocument,
  firstName: string,
  lastName: string,
): GroundedAnswerResult | null {
  const q = question.toLowerCase();

  if (
    q.includes("summar") ||
    q.includes("what do we know") ||
    q.includes("tell me about") ||
    q.includes("overview")
  ) {
    const evidence = ctx.evidence
      .slice(0, 5)
      .map((e) => e.text)
      .join(" ");
    return {
      answer: `${firstName} ${lastName}${ctx.identity.organization ? ` (${ctx.identity.organization})` : ""}: ${ctx.usage.maturity} maturity, usage health ${ctx.usage.health}. ${ctx.support.recommendedAction} Evidence: ${evidence}`,
      sources: ["user_context"],
    };
  }

  if (
    q.includes("why") ||
    q.includes("what happened") ||
    q.includes("failing") ||
    q.includes("fail") ||
    q.includes("broken") ||
    q.includes("error")
  ) {
    const lines = [
      `Current error rate ${(ctx.facts.currentErrorRate * 100).toFixed(1)}% vs normal ${(ctx.facts.historicalErrorRate * 100).toFixed(2)}% (${ctx.behaviour.errorSpikeLabel}).`,
      ctx.support.category
        ? `Likely issue: ${ctx.support.category.replace(/_/g, " ")}.`
        : null,
      ctx.behaviour.anomalyProbability != null
        ? `Behaviour anomaly: ${(ctx.behaviour.anomalyProbability * 100).toFixed(0)}%.`
        : null,
      ...ctx.evidence.slice(0, 4).map((e) => e.text),
    ].filter(Boolean);
    return {
      answer: lines.join(" "),
      sources: ["user_context", "facts"],
    };
  }

  if (
    q.includes("matur") ||
    q.includes("onboard") ||
    q.includes("production") ||
    q.includes("integration")
  ) {
    return {
      answer: `Maturity: ${ctx.usage.maturity} (${ctx.usage.maturityScore}). Account age ${ctx.facts.accountAgeDays} days; ${ctx.facts.dailyRequests.toLocaleString()} requests/day; API key ${ctx.facts.apiKeyConfigured ? "configured" : "missing"}.`,
      sources: ["user_context"],
    };
  }

  if (q.includes("health") || q.includes("status")) {
    return {
      answer: `Usage health: ${ctx.usage.health}. Escalation likelihood ${ctx.support.escalationProbability != null ? `${(ctx.support.escalationProbability * 100).toFixed(0)}%` : "unknown"}. ${ctx.support.recommendedAction}`,
      sources: ["user_context"],
    };
  }

  if (
    q.includes("in our database") ||
    q.includes("in the database") ||
    /^(?:are they|is this user)\s+in\b/.test(q)
  ) {
    return {
      answer: `Yes — ${firstName} ${lastName} is in the database${ctx.identity.organization ? ` (${ctx.identity.organization})` : ""}.`,
      sources: ["users"],
    };
  }

  return null;
}
