import { prisma } from "../../lib/prisma.js";
import type { UserContextDocument } from "../../types/context.js";
import type { NormalizedAnswers } from "../jev/types.js";

function getNoul(j: NormalizedAnswers, key: string): number | null {
  const a = j[key];
  if (a && a.type === "noul" && "noul" in a) return a.noul;
  return null;
}

function getChoice(j: NormalizedAnswers, key: string): string | null {
  const a = j[key];
  if (a && a.type === "choice" && "choice" in a) return a.choice;
  return null;
}

function getScore(j: NormalizedAnswers, key: string): number | null {
  const a = j[key];
  if (a && a.type === "score" && "score" in a) return a.score;
  return null;
}
import { JevUnavailableError } from "../jev/decisions.js";
import { evaluatePlatformContext } from "../jev/evaluatePlatformContext.js";
import { OpenRouterConfigError } from "../../lib/openrouter.js";
import {
  activityToPlatformFacts,
  computeErrorRatio,
  deriveHealth,
  deriveMaturity,
} from "./facts.js";

export async function buildContext(userId: string): Promise<UserContextDocument> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      activity: true,
      supportCases: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!user || !user.activity) {
    throw new Error("User or platform activity not found");
  }

  const recentTicket = user.supportCases[0]?.message;
  const platformFacts = activityToPlatformFacts(user.activity, recentTicket);
  const usageBase = deriveMaturity(
    platformFacts.accountAgeDays,
    platformFacts.dailyRequests,
  );
  let health = deriveHealth(user.activity.currentErrorRate);

  const evidence: UserContextDocument["evidence"] = [
    {
      text: `Account age: ${platformFacts.accountAgeDays} days`,
      source: "FACT",
    },
    {
      text: `Daily requests: ${platformFacts.dailyRequests.toLocaleString()}`,
      source: "FACT",
    },
    {
      text: `Error rate ${(platformFacts.currentErrorRate * 100).toFixed(1)}% vs normal ${(platformFacts.normalErrorRate * 100).toFixed(2)}%`,
      source: "FACT",
    },
    {
      text: `Error ratio ${platformFacts.errorRatio}x baseline`,
      source: "DERIVED",
    },
    {
      text: `API key configured: ${platformFacts.apiKeyConfigured ? "yes" : "no"}`,
      source: "FACT",
    },
  ];

  if (!platformFacts.configChangedRecently) {
    evidence.push({
      text: "No recent configuration change detected",
      source: "FACT",
    });
  }

  let semantic: UserContextDocument["semantic"] = { status: "unavailable" };
  let supportCategory: string | null = null;
  let severityLabel: string | null = null;
  let escalationProbability: number | null = null;
  let anomalyProbability: number | null = null;
  let recommendedAction =
    "Review platform activity and respond with standard troubleshooting.";

  try {
    const jev = await evaluatePlatformContext(platformFacts);
    semantic = {
      status: "ok",
      model: jev.model,
      judgements: jev.judgements,
    };

    anomalyProbability = getNoul(jev.judgements, "behaviour_anomaly");
    if (anomalyProbability !== null) {
      evidence.push({
        text: `Behaviour anomaly probability: ${(anomalyProbability * 100).toFixed(0)}%`,
        source: "JEV",
      });
    }

    supportCategory = getChoice(jev.judgements, "issue_type");
    if (supportCategory) {
      evidence.push({
        text: `Issue classification: ${supportCategory.replace(/_/g, " ")}`,
        source: "JEV",
      });
    }

    const severityScore = getScore(jev.judgements, "severity");
    if (severityScore !== null) {
      if (severityScore >= 1.5) severityLabel = "critical";
      else if (severityScore >= 0.75) severityLabel = "high";
      else if (severityScore >= 0.25) severityLabel = "medium";
      else severityLabel = "low";
      evidence.push({
        text: `Severity score: ${severityScore.toFixed(2)} (${severityLabel})`,
        source: "JEV",
      });
    }

    escalationProbability = getNoul(jev.judgements, "requires_escalation");
    if (escalationProbability !== null) {
      evidence.push({
        text: `Escalation likelihood: ${(escalationProbability * 100).toFixed(0)}%`,
        source: "JEV",
      });
    }

    if (escalationProbability !== null && escalationProbability > 0.7) {
      recommendedAction = "Escalate to engineering immediately.";
    } else if (supportCategory === "integration_misconfiguration") {
      recommendedAction = "Guide customer through onboarding / API key setup.";
    } else if (supportCategory === "onboarding_gap") {
      recommendedAction = "Provide onboarding documentation; do not escalate.";
    }

    if (health === "critical" || (anomalyProbability ?? 0) > 0.8) {
      health = "critical";
    }
  } catch (err) {
    if (
      !(err instanceof JevUnavailableError) &&
      !(err instanceof OpenRouterConfigError)
    ) {
      throw err;
    }
    semantic = { status: "unavailable" };
  }

  const doc: UserContextDocument = {
    identity: {
      firstName: user.firstName,
      lastName: user.lastName,
      organization: user.organization,
      jobTitle: user.jobTitle,
      github: user.github,
      linkedin: user.linkedin,
    },
    facts: {
      accountAgeDays: platformFacts.accountAgeDays,
      dailyRequests: platformFacts.dailyRequests,
      historicalErrorRate: platformFacts.normalErrorRate,
      currentErrorRate: platformFacts.currentErrorRate,
      errorRatio: platformFacts.errorRatio ?? computeErrorRatio(
        platformFacts.currentErrorRate,
        platformFacts.normalErrorRate,
      ),
      apiKeyConfigured: platformFacts.apiKeyConfigured ?? true,
      configChangedRecently: platformFacts.configChangedRecently ?? false,
      sdk: platformFacts.sdk,
      sdkVersion: platformFacts.sdkVersion ?? null,
      totalRequestsEver: user.activity.totalRequestsEver,
      features: Array.isArray(user.activity.features)
        ? (user.activity.features as string[])
        : [],
    },
    usage: {
      ...usageBase,
      health,
    },
    behaviour: {
      anomalyProbability,
      errorSpikeLabel:
        platformFacts.errorRatio && platformFacts.errorRatio > 10
          ? `${platformFacts.errorRatio}x spike`
          : "within normal range",
    },
    support: {
      category: supportCategory,
      severity: severityLabel,
      escalationProbability,
      recommendedAction,
    },
    semantic,
    evidence,
    updatedAt: new Date().toISOString(),
  };

  await prisma.userContext.upsert({
    where: { userId },
    create: { userId, context: doc as object },
    update: { context: doc as object },
  });

  return doc;
}
