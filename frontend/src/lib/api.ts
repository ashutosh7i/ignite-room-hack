export type UserListItem = {
  id: string;
  firstName: string;
  lastName: string;
  organization: string | null;
  jobTitle: string | null;
  github: string | null;
  linkedin: string | null;
  demoRole: string | null;
  contextStatus: string;
  contextUpdatedAt: string | null;
};

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
  semantic: { status: string };
  evidence: Array<{ text: string; source: "FACT" | "DERIVED" | "JEV" }>;
  updatedAt: string;
};

export async function fetchUsers(search: string) {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  const res = await fetch(`/api/users${q}`);
  if (!res.ok) throw new Error("Failed to load users");
  return res.json() as Promise<{ users: UserListItem[] }>;
}

export async function fetchUserContext(userId: string) {
  const res = await fetch(`/api/users/${userId}/context`);
  if (!res.ok) throw new Error("Context not found");
  return res.json() as Promise<{ context: UserContextDocument }>;
}

export async function refreshContext(userId: string) {
  const res = await fetch(`/api/users/${userId}/context/refresh`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Refresh failed");
  return res.json() as Promise<{ context: UserContextDocument }>;
}

export async function simulateSpike(userId: string) {
  const res = await fetch(`/api/users/${userId}/simulate-spike`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Simulate failed");
  return res.json() as Promise<{ context: UserContextDocument }>;
}

export async function fetchSupportAnalyze() {
  const res = await fetch("/api/support/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) throw new Error("Analyze failed");
  return res.json();
}

export async function agentQuery(message: string, userId?: string) {
  const res = await fetch("/api/agent/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, userId }),
  });
  if (!res.ok) throw new Error("Agent failed");
  return res.json() as Promise<{ answer: string; sources: string[] }>;
}

export async function fetchSimilar(userId: string) {
  const res = await fetch(`/api/users/${userId}/similar`);
  if (!res.ok) throw new Error("Similar failed");
  return res.json();
}
