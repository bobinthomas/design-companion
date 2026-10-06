import { generateStructured, resolveLlmConfig } from "@/lib/ai/generate";
import type { ProviderClientConfig } from "@/lib/ai/providers";
import {
  ACCESSIBILITY_LEVELS,
  AUDIENCES,
  DEVICES,
  EXPERTISE,
  FREQUENCIES,
  uxStateSchema,
  type UXState,
} from "@/lib/schemas";
import { expenseDashboardState } from "@/lib/ux/fixtures/expense-dashboard";
import { subscriptionSignupState } from "@/lib/ux/fixtures/subscription-signup";

/**
 * PRD §7 interpretation step: brief → UX state. The LLM *describes* the
 * problem; it must not judge it ("high volume", "needs a table") — that's
 * the decision model's job, and pre-judging here would make Jev just echo
 * the LLM. Only hard constraints are chosen from fixed vocabularies.
 */

export const STATE_SYSTEM_PROMPT = `You turn a product designer's brief into a structured UX problem description.

You DESCRIBE the problem. You do NOT judge it or design anything.
- Write what is true about users, tasks, data and context in plain, concrete terms.
- Do not label things as high/low, simple/complex, or say which UI to use.
  Good: "dataVolume": "Roughly 200 pending reports per manager per week"
  Bad:  "dataVolume": "high"
  Bad:  "notes": ["Use a data table"]
- Where the brief doesn't say something, make a reasonable, modest assumption AND record it in "ambiguities"
  with the field, a question for the designer, and the assumption you made.
- Never invent precise numbers the brief doesn't support; describe ranges and say they are assumptions.

Fixed vocabularies (use exactly these values):
- user.expertise: ${EXPERTISE.join(" | ")}
- user.audience: ${AUDIENCES.join(" | ")}
- context.device: ${DEVICES.join(" | ")}   (use "multi" for responsive web used on several devices)
- tasks[].frequency and context.frequency: ${FREQUENCIES.join(" | ")}
- tasks[].kind: primary | supporting   (exactly one primary task)
- constraints.accessibility: ${ACCESSIBILITY_LEVELS.join(" | ")}   (default WCAG-AA)

Return JSON only, with this shape:
{
  "brief": string,
  "product": string,
  "summary": string,
  "user": { "role": string, "expertise": string, "audience": string, "description": string },
  "goal": { "primary": string, "secondary": string[], "successCriteria": string[] },
  "tasks": [{ "name": string, "kind": "primary" | "supporting", "frequency": string, "description": string }],
  "actions": [{ "name": string, "description": string }],
  "context": { "device": string, "frequency": string, "environment": string, "dataVolume": string, "timePressure": string, "notes": string[] },
  "data": { "entity": string, "description": string, "attributes": string[] },
  "constraints": { "accessibility": string, "designSystem": "default", "business": string[], "technical": string[] },
  "ambiguities": [{ "field": string, "question": string, "assumption": string }]
}

"actions" are the things users do to records (approve, reject, delete, export…) — describe whether each one notifies other people or can be undone, if the brief says so.`;

export function buildStateUserPrompt(brief: string): string {
  return `Designer's brief:\n"""\n${brief.trim()}\n"""\n\nDescribe this UX problem as JSON.`;
}

const DEMO_STATES: { keywords: string[]; state: typeof expenseDashboardState }[] = [
  {
    keywords: ["subscription", "subscribe", "checkout", "sign up", "signup", "sign-up", "plan", "payment", "onboarding", "meal"],
    state: subscriptionSignupState,
  },
  {
    keywords: ["expense", "approve", "approval", "review", "dashboard", "manager", "reimburse", "table"],
    state: expenseDashboardState,
  },
];

/** The canned state whose keywords best match the brief (expense dashboard by default). */
export function pickDemoState(brief: string): UXState {
  const text = brief.toLowerCase();
  const scored = DEMO_STATES.map((d) => ({
    d,
    hits: d.keywords.filter((k) => text.includes(k)).length,
  })).sort((a, b) => b.hits - a.hits);
  const best = scored[0].hits > 0 ? scored[0].d : DEMO_STATES[1];
  return uxStateSchema.parse(best.state);
}

export interface StateExtraction {
  state: UXState;
  source: "llm" | "demo";
  model: string;
  notices: string[];
}

/** Brief → validated UX state, via the visitor's LLM, or a labelled demo state without one. */
export async function extractState(
  brief: string,
  clientConfig?: ProviderClientConfig,
  generate: typeof generateStructured = generateStructured
): Promise<StateExtraction> {
  if (!resolveLlmConfig(clientConfig)) {
    const state = pickDemoState(brief);
    const isExample = state.brief.trim().toLowerCase() === brief.trim().toLowerCase();
    return {
      state,
      source: "demo",
      model: "demo",
      notices: [
        isExample
          ? "No LLM key is configured, so this is the prepared demo state for this example. Add a key in Settings to analyze your own briefs."
          : `No LLM key is configured, so this is the prepared demo state for "${state.brief}", not your brief. Add a key in Settings to analyze your own brief, or edit this state directly.`,
      ],
    };
  }

  const { data, model, source } = await generate({
    systemPrompt: STATE_SYSTEM_PROMPT,
    userPrompt: buildStateUserPrompt(brief),
    schema: uxStateSchema,
    clientConfig,
  });
  // The brief is the designer's own words; never let the model rewrite it.
  return { state: { ...data, brief: brief.trim() }, source: "llm", model: `${source}:${model}`, notices: [] };
}
