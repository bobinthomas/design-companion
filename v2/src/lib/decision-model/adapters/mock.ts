import { noulConfidence } from "@/lib/decision-model/confidence";
import {
  normalizeProbabilities,
  type DecisionProvider,
  type DecisionState,
} from "@/lib/decision-model/provider";
import type { DecisionQuestion, DecisionResult } from "@/lib/schemas";

export const MOCK_MODEL_VERSION = "mock-1.0.0";

/** Probability mass given to the selected answer. */
const NOUL_TRUE = 0.88;
const CHOICE_WINNER = 0.7;
const SCORE_WINNER = 0.75;

/**
 * Deterministic decision provider for tests, local development and the
 * no-key demo. Each question's `mock` hints map answers to keywords; the
 * answer with the most keyword hits in the serialized state wins, else the
 * hint's default. Ambiguities are excluded: they're open questions, not facts.
 *
 * This is a stand-in for judgment, not judgment — results are labelled
 * provider "mock" everywhere they surface.
 */
export class MockDecisionProvider implements DecisionProvider {
  readonly id = "mock" as const;

  async evaluate(state: DecisionState, questions: readonly DecisionQuestion[]): Promise<DecisionResult[]> {
    const text = JSON.stringify({ ...state, ambiguities: [] }).toLowerCase();
    return questions.map((q) => answer(q, text));
  }
}

function countHits(text: string, keywords: readonly string[]): number {
  return keywords.reduce((hits, keyword) => {
    const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Match at a word start so "form" doesn't hit "information".
    const matches = text.match(new RegExp(`(?<![a-z0-9])${escaped}`, "g"));
    return hits + (matches?.length ?? 0);
  }, 0);
}

function pick(q: DecisionQuestion, text: string, answers: readonly string[]): string {
  let best = q.mock?.default ?? answers[0];
  let bestHits = 0;
  for (const a of answers) {
    const hits = countHits(text, q.mock?.keywords[a] ?? []);
    if (hits > bestHits) {
      best = a;
      bestHits = hits;
    }
  }
  return answers.includes(best) ? best : answers[0];
}

function answer(q: DecisionQuestion, text: string): DecisionResult {
  const base = { questionId: q.id, provider: "mock" as const, model: MOCK_MODEL_VERSION };

  if (q.type === "noul") {
    const noul = pick(q, text, ["true", "false"]) === "true" ? NOUL_TRUE : 1 - NOUL_TRUE;
    return { ...base, type: "noul", noul, confidence: noulConfidence(noul) };
  }

  if (q.type === "choice") {
    const options = Object.keys(q.criteria);
    const choice = pick(q, text, options);
    const rest = (1 - CHOICE_WINNER) / (options.length - 1);
    const probabilities = Object.fromEntries(
      options.map((o) => [o, o === choice ? CHOICE_WINNER : rest])
    );
    return { ...base, type: "choice", choice, probabilities, confidence: CHOICE_WINNER };
  }

  const levels = q.criteria.map((_, i) => String(i));
  const level = Number(pick(q, text, levels));
  const raw = Object.fromEntries(
    levels.map((l) => {
      const distance = Math.abs(Number(l) - level);
      return [l, distance === 0 ? SCORE_WINNER : distance === 1 ? (1 - SCORE_WINNER) / 2 : 0.01];
    })
  );
  const probabilities = normalizeProbabilities(raw, levels);
  const score = levels.reduce((sum, l) => sum + Number(l) * probabilities[l], 0);
  return {
    ...base,
    type: "score",
    score,
    probabilities,
    legend: q.criteria,
    confidence: probabilities[String(level)],
  };
}
