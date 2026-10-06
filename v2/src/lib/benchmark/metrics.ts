import type { DecisionContext } from "@/lib/decision-model/evaluate";
import type { DesignSystem, GenerationOutput, LayoutVariant, PolicyOutcome, UXState } from "@/lib/schemas";
import type { PreparedSubject } from "@/lib/ux/evaluate/batch";
import { evaluateSubjects } from "@/lib/ux/evaluate/evaluate";

/**
 * Benchmark metrics (PRD §40, §44), computed the same way for every arm.
 * Structural metrics are deterministic. The evaluation score uses the same
 * evaluator as the product, judged against a reference analysis of the
 * brief, which is the decision-guided pipeline's own reading of it. That
 * makes policy conformance favourable to C by construction; it's reported
 * separately so it can be discounted.
 */

export interface RunMetrics {
  ok: boolean;
  error?: string;
  latencyMs: number;
  model?: string;
  directions: number;
  /** Component references that exist in the design system ÷ all component references. */
  componentValidity: number;
  componentRefs: number;
  /** Directions citing at least one decided slot and one rule that actually fired ÷ directions. */
  explainability: number;
  /** Passed "shows the decision" checks ÷ all such checks, against the reference outcome. */
  policyConformance: number;
  /** Failed critical checks (e.g. an unprotected destructive action), summed over directions. */
  criticalFailures: number;
  /** Mean overall evaluation score of the directions (0–100). */
  evaluationScore: number;
  /** Mean share of required data states (loading, empty, error) the directions represent. */
  statesCoverage: number;
  /** Component ids used, for repeatability. */
  components: string[];
  /** C only: decision choices, for repeatability. */
  decisions?: Record<string, string>;
}

const DATA_STATES = ["loading", "empty", "error"];

function components(v: LayoutVariant): string[] {
  return v.regions.flatMap((r) => r.components.flatMap((c) => ("component" in c ? [c.component] : [])));
}

export async function measure(
  output: GenerationOutput,
  reference: { state: UXState; outcome: PolicyOutcome },
  designSystem: DesignSystem,
  ctx: DecisionContext,
  extra: { latencyMs: number; model: string; outcome?: PolicyOutcome }
): Promise<RunMetrics> {
  const registry = new Set(designSystem.components.map((c) => c.id));
  const refs = output.variants.flatMap(components);
  const fired = new Set(reference.outcome.rulesFired.map((r) => r.ruleId));
  const decided = new Set(reference.outcome.decisions.map((d) => d.decision));
  const explainable = output.variants.filter(
    (v) => v.supportingDecisions.some((d) => decided.has(d)) && v.rulesApplied.some((r) => fired.has(r))
  ).length;

  const subjects: PreparedSubject[] = output.variants.map((variant, i) => ({ kind: "direction", id: `${variant.id}-${i}`, label: variant.title, variant }));
  const run = await evaluateSubjects({ state: reference.state, outcome: reference.outcome, subjects, ctx });
  const decisionChecks = run.evaluations.flatMap((e) => e.checks.filter((c) => c.id.startsWith("check.decision.")));
  const criticalFailures = run.evaluations.reduce(
    (n, e) => n + e.issues.filter((i) => i.severity === "critical" && i.from.checkId).length + e.issues.filter((i) => i.from.checkId === "check.decision.actionConfirmation").length,
    0
  );
  const stateShares = output.variants.map((v) => {
    const shown = new Set(v.regions.flatMap((r) => r.components.flatMap((c) => ("states" in c ? c.states : []))));
    const required = DATA_STATES.filter((s) => reference.outcome.requiredStates.includes(s as never));
    return required.length === 0 ? 1 : required.filter((s) => shown.has(s as never)).length / required.length;
  });

  return {
    ok: true,
    latencyMs: extra.latencyMs,
    model: extra.model,
    directions: output.variants.length,
    componentValidity: refs.length === 0 ? 0 : refs.filter((r) => registry.has(r)).length / refs.length,
    componentRefs: refs.length,
    explainability: explainable / output.variants.length,
    policyConformance: decisionChecks.length === 0 ? 1 : decisionChecks.filter((c) => c.passed).length / decisionChecks.length,
    criticalFailures,
    evaluationScore: run.evaluations.reduce((s, e) => s + e.overallScore, 0) / run.evaluations.length,
    statesCoverage: stateShares.reduce((a, b) => a + b, 0) / stateShares.length,
    components: [...new Set(refs)].sort(),
    ...(extra.outcome ? { decisions: Object.fromEntries(extra.outcome.decisions.map((d) => [d.decision, d.result.choice])) } : {}),
  };
}

/** Mean pairwise Jaccard similarity of the component sets used across runs (1 = identical every time). */
export function componentRepeatability(runs: readonly RunMetrics[]): number | undefined {
  const sets = runs.filter((r) => r.ok).map((r) => new Set(r.components));
  if (sets.length < 2) return undefined;
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const union = new Set([...sets[i], ...sets[j]]);
      const both = [...sets[i]].filter((x) => sets[j].has(x)).length;
      total += union.size === 0 ? 1 : both / union.size;
      pairs++;
    }
  }
  return total / pairs;
}

/** Share of decision slots that got the same choice in every run (C only). */
export function decisionStability(runs: readonly RunMetrics[]): number | undefined {
  const all = runs.filter((r) => r.ok && r.decisions).map((r) => r.decisions!);
  if (all.length < 2) return undefined;
  const slots = new Set(all.flatMap((d) => Object.keys(d)));
  const stable = [...slots].filter((s) => all.every((d) => d[s] === all[0][s])).length;
  return slots.size === 0 ? 1 : stable / slots.size;
}
