import { prisma } from "../../lib/prisma.js";
import type { SimilarUserResult, UserContextDocument } from "../../types/context.js";

function scoreFromContext(
  ref: UserContextDocument,
  other: UserContextDocument,
): number {
  let score = 0;
  if (ref.facts.sdk === other.facts.sdk) score += 0.2;
  if (ref.facts.sdkVersion === other.facts.sdkVersion) score += 0.15;

  const refFeatures = new Set(ref.facts.features ?? []);
  const otherFeatures = other.facts.features ?? [];
  if (otherFeatures.some((f) => refFeatures.has(f))) score += 0.2;

  if (
    ref.support.category &&
    other.support.category &&
    ref.support.category === other.support.category
  ) {
    score += 0.2;
  }

  const refAnomaly = ref.behaviour.anomalyProbability ?? 0;
  const otherAnomaly = other.behaviour.anomalyProbability ?? 0;
  if (refAnomaly > 0.7 && otherAnomaly > 0.7) score += 0.15;

  if (ref.usage.maturity === other.usage.maturity) score += 0.1;

  return Math.min(1, score);
}

export async function findSimilarUsers(
  userId: string,
  limit = 5,
): Promise<SimilarUserResult[]> {
  const refRow = await prisma.userContext.findUnique({
    where: { userId },
    include: { user: { include: { activity: true } } },
  });
  if (!refRow) return [];

  const ref = refRow.context as unknown as UserContextDocument;
  const refSdk = refRow.user.activity?.sdk ?? ref.facts.sdk;
  const refAnomaly = ref.behaviour.anomalyProbability ?? 0;

  const all = await prisma.userContext.findMany({
    where: {
      NOT: { userId },
      user: {
        activity: {
          sdk: refSdk,
          ...(refAnomaly > 0.5
            ? { currentErrorRate: { gte: 0.05 } }
            : {}),
        },
      },
    },
    take: 120,
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          organization: true,
        },
      },
    },
  });

  const scored = all
    .map((row) => {
      const ctx = row.context as unknown as UserContextDocument;
      const similarity = scoreFromContext(ref, ctx);
      return {
        userId: row.user.id,
        firstName: row.user.firstName,
        lastName: row.user.lastName,
        organization: row.user.organization,
        similarity,
        summary: `${ctx.support.category ?? "unknown issue"} · ${ctx.usage.health} · ${ctx.behaviour.errorSpikeLabel}`,
      };
    })
    .filter((s) => s.similarity >= 0.35)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return scored;
}
