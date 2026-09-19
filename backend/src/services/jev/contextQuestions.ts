import type { JevQuestions } from "./types.js";

export const contextQuestions: JevQuestions = {
  behaviour_anomaly: {
    type: "noul",
    instructions:
      "Given platform usage facts, is the current error rate abnormally high compared to the historical normal error rate?",
    criteria: {
      true: "Clear spike or deviation beyond typical variance for a mature account",
      false: "Current error rate is in line with historical normal",
    },
  },
  issue_type: {
    type: "choice",
    instructions:
      "What best describes the most likely root cause of the customer's situation?",
    criteria: {
      probable_platform_regression:
        "Sudden degradation on mature production usage without client config changes",
      integration_misconfiguration:
        "Likely client-side misconfiguration, wrong credentials, or SDK misuse",
      onboarding_gap: "New account, low volume, or immature integration pattern",
      unknown: "Insufficient signal to classify confidently",
    },
  },
  severity: {
    type: "score",
    instructions: "How severe is the customer impact?",
    criteria: [
      "Low impact; cosmetic or minor inconvenience",
      "Medium impact; degraded service but workaround exists",
      "High impact; production blocking with revenue, SLA, or outage risk",
    ],
  },
  requires_escalation: {
    type: "noul",
    instructions:
      "Should this situation be escalated to engineering immediately?",
    criteria: {
      true: "High severity production issue needing urgent engineering attention",
      false: "Can be handled by support or standard troubleshooting",
    },
  },
};
