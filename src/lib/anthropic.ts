import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return cachedClient;
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenceMatch ? fenceMatch[1] : trimmed;
}

function simulateDelay(ms = 600): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface GenerateStructuredOptions<T> {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  mock: T;
}

interface GenerateStructuredResult<T> {
  data: T;
  source: "claude" | "mock";
}

/**
 * Calls Claude and validates its JSON response against `schema`.
 * Falls back to `mock` (no network call) when ANTHROPIC_API_KEY is unset,
 * so every mode is demoable without any setup.
 */
export async function generateStructured<T>({
  systemPrompt,
  userPrompt,
  schema,
  mock,
}: GenerateStructuredOptions<T>): Promise<GenerateStructuredResult<T>> {
  if (!process.env.ANTHROPIC_API_KEY) {
    await simulateDelay();
    return { data: mock, source: "mock" };
  }

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  if (!textBlock) {
    throw new Error("Claude returned no text content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(textBlock.text));
  } catch {
    throw new Error("Claude response was not valid JSON");
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Claude response failed schema validation: ${result.error.message}`);
  }

  return { data: result.data, source: "claude" };
}
