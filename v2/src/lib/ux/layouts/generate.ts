import { generateStructured, resolveLlmConfig } from "@/lib/ai/generate";
import type { ProviderClientConfig } from "@/lib/ai/providers";
import { CAPABILITY_BY_ID, KNOWLEDGE_VERSIONS, UX_RULES } from "@/lib/knowledge";
import {
  buildGenerationSchema,
  type GenerationOutput,
  type GenerationVocabulary,
  type LayoutBrainstorm,
  type PolicyOutcome,
  type UXState,
} from "@/lib/schemas";
import { checkDirections } from "@/lib/ux/layouts/checks";
import { composeDirections } from "@/lib/ux/layouts/compose";

/**
 * PRD §22–23 Layout Brainstorm V2. The LLM explores the valid solution
 * space; it doesn't define it. Policy has already decided the structure,
 * the registry has already chosen the components, and gap detection has
 * already said what's missing — all of it reaches the model as a
 * per-request schema, so a direction that invents a component, cites an
 * undecided slot or hides a net-new gap fails validation and is retried.
 */

export class GenerationBlockedError extends Error {
  constructor(readonly gaps: { id: string; capability: string }[]) {
    super(
      `Generation is blocked by ${gaps.length === 1 ? "a critical design-system gap" : `${gaps.length} critical design-system gaps`}: ${gaps
        .map((g) => g.capability)
        .join(", ")}. Resolve or accept ${gaps.length === 1 ? "it" : "them"}, or override the decision that needs ${gaps.length === 1 ? "it" : "them"}.`
    );
  }
}

/** What a generator may reference for this outcome, and what it must show. */
export function generationVocabulary(outcome: PolicyOutcome): GenerationVocabulary {
  const usable = outcome.gaps.filter((g) => g.behavior !== "block");
  return {
    patternIds: outcome.patterns.map((p) => p.pattern),
    componentIds: outcome.components.map((c) => c.component),
    ruleIds: [...new Set(outcome.rulesFired.map((r) => r.ruleId))],
    gapIds: usable.map((g) => g.id),
    decisionSlots: outcome.decisions.map((d) => d.decision),
    requiredGapIds: usable.filter((g) => g.behavior === "mark-net-new").map((g) => g.id),
  };
}

export const LAYOUT_SYSTEM_PROMPT = `You are the generation layer of a decision-guided UX system. You propose layout directions for a product designer.

The UX decisions, patterns, components and design-system gaps you are given were already decided by UX policy and the designer. You explore the space they define. You do not reopen it.

Rules:
- Return 2 or 3 genuinely distinct directions, each with a different organizing strategy suited to this problem
  (for example "Task first", "Exception first", "Overview first", "Focus first", "Guidance first"). Different
  hierarchy or emphasis — not the same regions reordered with new names.
- Every direction must respect every decision. Never use an option the decisions ruled out or didn't choose.
- Use ONLY the component ids listed. Never invent or rename a component.
- Where a needed capability is a design-system gap, use a placeholder { "gap": "<gap id>", "purpose": "..." } instead of a component.
  Every gap marked NET-NEW REQUIRED must appear as a placeholder in EVERY direction.
- "pattern" must be one of the listed pattern ids. "supportingDecisions" may only list decided slots.
  "rulesApplied" may only list the rule ids given.
- List the states each component must show ("states") where they matter: loading, empty, error, success and so on.
- Write rationale, advantages and trade-offs in plain designer language, specific to this problem.
- Do not score or rate the directions; confidence and evaluation are computed separately.
- Record any assumption you make in "assumptions".

Return JSON only:
{
  "variants": [
    {
      "id": "kebab-case-id",
      "title": string,
      "strategy": string,
      "summary": string,
      "rationale": string,
      "pattern": "<pattern id>",
      "supportingDecisions": ["<decided slot>"],
      "regions": [
        { "name": string, "purpose": string,
          "components": [ { "component": "<component id>", "variant"?: string, "purpose": string, "states": ["<state>"] }
                        | { "gap": "<gap id>", "purpose": string } ] }
      ],
      "advantages": [string],
      "tradeoffs": [string],
      "rulesApplied": ["<rule id>"],
      "mobileNotes": [string],
      "desktopNotes": [string]
    }
  ],
  "assumptions": [string]
}`;

const GAP_BEHAVIOR_TEXT: Record<string, string> = {
  "mark-net-new": "NET-NEW REQUIRED",
  warn: "warning (show a placeholder if you use it)",
  none: "accepted by the designer (show a placeholder if you use it)",
};

