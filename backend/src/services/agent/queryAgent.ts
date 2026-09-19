import { getOpenRouterClient } from "../../lib/openrouter.js";
import type { ChatResult } from "@openrouter/sdk/models/chatresult.js";
import { prisma } from "../../lib/prisma.js";
import type { UserContextDocument } from "../../types/context.js";
import { findSimilarUsers } from "../context/similarUsers.js";

const CHAT_MODEL = () =>
  process.env.CHAT_MODEL ?? "google/gemini-2.0-flash-001";

export async function handleAgentQuery(
  message: string,
  userId?: string,
): Promise<{
  answer: string;
  sources: string[];
  structured?: unknown;
}> {
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

    if (lower.includes("in our database") || /^is\s+/i.test(trimmed)) {
      return {
        answer: `Yes — ${user.firstName} ${user.lastName} is in the database${user.organization ? ` (${user.organization})` : ""}.`,
        sources: ["users"],
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
          { firstName: { contains: searchName.split(" ")[0], mode: "insensitive" } },
          { lastName: { contains: searchName.split(" ").pop() ?? "", mode: "insensitive" } },
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
    if (lower.startsWith("is ") || lower.includes("in our database")) {
      return {
        answer: `Yes — ${user.firstName} ${user.lastName} is in the database${user.organization ? ` (${user.organization})` : ""}.`,
        sources: ["users"],
        structured: { userId: user.id },
      };
    }

    const ctx = user.context?.context as UserContextDocument | undefined;
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

    return summarizeWithLlm(trimmed, ctx, user.firstName, user.lastName);
  }

  return {
    answer:
      "Ask about a user by name, e.g. “What do we know about Ashwin?” or “Are other users showing similar behaviour?”",
    sources: [],
  };
}

async function summarizeWithLlm(
  question: string,
  context: UserContextDocument | UserContextDocument[] | unknown,
  firstName: string,
  lastName: string,
): Promise<{ answer: string; sources: string[]; structured?: unknown }> {
  const payload = JSON.stringify(context, null, 2);

  if (!process.env.OPENROUTER_API_KEY) {
    return {
      answer: "LLM unavailable. Here is structured context only.",
      sources: ["user_context"],
      structured: context,
    };
  }

  try {
    const client = getOpenRouterClient();
    const raw = await client.chat.send({
      httpReferer: process.env.OPENROUTER_HTTP_REFERER,
      appTitle: process.env.OPENROUTER_X_TITLE,
      chatRequest: {
        model: CHAT_MODEL(),
        messages: [
          {
            role: "system",
            content:
              "You are EnSight support intelligence. Answer ONLY from the provided JSON context and evidence. If unknown, say so. Be concise.",
          },
          {
            role: "user",
            content: `Question: ${question}\n\nUser: ${firstName} ${lastName}\n\nContext JSON:\n${payload}`,
          },
        ],
        stream: false,
      },
    });

    const result = raw as ChatResult;

    const choice = result.choices?.[0];
    const content = choice?.message?.content;
    const text =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content
              .map((p) => ("text" in p ? p.text : ""))
              .join("")
          : "Unable to generate summary.";

    return {
      answer: text,
      sources: ["user_context", "llm"],
      structured: context,
    };
  } catch (err) {
    console.error("LLM error:", err);
    return {
      answer:
        "Language model unavailable. Use structured context below.",
      sources: ["user_context"],
      structured: context,
    };
  }
}
