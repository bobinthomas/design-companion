import { confidenceBand } from "@/lib/decision-model/confidence";
import type { DirectionCheck, GenerationOutput, PolicyOutcome } from "@/lib/schemas";

/**
 * Deterministic checks on generated directions, computed in code so they
 * mean the same thing for an LLM's directions and the draft composer's:
 * which decisions a direction actually shows, which selected components it
 * leaves out, and how confident policy was in the decisions it builds on.
 * (Full UX evaluation arrives in Milestone 8.)
 */
export function checkDirections(output: GenerationOutput, outcome: PolicyOutcome): DirectionCheck[] {
  const serves = new Map(outcome.components.map((c) => [c.component, c.serves]));
  const gapCapability = new Map(outcome.gaps.map((g) => [g.id, g.capability]));

  return output.variants.map((v) => {
    const entries = v.regions.flatMap((r) => r.components);
    const used = new Set(entries.flatMap((e) => ("component" in e ? [e.component] : [])));
    const gapPlaceholders = [...new Set(entries.flatMap((e) => ("gap" in e ? [e.gap] : [])))];
    const shown = new Set([
      ...[...used].flatMap((c) => serves.get(c) ?? []),
      ...gapPlaceholders.flatMap((g) => gapCapability.get(g) ?? []),
    ]);

    const uncoveredDecisions = outcome.decisions
      .filter((d) => !d.requiresCapabilities.every((c) => shown.has(c)))
      .map((d) => d.decision);

    // Confidence in a direction is the confidence in the decisions it rests
    // on; a direction that cites none rests on all of them.
    const cited = outcome.decisions.filter((d) => v.supportingDecisions.includes(d.decision));
    const basis = cited.length > 0 ? cited : outcome.decisions;
    const confidence = basis.length > 0 ? basis.reduce((sum, d) => sum + d.result.confidence, 0) / basis.length : 0.5;

    return {
      variantId: v.id,
      confidence: Math.round(confidence * 1000) / 1000,
      band: confidenceBand(confidence),
      uncoveredDecisions,
      unusedComponents: outcome.components.map((c) => c.component).filter((c) => !used.has(c)),
      gapPlaceholders,
    };
  });
}
