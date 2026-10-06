import { POLICY, type PolicyConfig } from "@/lib/knowledge";
import type { ConfidenceBand, DecisionResult } from "@/lib/schemas";

/**
 * PRD §15 confidence handling. Thresholds come from knowledge/policy.json
 * (versioned), never from prompts. Confidence is a signal, not proof.
 */
export function confidenceBand(
  confidence: number,
  thresholds: PolicyConfig["confidence"] = POLICY.confidence
): ConfidenceBand {
  if (confidence >= thresholds.proceed) return "proceed";
  if (confidence >= thresholds.review) return "uncertain";
  return "needs-review";
}

/** Uniform 0..1 confidence for a noul probability: distance from a coin flip. */
export function noulConfidence(noul: number): number {
  return Math.max(noul, 1 - noul);
}

/** Whether a noul result counts as true / false under the policy threshold. */
export function noulIs(
  result: Extract<DecisionResult, { type: "noul" }>,
  expected: boolean,
  min: number = POLICY.noulTrueThreshold
): boolean {
  return expected ? result.noul >= min : result.noul <= 1 - min;
}
