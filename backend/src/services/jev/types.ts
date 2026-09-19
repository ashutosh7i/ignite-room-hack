import type { DecisionsRequest } from "@openrouter/sdk/models/decisionsrequest.js";

export type JevQuestions = DecisionsRequest["questions"];

export type JevState = DecisionsRequest["state"];

export type PlatformFacts = {
  accountAgeDays: number;
  dailyRequests: number;
  normalErrorRate: number;
  currentErrorRate: number;
  sdk: string;
  sdkVersion?: string;
  recentTicketText?: string;
};

export type NormalizedNoulAnswer = {
  type: "noul";
  noul: number;
};

export type NormalizedChoiceAnswer = {
  type: "choice";
  choice: string;
  probabilities?: Record<string, number>;
  confidence?: number;
};

export type NormalizedScoreAnswer = {
  type: "score";
  score: number;
  probabilities?: Record<string, number>;
  confidence?: number;
  legend?: Record<string, string | Record<string, unknown> | unknown[]>;
};

export type NormalizedAnswer =
  | NormalizedNoulAnswer
  | NormalizedChoiceAnswer
  | NormalizedScoreAnswer
  | { type: string; raw: unknown };

export type NormalizedAnswers = Record<string, NormalizedAnswer>;
