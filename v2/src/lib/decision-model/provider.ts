import type { DecisionProviderId, DecisionQuestion, DecisionResult, UXState } from "@/lib/schemas";

/**
 * PRD §6, §33 DecisionProvider. The application's own interface for the
 * decision-model layer, so policy never depends on a specific model. Jev,
 * an LLM and a deterministic mock all implement it.
 *
 * Contract: exactly one validated result per question, in question order,
 * each tagged with this provider's id and model version.
 */
export interface DecisionProvider {
  readonly id: DecisionProviderId;
  evaluate(state: UXState, questions: readonly DecisionQuestion[]): Promise<DecisionResult[]>;
}

/** Normalizes a probability map so it sums to 1 over exactly `keys`. */
export function normalizeProbabilities(
  raw: Record<string, number>,
  keys: readonly string[]
): Record<string, number> {
  const values = keys.map((k) => Math.max(0, Number.isFinite(raw[k]) ? raw[k] : 0));
  const total = values.reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  keys.forEach((k, i) => {
    out[k] = total > 0 ? values[i] / total : 1 / keys.length;
  });
  return out;
}

export function argmax(probabilities: Record<string, number>): [string, number] {
  let best: [string, number] = ["", -1];
  for (const [k, p] of Object.entries(probabilities)) {
    if (p > best[1]) best = [k, p];
  }
  return best;
}

/** Probability-weighted level for a score question (levels are 0..n-1). */
export function weightedScore(probabilities: Record<string, number>): number {
  return Object.entries(probabilities).reduce((sum, [level, p]) => sum + Number(level) * p, 0);
}

/** Throws unless results line up one-to-one with questions and types match. */
export function assertResultsMatch(
  questions: readonly DecisionQuestion[],
  results: readonly DecisionResult[]
): void {
  if (results.length !== questions.length) {
    throw new Error(`expected ${questions.length} results, got ${results.length}`);
  }
  questions.forEach((q, i) => {
    const r = results[i];
    if (r.questionId !== q.id || r.type !== q.type) {
      throw new Error(`result ${i} (${r.questionId}/${r.type}) does not match question ${q.id}/${q.type}`);
    }
    if (r.type === "choice" && q.type === "choice" && !(r.choice in q.criteria)) {
      throw new Error(`result for ${q.id} chose unknown option "${r.choice}"`);
    }
  });
}