export function buildLayoutUserPrompt(state: UXState, outcome: PolicyOutcome, instruction?: string): string {
  const ruleReason = new Map(UX_RULES.map((r) => [r.id, r.reason]));
  const lines: string[] = [];

  lines.push("PROBLEM");
  lines.push(`- ${state.summary}`);
  lines.push(`- Users: ${state.user.role} (${state.user.expertise}, ${state.user.audience}). ${state.user.description}`);
  lines.push(`- Goal: ${state.goal.primary}`);
  for (const t of state.tasks) lines.push(`- Task (${t.kind}, ${t.frequency}): ${t.name}. ${t.description}`);
  lines.push(`- Context: ${state.context.device}; ${state.context.environment}. Data: ${state.context.dataVolume}`);
  lines.push(`- Data: ${state.data.entity} — ${state.data.attributes.join(", ")}`);

  lines.push("", "DECISIONS (respect all of them)");
  for (const d of outcome.decisions) {
    const ruledOut = d.alternatives.filter((a) => a.vetoed).map((a) => a.choice);
    lines.push(
      `- ${d.decision} = ${d.result.choice} (${Math.round(d.result.confidence * 100)}%, ${d.source})` +
        (d.reasons[0] ? ` — ${d.reasons[0]}` : "") +
        (ruledOut.length > 0 ? ` Ruled out: ${ruledOut.join(", ")}.` : "")
    );
  }

  lines.push("", "PATTERNS");
  for (const p of outcome.patterns) lines.push(`- ${p.pattern} (${p.role})`);

  lines.push("", "COMPONENTS (the only ones you may use)");
  for (const c of outcome.components) {
    lines.push(`- ${c.component} "${c.name}": ${c.serves.map((s) => CAPABILITY_BY_ID.get(s)?.name ?? s).join(", ")}`);
  }

  const gaps = outcome.gaps.filter((g) => g.behavior !== "block");
  lines.push("", "DESIGN-SYSTEM GAPS");
  if (gaps.length === 0) lines.push("- none");
  for (const g of gaps) {
    lines.push(
      `- ${g.id}: ${CAPABILITY_BY_ID.get(g.capability)?.name ?? g.capability} — ${GAP_BEHAVIOR_TEXT[g.behavior]}` +
        (g.missing.length > 0 ? `; missing ${g.missing.join(", ")}` : "")
    );
  }

  if (outcome.requiredStates.length > 0) lines.push("", `REQUIRED STATES: ${outcome.requiredStates.join(", ")}`);

  lines.push("", "RULES (ids you may cite)");
  for (const id of new Set(outcome.rulesFired.map((r) => r.ruleId))) {
    const code = outcome.rulesFired.find((r) => r.ruleId === id)?.code;
    lines.push(`- ${id} [${code}]: ${ruleReason.get(id) ?? ""}`);
  }

  if (instruction?.trim()) {
    lines.push("", `DESIGNER'S STEERING (follow it within the rules above): ${instruction.trim()}`);
  }
  lines.push("", "Propose the layout directions as JSON.");
  return lines.join("\n");
}

export interface LayoutGenerationInput {
  state: UXState;
  outcome: PolicyOutcome;
  clientConfig?: ProviderClientConfig;
  instruction?: string;
  generate?: typeof generateStructured;
  id?: string;
  now?: Date;
}

/** Refuses while blocked; otherwise generates (LLM) or drafts (no LLM) validated, checked directions. */
export async function generateLayouts({
  state,
  outcome,
  clientConfig,
  instruction,
  generate = generateStructured,
  id = crypto.randomUUID(),
  now = new Date(),
}: LayoutGenerationInput): Promise<LayoutBrainstorm> {
  const blocking = outcome.gaps.filter((g) => g.behavior === "block");
  if (outcome.blocked || blocking.length > 0) {
    throw new GenerationBlockedError(blocking.map((g) => ({ id: g.id, capability: g.capability })));
  }

  const schema = buildGenerationSchema(generationVocabulary(outcome));
  const notices: string[] = [];
  let output: GenerationOutput;
  let source: LayoutBrainstorm["source"];
  let model: string;

  if (resolveLlmConfig(clientConfig)) {
    const result = await generate({
      systemPrompt: LAYOUT_SYSTEM_PROMPT,
      userPrompt: buildLayoutUserPrompt(state, outcome, instruction),
      schema,
      clientConfig,
      maxTokens: 8192,
    });
    output = result.data;
    source = "llm";
    model = `${result.source}:${result.model}`;
  } else {
    // The draft is held to the same contract as an LLM's output.
    output = schema.parse(composeDirections(state, outcome));
    source = "draft";
    model = "draft";
    notices.push(
      "No LLM key is configured, so these directions were drafted deterministically from your decisions and components. Add a key in Settings for richer, problem-specific directions."
    );
    if (instruction?.trim()) notices.push("Steering instructions need an LLM, so yours wasn't applied.");
  }

  return {
    id,
    generatedAt: now.toISOString(),
    source,
    model,
    ...(instruction?.trim() ? { instruction: instruction.trim() } : {}),
    notices,
    basedOn: outcome.decisions.map((d) => ({ decision: d.decision, choice: d.result.choice })),
    designSystem: outcome.versions.designSystem,
    prompts: KNOWLEDGE_VERSIONS.prompts,
    output,
    checks: checkDirections(output, outcome),
  };
}
