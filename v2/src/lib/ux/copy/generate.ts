import { z } from "zod";
import { generateStructured, resolveLlmConfig } from "@/lib/ai/generate";
import type { ProviderClientConfig } from "@/lib/ai/providers";
import { evaluateDecisions, type DecisionContext } from "@/lib/decision-model/evaluate";
import { KNOWLEDGE_VERSIONS } from "@/lib/knowledge";
import { copyTextSchema, type CopyRun, type CopySlot, type CopyTarget, type CopyText, type PolicyOutcome, type UXState } from "@/lib/schemas";
import { draftCopy } from "@/lib/ux/copy/draft";
import { lintCopy } from "@/lib/ux/copy/lint";
import { buildRiskBatch, planCopy } from "@/lib/ux/copy/plan";

export const COPY_SYSTEM_PROMPT = `You write UI microcopy for a product designer.

The interaction requirements are already decided: which actions need a confirmation or an undo, which messages carry a count,
which states exist. You only write the words for the slots you are given — one string per slot, plus up to two alternatives.

Rules:
- Clear over clever. Active voice. Plain words. No filler.
- Follow the requested tone in every string.
- Respect each slot's character limit and every guideline listed with it.
- Keep placeholders exactly as written: {count}, {amount}, {name}.
- Never add slots, and never change what an action does.

Return JSON only:
{ "copy": { "<slot id>": { "text": string, "alternatives": [string] } }, "toneNotes": string }`;

export function buildCopyUserPrompt(state: UXState, targets: readonly CopyTarget[], slots: readonly CopySlot[], tone: string): string {
  const lines = [
    `PRODUCT: ${state.product} — ${state.summary}`,
    `USERS: ${state.user.role} (${state.user.expertise}). ${state.user.description}`,
    `THE THING THEY WORK WITH: ${state.data.entity}`,
    `TONE: ${tone}`,
    "",
  ];
  for (const t of targets) {
    lines.push(t.kind === "action" ? `ACTION "${t.name}": ${t.description}` : `SCREEN "${t.name}"`);
    for (const r of t.requirements) lines.push(`  - ${r}`);
    for (const s of slots.filter((x) => x.target === t.id)) {
      lines.push(`  SLOT ${s.id} — ${s.label}, at most ${s.maxChars} characters`);
      for (const g of s.guidance) lines.push(`      · ${g}`);
    }
    lines.push("");
  }
  lines.push("Write the copy as JSON.");
  return lines.join("\n");
}

/** Every slot required; hard guideline failures fail validation, so the model is retried. */
export function buildCopySchema(targets: readonly CopyTarget[], slots: readonly CopySlot[]) {
  const shape = Object.fromEntries(slots.map((s) => [s.id, copyTextSchema]));
  return z
    .object({ copy: z.object(shape), toneNotes: z.string().optional() })
    .superRefine((o, ctx) => {
      for (const issue of lintCopy(slots, o.copy as Record<string, CopyText>, targets)) {
        if (issue.severity === "error") ctx.addIssue({ code: "custom", path: ["copy", issue.slotId], message: `${issue.code}: ${issue.message}` });
      }
    });
}

export interface CopyInput {
  state: UXState;
  outcome: PolicyOutcome;
  tone: string;
  ctx: DecisionContext;
  clientConfig?: ProviderClientConfig;
  decide?: typeof evaluateDecisions;
  generate?: typeof generateStructured;
  id?: string;
  now?: Date;
}

/** Action risk (one decision-model request) → policy plans the slots → LLM or template writes → lint. */
export async function generateCopy({
  state,
  outcome,
  tone,
  ctx,
  clientConfig,
  decide = evaluateDecisions,
  generate = generateStructured,
  id = crypto.randomUUID(),
  now = new Date(),
}: CopyInput): Promise<CopyRun> {
  const batch = buildRiskBatch(state);
  const run =
    batch.questions.length > 0
      ? await decide(batch.state, batch.questions, ctx)
      : { results: [], provider: "mock" as const, model: "none", notices: [] };
  const { targets, slots } = planCopy(state, outcome, run.results);
  const notices = [...run.notices];

  let copy: Record<string, CopyText>;
  let toneNotes: string | undefined;
  let source: CopyRun["source"];
  let model: string;
  if (resolveLlmConfig(clientConfig)) {
    const result = await generate({
      systemPrompt: COPY_SYSTEM_PROMPT,
      userPrompt: buildCopyUserPrompt(state, targets, slots, tone),
      schema: buildCopySchema(targets, slots),
      clientConfig,
      maxTokens: 6000,
    });
    copy = result.data.copy as Record<string, CopyText>;
    toneNotes = result.data.toneNotes;
    source = "llm";
    model = `${result.source}:${result.model}`;
  } else {
    copy = draftCopy(state, outcome, targets, slots);
    source = "draft";
    model = "draft";
    notices.push("No LLM key is configured, so this is template copy that meets the requirements. Add a key in Settings for copy in your tone.");
  }

  return {
    id,
    generatedAt: now.toISOString(),
    tone,
    source,
    model,
    notices,
    decisionModel: { provider: run.provider, model: run.model },
    targets,
    slots,
    copy,
    ...(toneNotes ? { toneNotes } : {}),
    lint: lintCopy(slots, copy, targets),
    results: run.results,
    basedOn: outcome.decisions.map((d) => ({ decision: d.decision, choice: d.result.choice })),
    versions: { copyGuidelines: KNOWLEDGE_VERSIONS.copyGuidelines, prompts: KNOWLEDGE_VERSIONS.prompts, decisionModel: run.model },
  };
}
