import type { DecisionsResponse } from "@openrouter/sdk/models/decisionsresponse.js";
import type { NormalizedAnswer, NormalizedAnswers } from "./types.js";

function normalizeOne(answer: DecisionsResponse["answers"][string]): NormalizedAnswer {
  if (answer.type === "noul") {
    return { type: "noul", noul: answer.noul };
  }
  if (answer.type === "choice") {
    return {
      type: "choice",
      choice: answer.choice,
      probabilities: answer.probabilities,
      confidence: answer.confidence,
    };
  }
  if (answer.type === "score") {
    return {
      type: "score",
      score: answer.score,
      probabilities: answer.probabilities,
      confidence: answer.confidence,
      legend: answer.legend,
    };
  }
  return { type: "unknown", raw: answer };
}

export function normalizeAnswers(
  answers: DecisionsResponse["answers"],
): NormalizedAnswers {
  const out: NormalizedAnswers = {};
  for (const [key, value] of Object.entries(answers)) {
    out[key] = normalizeOne(value);
  }
  return out;
}
