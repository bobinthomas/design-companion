import type { ProviderClientConfig } from "@/lib/ai/providers";
import { PROVIDER_LABELS } from "@/lib/ai/providers";
import { resolveLlmConfig } from "@/lib/ai/generate";
import { JevProvider, type AiBinding } from "@/lib/decision-model/adapters/jev";
import { LlmDecisionProvider } from "@/lib/decision-model/adapters/llm";
import { MockDecisionProvider } from "@/lib/decision-model/adapters/mock";
import {
  assertResultsMatch,
  type DecisionProvider,
  type DecisionState,
} from "@/lib/decision-model/provider";
import {
  refundQuota,
  tryConsumeQuota,
  type QuotaStatus,
  type QuotaStore,
} from "@/lib/decision-model/quota";
import { POLICY } from "@/lib/knowledge";
import {
  decisionResultSchema,
  type DecisionProviderId,
  type DecisionQuestion,
  type DecisionResult,
} from "@/lib/schemas";

export interface CloudflareCredentials {
  accountId: string;
  apiToken: string;
}

export interface DecisionContext {
  /** Visitor's own Cloudflare account (Settings). Takes precedence; no quota. */
  cloudflare?: CloudflareCredentials;
  /** Visitor's BYOK LLM (Settings). */
  llm?: ProviderClientConfig;
  /** Worker bindings, when running on Cloudflare. */
  env: { AI?: AiBinding; JEV_QUOTA?: QuotaStore };
  /** Caller IP, for the shared-binding quota. */
  ip: string;
}

export interface DecisionRun {
  results: DecisionResult[];
  provider: DecisionProviderId;
  model: string;
  /** Human-readable explanations of any fallback that happened. */
  notices: string[];
  /** Present when the shared binding's quota was consulted. */
  quota?: QuotaStatus;
}

interface Candidate {
  label: string;
  /** Returns a provider to try, or a reason this candidate was skipped. */
  prepare(): Promise<DecisionProvider | { skip: string }>;
  /** Called if the prepared provider then fails, e.g. to refund quota. */
  onFailure?(): Promise<void>;
}

/**
 * Evaluates questions through the first available provider, in order:
 * visitor's Cloudflare token → shared Workers AI binding (within quota) →
 * visitor's LLM → deterministic mock. Any failure falls through to the next
 * provider with a visible notice; the mock never fails, so neither does this.
 */
export async function evaluateDecisions(
  state: DecisionState,
  questions: readonly DecisionQuestion[],
  ctx: DecisionContext
): Promise<DecisionRun> {
  const notices: string[] = [];
  let quota: QuotaStatus | undefined;
  const llmConfig = resolveLlmConfig(ctx.llm);

  const candidates: Candidate[] = [];

  if (ctx.cloudflare?.accountId && ctx.cloudflare.apiToken) {
    const creds = ctx.cloudflare;
    candidates.push({
      label: "Jev (your Cloudflare account)",
      prepare: async () =>
        new JevProvider({ kind: "rest", accountId: creds.accountId, apiToken: creds.apiToken }),
    });
  }

  const { AI, JEV_QUOTA } = ctx.env;
  if (AI) {
    candidates.push({
      label: "Jev",
      prepare: async () => {
        // Fail closed: without a quota store the shared binding is not used.
        if (!JEV_QUOTA) return { skip: "Shared Jev access isn't configured on this deployment." };
        const limit = POLICY.quota.jevRequestsPerIpPerDay;
        const consumed = await tryConsumeQuota(JEV_QUOTA, ctx.ip, limit);
        quota = consumed.status;
        if (!consumed.allowed) {
          return {
            skip: `You've used today's ${limit} free Jev analyses. Add your own Cloudflare token in Settings for unlimited use.`,
          };
        }
        return new JevProvider({ kind: "binding", ai: AI });
      },
      onFailure: async () => {
        quota = await refundQuota(JEV_QUOTA!, ctx.ip, POLICY.quota.jevRequestsPerIpPerDay);
      },
    });
  }

  if (llmConfig) {
    candidates.push({
      label: `your ${PROVIDER_LABELS[llmConfig.provider]} model`,
      prepare: async () => new LlmDecisionProvider(llmConfig),
    });
  }

  for (const candidate of candidates) {
    let provider: DecisionProvider | { skip: string };
    try {
      provider = await candidate.prepare();
    } catch (error) {
      notices.push(`${candidate.label} was unavailable (${messageOf(error)}).`);
      continue;
    }
    if ("skip" in provider) {
      notices.push(provider.skip);
      continue;
    }
    try {
      const results = validate(questions, await provider.evaluate(state, questions));
      if (notices.length > 0) notices.push(`Answered by ${candidate.label} instead.`);
      return { results, provider: provider.id, model: results[0]?.model ?? provider.id, notices, quota };
    } catch (error) {
      notices.push(`${candidate.label} failed (${messageOf(error)}).`);
      await candidate.onFailure?.().catch(() => undefined);
    }
  }

  const mock = new MockDecisionProvider();
  const results = validate(questions, await mock.evaluate(state, questions));
  notices.push(
    candidates.length > 0
      ? "Using demo judgments (keyword-based), not a real decision model."
      : "No decision model configured — using demo judgments (keyword-based)."
  );
  return { results, provider: "mock", model: results[0]?.model ?? "mock", notices, quota };
}

function validate(
  questions: readonly DecisionQuestion[],
  results: readonly DecisionResult[]
): DecisionResult[] {
  const parsed = results.map((r) => decisionResultSchema.parse(r));
  assertResultsMatch(questions, parsed);
  return parsed;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 200) : "unknown error";
}
