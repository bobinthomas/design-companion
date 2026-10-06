import { z } from "zod";

/**
 * PRD §9, §32 Decision Result — the raw, structured answer to one question.
 * Typed per question type instead of `value: unknown`, so policy never has
 * to guess. Every result carries a uniform `confidence` (0..1) that the
 * confidence policy (§15) can band, and provenance for the trace.
 */

const probability = z.number().min(0).max(1);

export const decisionProviderIdSchema = z.enum(["jev", "llm", "mock"]);

const resultBase = {
  questionId: z.string(),
  /** Uniform 0..1. For noul this is max(p, 1 - p). */
  confidence: probability,
  provider: decisionProviderIdSchema,
  /** Provider-reported model version, e.g. "jev-1.13.0". */
  model: z.string(),
};

export const noulResultSchema = z.object({
  ...resultBase,
  type: z.literal("noul"),
  /** Probability the statement is true. */
  noul: probability,
});

export const choiceResultSchema = z.object({
  ...resultBase,
  type: z.literal("choice"),
  choice: z.string(),
  probabilities: z.record(z.string(), probability),
});

export const scoreResultSchema = z.object({
  ...resultBase,
  type: z.literal("score"),
  /** Probability-weighted level, 0..levels-1. */
  score: z.number().min(0),
  /** Level index (as string) → probability. */
  probabilities: z.record(z.string(), probability),
  /** Human labels for each level, lowest first. */
  legend: z.array(z.string()).default([]),
});

export const decisionResultSchema = z.discriminatedUnion("type", [
  noulResultSchema,
  choiceResultSchema,
  scoreResultSchema,
]);

export type DecisionProviderId = z.infer<typeof decisionProviderIdSchema>;
export type NoulResult = z.infer<typeof noulResultSchema>;
export type ChoiceResult = z.infer<typeof choiceResultSchema>;
export type ScoreResult = z.infer<typeof scoreResultSchema>;
export type DecisionResult = z.infer<typeof decisionResultSchema>;
