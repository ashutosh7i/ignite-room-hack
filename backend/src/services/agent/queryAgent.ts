import { prisma } from "../../lib/prisma.js";
import type { UserContextDocument } from "../../types/context.js";
import {
  compactContextForAgent,
  tryGroundedAnswer,
} from "./groundedAnswer.js";
import { openRouterChatCompletion } from "./openRouterChat.js";
import { findSimilarUsers } from "../context/similarUsers.js";

const CHAT_MODEL = () =>
  process.env.CHAT_MODEL ?? "google/gemini-2.0-flash-001";

const USE_LLM =
  () => process.env.AGENT_USE_LLM !== "false";

export type AgentQueryResult = {
  answer: string;
  sources: string[];
  structured?: unknown;
  timing?: {
    llmMs?: number;
    grounded?: boolean;
  };
};

export async function handleAgentQuery(
  message: string,
  userId?: string,
): Promise<AgentQueryResult> {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { context: true },
    });
    if (!user) {
      return { answer: "User not found.", sources: ["users"] };
    }

    const ctx = user.context?.context as UserContextDocument | undefined;
    if (!ctx) {
      return {
        answer: `${user.firstName} ${user.lastName} has no context yet. Use Refresh context first.`,
        sources: ["users"],
      };
    }

    if (lower.includes("similar") || lower.includes("same behaviour")) {
      const similar = await findSimilarUsers(userId, 6);
      return {
        answer:
          similar.length > 0
            ? `${similar.length} users with similar context. Top: ${similar[0].firstName} ${similar[0].lastName} (${(similar[0].similarity * 100).toFixed(0)}%).`
            : "No similar contexts found yet.",
        sources: ["user_context", "similarity"],
        structured: similar,
      };
    }

    if (lower.includes("escalat")) {
      const p = ctx.support.escalationProbability;
      return {
        answer:
          p !== null
            ? `Escalation probability is ${(p * 100).toFixed(0)}%. ${ctx.support.recommendedAction}`
            : ctx.support.recommendedAction,
        sources: ["user_context", "jev"],
        structured: ctx.support,
      };
    }

    const grounded = tryGroundedAnswer(trimmed, ctx, user.firstName, user.lastName);
    if (grounded) {
      return { ...grounded, timing: { grounded: true, llmMs: 0 } };
    }

    if (!USE_LLM()) {
      return {
        answer: `Structured context: health ${ctx.usage.health}, ${ctx.support.recommendedAction}`,
        sources: ["user_context"],
        structured: compactContextForAgent(ctx),
      };
    }

    return summarizeWithLlm(trimmed, ctx, user.firstName, user.lastName);
  }

  const nameMatch = trimmed.match(
    /(?:is|about|know about|find)\s+([a-z][a-z\s'-]{1,40}?)(?:\s+in|\?|$|\.)/i,
  );
  const searchName = nameMatch?.[1]?.trim();

  if (lower.includes("similar") || lower.includes("same behaviour")) {
    const demoB = await prisma.user.findFirst({ where: { demoRole: "B" } });
    if (!demoB) {
      return { answer: "No reference user found.", sources: [] };
    }
    const similar = await findSimilarUsers(demoB.id, 6);
    return {
      answer:
        similar.length > 0
          ? `${similar.length} users show similar context patterns (SDK, issue type, anomaly). Top match: ${similar[0].firstName} ${similar[0].lastName} at ${(similar[0].similarity * 100).toFixed(0)}% similarity.`
          : "No similar contexts found yet. Refresh contexts for more users.",
      sources: ["user_context", "similarity"],
      structured: similar,
    };
  }

  if (searchName) {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          {
            firstName: {
              contains: searchName.split(" ")[0],
              mode: "insensitive",
            },
          },
          {
            lastName: {
              contains: searchName.split(" ").pop() ?? "",
              mode: "insensitive",
            },
          },
        ],
      },
      take: 5,
      include: { context: true },
    });

    if (users.length === 0) {
      return {
        answer: `I could not find anyone matching "${searchName}" in the database.`,
        sources: ["users"],
      };
    }

    const user = users[0];
    const ctx = user.context?.context as UserContextDocument | undefined;

    if (lower.includes("in our database") || lower.includes("in the database")) {
      return {
        answer: `Yes — ${user.firstName} ${user.lastName} is in the database${user.organization ? ` (${user.organization})` : ""}.`,
        sources: ["users"],
        structured: { userId: user.id },
      };
    }

    if (!ctx) {
      return {
        answer: `${user.firstName} ${user.lastName} exists but context has not been built yet. Run context refresh.`,
        sources: ["users"],
      };
    }

    if (lower.includes("escalat")) {
      const p = ctx.support.escalationProbability;
      return {
        answer:
          p !== null
            ? `Escalation probability is ${(p * 100).toFixed(0)}%. Recommendation: ${ctx.support.recommendedAction}`
            : `Semantic escalation unavailable. Recommendation: ${ctx.support.recommendedAction}`,
        sources: ["user_context", "jev"],
        structured: ctx.support,
      };
    }

    const grounded = tryGroundedAnswer(trimmed, ctx, user.firstName, user.lastName);
    if (grounded) {
      return { ...grounded, timing: { grounded: true, llmMs: 0 } };
    }

    return summarizeWithLlm(trimmed, ctx, user.firstName, user.lastName);
  }

  return {
    answer:
      "Ask about a user by name, e.g. “What do we know about Ashwin?” or open a user profile to ask custom questions.",
    sources: [],
  };
}

async function summarizeWithLlm(
  question: string,
  context: UserContextDocument,
  firstName: string,
  lastName: string,
): Promise<AgentQueryResult> {
  const compact = compactContextForAgent(context);
  const payload = JSON.stringify(compact);

  if (!process.env.OPENROUTER_API_KEY) {
    return {
      answer: "LLM unavailable. Here is structured context only.",
      sources: ["user_context"],
      structured: compact,
    };
  }

  try {
    const { text, llmMs } = await openRouterChatCompletion({
      model: CHAT_MODEL(),
      messages: [
        {
          role: "system",
          content:
            "You are EnSight support intelligence. Answer ONLY from the JSON context. Max 3 short sentences. If unknown, say so.",
        },
        {
          role: "user",
          content: `Question: ${question}\nUser: ${firstName} ${lastName}\nContext:\n${payload}`,
        },
      ],
    });

    return {
      answer: text,
      sources: ["user_context", "llm"],
      structured: compact,
      timing: { llmMs },
    };
  } catch (err) {
    console.error("LLM error:", err);
    const fallback = tryGroundedAnswer(question, context, firstName, lastName);
    if (fallback) {
      return { ...fallback, timing: { grounded: true, llmMs: 0 } };
    }
    return {
      answer:
        "Language model timed out or failed. See structured context on this page.",
      sources: ["user_context"],
      structured: compact,
    };
  }
}
