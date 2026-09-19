import { OpenRouter } from "@openrouter/sdk";

let client: OpenRouter | undefined;

export function getOpenRouterClient(): OpenRouter {
  if (!client) {
    client = new OpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      httpReferer: process.env.OPENROUTER_HTTP_REFERER,
      appTitle: process.env.OPENROUTER_X_TITLE,
    });
  }
  return client;
}

export function getJevModel(): string {
  return process.env.JEV_MODEL ?? "typesafe/jev-1.13";
}

export function assertOpenRouterConfigured(): void {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new OpenRouterConfigError(
      "OPENROUTER_API_KEY is not configured. Add it to backend/.env",
    );
  }
}

export class OpenRouterConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenRouterConfigError";
  }
}
