export type Provider = "anthropic" | "groq" | "openrouter";

export interface ProviderClientConfig {
  provider: Provider;
  apiKey: string;
  model?: string;
}

export const PROVIDERS: Provider[] = ["anthropic", "groq", "openrouter"];

export const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: "Anthropic",
  groq: "Groq",
  openrouter: "OpenRouter",
};

export const PROVIDER_DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: "claude-sonnet-5",
  groq: "llama-3.3-70b-versatile",
  openrouter: "openai/gpt-4o-mini",
};

export const PROVIDER_KEY_PLACEHOLDERS: Record<Provider, string> = {
  anthropic: "sk-ant-…",
  groq: "gsk_…",
  openrouter: "sk-or-…",
};

export const PROVIDER_CONSOLE_URLS: Record<Provider, string> = {
  anthropic: "https://console.anthropic.com/settings/keys",
  groq: "https://console.groq.com/keys",
  openrouter: "https://openrouter.ai/keys",
};

export function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && (PROVIDERS as string[]).includes(value);
}
