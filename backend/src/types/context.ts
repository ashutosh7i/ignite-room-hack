export type ContextProvenance = "FACT" | "DERIVED" | "JEV";

export type UserContextDocument = {
  identity: {
    firstName: string;
    lastName: string;
    organization: string | null;
    jobTitle: string | null;
    github: string | null;
    linkedin: string | null;
  };
  facts: {
    accountAgeDays: number;
    dailyRequests: number;
    historicalErrorRate: number;
    currentErrorRate: number;
    errorRatio: number;
    apiKeyConfigured: boolean;
    configChangedRecently: boolean;
    sdk: string;
    sdkVersion: string | null;
    totalRequestsEver: number | null;
    features: string[];
  };
  usage: {
    maturity: string;
    maturityScore: number;
    health: string;
  };
  behaviour: {
    anomalyProbability: number | null;
    errorSpikeLabel: string;
  };
  support: {
    category: string | null;
    severity: string | null;
    escalationProbability: number | null;
    recommendedAction: string;
  };
  semantic: {
    status: "ok" | "unavailable";
    model?: string;
    judgements?: Record<string, unknown>;
  };
  evidence: Array<{ text: string; source: ContextProvenance }>;
  updatedAt: string;
};

export type SimilarUserResult = {
  userId: string;
  firstName: string;
  lastName: string;
  organization: string | null;
  similarity: number;
  summary: string;
};
