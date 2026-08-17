import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import {
  PROVIDER_DEFAULT_MODELS,
  type Provider,
  type ProviderClientConfig,
} from "@/lib/providers";

const OPENAI_COMPATIBLE_BASE_URLS: Record<"groq" | "openrouter", string> = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
};

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenceMatch ? fenceMatch[1] : trimmed;
}

function simulateDelay(ms = 600): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  if (!textBlock) {
    throw new Error("Model returned no text content");
  }
  return textBlock.text;
}

async function callOpenAICompatible(
  provider: "groq" | "openrouter",
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const res = await fetch(OPENAI_COMPATIBLE_BASE_URLS[provider], {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(provider === "openrouter" ? { "X-Title": "Design Companion" } : {}),
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const authIssue = res.status === 401 || res.status === 403;
    throw new Error(
      authIssue
        ? "That API key was rejected. Check it in Settings and try again."
        : `${provider} request failed (${res.status}): ${detail.slice(0, 200)}`
    );
  }

  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = body.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("Model returned no text content");
  }
  return text;
}

async function callProvider(
  config: ProviderClientConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const model = config.model?.trim() || PROVIDER_DEFAULT_MODELS[config.provider];

  if (config.provider === "anthropic") {
    return callAnthropic(config.apiKey, model, systemPrompt, userPrompt);
  }
  return callOpenAICompatible(config.provider, config.apiKey, model, systemPrompt, userPrompt);
}

interface GenerateStructuredOptions<T> {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  mock: T;
  clientConfig?: ProviderClientConfig;
}

interface GenerateStructuredResult<T> {
  data: T;
  source: Provider | "mock";
}

/**
 * Resolves a provider to call, in order of precedence:
 * 1. A client-supplied key from the Settings screen (bring-your-own-key, per browser)
 * 2. A server-side ANTHROPIC_API_KEY env var (local dev convenience)
 * 3. Canned mock data, so every mode still works with zero setup
 */
export async function generateStructured<T>({
  systemPrompt,
  userPrompt,
  schema,
  mock,
  clientConfig,
}: GenerateStructuredOptions<T>): Promise<GenerateStructuredResult<T>> {
  const config: ProviderClientConfig | undefined =
    clientConfig?.apiKey?.trim()
      ? clientConfig
      : process.env.ANTHROPIC_API_KEY
        ? {
            provider: "anthropic",
            apiKey: process.env.ANTHROPIC_API_KEY,
            model: process.env.ANTHROPIC_MODEL,
          }
        : undefined;

  if (!config) {
    await simulateDelay();
    return { data: mock, source: "mock" };
  }

  const text = await callProvider(config, systemPrompt, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(text));
  } catch {
    throw new Error("Model response was not valid JSON");
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Model response failed schema validation: ${result.error.message}`);
  }

  return { data: result.data, source: config.provider };
}
