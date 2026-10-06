"use client";

import { loadCloudflareSettings, loadSettings } from "@/lib/ai/clientSettings";
import type { AnalysisResponse } from "@/lib/ux/analyze";
import type { StateExtraction } from "@/lib/ux/state/extract";
import type { AnalysisSession } from "@/lib/session/session";
import type { LayoutBrainstorm } from "@/lib/schemas";

/** Credentials saved in Settings, attached to every request that may use them. */
function credentials() {
  const llm = loadSettings();
  const cloudflare = loadCloudflareSettings();
  return {
    ...(llm ? { clientConfig: llm } : {}),
    ...(cloudflare ? { cloudflare } : {}),
  };
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const issue = data?.issues?.[0];
    throw new Error(issue ? `${issue.path}: ${issue.message}` : (data?.error ?? `Request failed (${res.status})`));
  }
  return data as T;
}

export function requestState(brief: string): Promise<StateExtraction> {
  const { clientConfig } = credentials();
  return postJson("/api/ux/state", { brief, ...(clientConfig ? { clientConfig } : {}) });
}

/**
 * Runs policy for the session (reusing earlier decision-model results unless
 * `fresh` asks for new judgments) and splits the response into the parts a
 * session stores.
 */
export async function requestAnalysis(session: AnalysisSession, fresh: boolean) {
  const a = await postJson<AnalysisResponse>("/api/ux/decide", {
    ...credentials(),
    state: session.state,
    ...(fresh || !session.results ? {} : { results: session.results }),
    overrides: session.overrides,
    gapSettlements: session.gapSettlements,
  });
  return {
    results: a.results,
    decisionModel: { provider: a.decisionModel.provider, model: a.decisionModel.model, notices: a.decisionModel.notices },
    outcome: {
      decisions: a.decisions,
      requirements: a.requirements,
      requiredStates: a.requiredStates,
      patterns: a.patterns,
      components: a.components,
      resolutions: a.resolutions,
      gaps: a.gaps,
      blocked: a.blocked,
      warnings: a.warnings,
      rulesFired: a.rulesFired,
      versions: a.versions,
    },
  };
}

/** PRD §23: directions for the session's current decisions. Policy is re-run on the server, never trusted from here. */
export function requestLayouts(session: AnalysisSession, instruction?: string): Promise<LayoutBrainstorm> {
  const { clientConfig } = credentials();
  return postJson("/api/ux/layouts", {
    ...(clientConfig ? { clientConfig } : {}),
    state: session.state,
    results: session.results,
    overrides: session.overrides,
    gapSettlements: session.gapSettlements,
    ...(instruction?.trim() ? { instruction: instruction.trim() } : {}),
  });
}
