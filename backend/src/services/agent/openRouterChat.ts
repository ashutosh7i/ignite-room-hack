const CHAT_TIMEOUT_MS = 12_000;

export async function openRouterChatCompletion(input: {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  maxTokens?: number;
}): Promise<{ text: string; llmMs: number }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  const llmStart = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(process.env.OPENROUTER_HTTP_REFERER
          ? { "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER }
          : {}),
        ...(process.env.OPENROUTER_X_TITLE
          ? { "X-Title": process.env.OPENROUTER_X_TITLE }
          : {}),
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        max_tokens: input.maxTokens ?? 320,
        temperature: 0.2,
        stream: false,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenRouter chat ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | unknown } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    const text =
      typeof content === "string"
        ? content
        : "Unable to generate summary.";

    return { text, llmMs: Math.round(performance.now() - llmStart) };
  } finally {
    clearTimeout(timer);
  }
}
