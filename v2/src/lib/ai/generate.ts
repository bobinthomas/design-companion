import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import {
  PROVIDER_DEFAULT_MODELS,
  type Provider,
  type ProviderClientConfig,
} from "@/lib/ai/providers";

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
      ...(provider === "openrouter" ? { "X-Title": "Design Companion V2" } : {}),
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
  /** Canned data used when no provider is configured. Omit to fail instead. */
  mock?: T;
  clientConfig?: ProviderClientConfig;
  /** Total model calls allowed when output fails JSON/schema validation. */
  maxAttempts?: number;
}

interface GenerateStructuredResult<T> {
  data: T;
  source: Provider | "mock";
  /** The model actually called; "mock" for canned data. */
  model: string;
}

/**
 * Resolves the LLM to use, in order of precedence:
 * 1. A client-supplied key from the Settings screen (bring-your-own-key, per browser)
 * 2. A server-side ANTHROPIC_API_KEY env var (local dev convenience)
 * Returns undefined when neither is available.
 */
export function resolveLlmConfig(
  clientConfig?: ProviderClientConfig
): ProviderClientConfig | undefined {
  if (clientConfig?.apiKey?.trim()) return clientConfig;
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL,
    };
  }
  return undefined;
}

/**
 * Calls the resolved LLM and validates its JSON against `schema`, retrying
 * with the validation error. With no LLM configured, returns `mock` so every
 * feature still works with zero setup — or throws if no mock was given.
 */
export async function generateStructured<T>({
  systemPrompt,
  userPrompt,
  schema,
  mock,
  clientConfig,
  maxAttempts = 2,
}: GenerateStructuredOptions<T>): Promise<GenerateStructuredResult<T>> {
  const config = resolveLlmConfig(clientConfig);

  if (!config) {
    if (mock === undefined) {
      throw new Error("No LLM provider is configured");
    }
    await simulateDelay();
    return { data: mock, source: "mock", model: "mock" };
  }
  const model = config.model?.trim() || PROVIDER_DEFAULT_MODELS[config.provider];

  let prompt = userPrompt;
  let lastError = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const text = await callProvider(config, systemPrompt, prompt);
    const outcome = parseAndValidate(text, schema);
    if (outcome.ok) {
      return { data: outcome.data, source: config.provider, model };
    }
    lastError = outcome.error;
    // Feed the validation error back so the model can correct itself — e.g. a
    // component id that isn't in the registry, which the schema rejects.
    prompt = `${userPrompt}\n\nYour previous response was rejected: ${outcome.error.slice(0, 1500)}\nReturn corrected JSON only.`;
  }

  throw new Error(`Model response failed validation: ${lastError}`);
}

function parseAndValidate<T>(
  text: string,
  schema: z.ZodType<T>
): { ok: true; data: T } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(text));
  } catch {
    return { ok: false, error: "response was not valid JSON" };
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: `schema validation failed: ${result.error.message}` };
  }
  return { ok: true, data: result.data };
}
