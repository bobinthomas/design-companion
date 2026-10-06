import { generateStructured, resolveLlmConfig } from "@/lib/ai/generate";
import type { ProviderClientConfig } from "@/lib/ai/providers";
import type { DecisionContext } from "@/lib/decision-model/evaluate";
import { CAPABILITY_BY_ID, UX_PATTERNS } from "@/lib/knowledge";
import { buildGenerationSchema, generationOutputSchema, type DesignSystem, type GenerationOutput, type PolicyOutcome, type UXState } from "@/lib/schemas";
import { analyzeState } from "@/lib/ux/analyze";
import { generateLayouts } from "@/lib/ux/layouts/generate";
import { extractState } from "@/lib/ux/state/extract";

/**
 * PRD §40: the three systems compared. Each arm turns the same brief into
 * layout directions in the same output shape, so the same metrics and the
 * same evaluator apply to all three.
 *
 *   A — LLM only:              brief → LLM → directions
 *   B — LLM + design system:   brief + component catalogue → LLM (registry-constrained) → directions
 *   C — decision-guided:       brief → state → decision model → policy → design system → LLM → directions
 */

export type ArmId = "A" | "B" | "C";

export const ARM_LABELS: Record<ArmId, string> = {
  A: "LLM only",
  B: "LLM + design system",
  C: "Decision-guided",
};

export interface ArmOutput {
  output: GenerationOutput;
  /** C only: the state and policy outcome it generated from. */
  state?: UXState;
  outcome?: PolicyOutcome;
  model: string;
}

export interface ArmDeps {
  clientConfig?: ProviderClientConfig;
  ctx: DecisionContext;
  designSystem: DesignSystem;
  generate?: typeof generateStructured;
  /** Used by C when no LLM is configured (the demo state for the brief). */
  fallbackState?: UXState;
}

const SHAPE = `Return JSON only:
{
  "variants": [ { "id": "kebab-case", "title": string, "strategy": string, "summary": string, "rationale": string,
      "pattern": "kebab-case (optional)", "supportingDecisions": [], "rulesApplied": [],
      "regions": [ { "name": string, "purpose": string,
                     "components": [ { "component": "kebab-case-id", "purpose": string, "states": ["loading" | "empty" | "error" | …] } ] } ],
      "advantages": [string], "tradeoffs": [string], "mobileNotes": [string], "desktopNotes": [string] } ],
  "assumptions": [string]
}`;

export const ARM_A_PROMPT = `You are a product designer's assistant. Given a brief, propose 2 or 3 genuinely distinct layout directions for the screen.
Describe each as regions (top to bottom) built from UI components. Name components in kebab-case (e.g. "data-table", "button").
List the states each component must show where they matter. Leave "supportingDecisions" and "rulesApplied" empty.
${SHAPE}`;

export const ARM_B_PROMPT = `You are a product designer's assistant. Given a brief and the team's design system, propose 2 or 3 genuinely distinct
layout directions for the screen, using ONLY components from the design system (by id).
Describe each as regions (top to bottom). List the states each component must show where they matter.
Leave "supportingDecisions" and "rulesApplied" empty.
${SHAPE}`;

function catalogue(ds: DesignSystem): string {
  return ds.components
    .map((c) => `- ${c.id} "${c.name}": ${c.capabilities.map((k) => CAPABILITY_BY_ID.get(k.capability)?.name ?? k.capability).join(", ") || "no declared capabilities"}`)
    .join("\n");
}

export async function runArm(arm: ArmId, brief: string, deps: ArmDeps): Promise<ArmOutput> {
  const generate = deps.generate ?? generateStructured;

  if (arm === "A") {
    const r = await generate({
      systemPrompt: ARM_A_PROMPT,
      userPrompt: `Brief:\n"""\n${brief}\n"""`,
      schema: generationOutputSchema,
      clientConfig: deps.clientConfig,
      maxTokens: 8192,
    });
    return { output: r.data, model: `${r.source}:${r.model}` };
  }

  if (arm === "B") {
    const schema = buildGenerationSchema({
      patternIds: UX_PATTERNS.map((p) => p.id),
      componentIds: deps.designSystem.components.map((c) => c.id),
      ruleIds: [],
      gapIds: [],
    });
    const r = await generate({
      systemPrompt: ARM_B_PROMPT,
      userPrompt: `Brief:\n"""\n${brief}\n"""\n\nDesign system "${deps.designSystem.name}" ${deps.designSystem.version}:\n${catalogue(deps.designSystem)}`,
      schema,
      clientConfig: deps.clientConfig,
      maxTokens: 8192,
    });
    return { output: r.data, model: `${r.source}:${r.model}` };
  }

  // C — the full V2 pipeline, as the product runs it.
  const hasLlm = Boolean(resolveLlmConfig(deps.clientConfig));
  const state = hasLlm ? (await extractState(brief, deps.clientConfig, generate)).state : deps.fallbackState;
  if (!state) throw new Error("Arm C needs an LLM or a fallback state for this brief.");
  const analysis = await analyzeState({ state, overrides: [], gapSettlements: [], designSystem: deps.designSystem, ctx: deps.ctx });
  const { state: _s, questions: _q, results: _r, decisionModel: _d, ...outcome } = analysis;
  const layouts = await generateLayouts({ state, outcome, clientConfig: deps.clientConfig, generate });
  return { output: layouts.output, state, outcome, model: layouts.model };
}
