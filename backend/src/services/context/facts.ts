import type { PlatformActivity, SupportCase, User } from "@prisma/client";

export function computeAccountAgeDays(accountCreatedAt: Date): number {
  const ms = Date.now() - accountCreatedAt.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function computeErrorRatio(
  current: number,
  historical: number,
): number {
  const base = Math.max(historical, 0.0001);
  return Math.round((current / base) * 100) / 100;
}

export function configChangedRecently(
  lastConfigChangeAt: Date | null,
  withinDays = 7,
): boolean {
  if (!lastConfigChangeAt) return false;
  const ms = Date.now() - lastConfigChangeAt.getTime();
  return ms <= withinDays * 24 * 60 * 60 * 1000;
}

export function activityToPlatformFacts(
  activity: PlatformActivity,
  recentTicketText?: string,
) {
  const accountAgeDays = computeAccountAgeDays(activity.accountCreatedAt);
  const errorRatio = computeErrorRatio(
    activity.currentErrorRate,
    activity.historicalErrorRate,
  );

  return {
    accountAgeDays,
    dailyRequests: activity.dailyRequests,
    normalErrorRate: activity.historicalErrorRate,
    currentErrorRate: activity.currentErrorRate,
    sdk: activity.sdk,
    sdkVersion: activity.sdkVersion ?? undefined,
    recentTicketText,
    apiKeyConfigured: activity.apiKeyConfigured,
    configChangedRecently: configChangedRecently(activity.lastConfigChangeAt),
    errorRatio,
  };
}

export function deriveMaturity(accountAgeDays: number, dailyRequests: number) {
  if (accountAgeDays < 7 || dailyRequests < 100) {
    return { maturity: "onboarding", maturityScore: 0.15, health: "learning" };
  }
  if (accountAgeDays > 90 && dailyRequests > 10_000) {
    return { maturity: "production", maturityScore: 0.94, health: "stable" };
  }
  return { maturity: "growth", maturityScore: 0.55, health: "normal" };
}

export function deriveHealth(currentErrorRate: number): string {
  if (currentErrorRate >= 0.5) return "critical";
  if (currentErrorRate >= 0.05) return "degraded";
  return "normal";
}

export type UserWithActivity = User & {
  activity: PlatformActivity | null;
  supportCases: SupportCase[];
};
