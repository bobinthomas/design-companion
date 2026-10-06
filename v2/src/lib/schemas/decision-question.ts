import { z } from "zod";
import { decisionTypeSchema, dottedIdSchema, kebabIdSchema } from "./vocabulary";

/**
 * PRD §8–10 Decision Question — one atomic, typed question evaluated against
 * the UX state. The shape mirrors Jev's native question format
 * (instructions + criteria) so the Jev adapter is a thin mapping, while
 * staying provider-neutral.
 */

const questionBase = {
  id: dottedIdSchema,
  /** What the question is for; analysis questions feed UX policy. */
  purpose: z.enum(["analysis", "evaluation", "capability-mapping"]),
  category: kebabIdSchema,
  /** Short, human-facing phrasing shown in the Decision Inspector. */
  question: z.string().min(1),
  /** Full instructions sent to the decision provider. */
  instructions: z.string().min(1),
  /**
   * Dot path to the part of the state this question is about, e.g.
   * "solutions.s1" when several solutions are evaluated in one request.
   * The instructions must name it too; providers that can narrow their
   * view (the mock) judge only that part.
   */
  scope: z.string().regex(/^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/).optional(),
};

/**
 * Deterministic answers for MockDecisionProvider: keyword hits in the
 * serialized state pick the answer, otherwise `default`. Keys are "true" /
 * "false" (noul), option ids (choice) or level indexes (score).
 */
export const mockHintsSchema = z.object({
  keywords: z.record(z.string(), z.array(z.string().min(1))).default({}),
  default: z.string(),
});

export const noulQuestionSchema = z.object({
  ...questionBase,
  type: z.literal("noul"),
  criteria: z.object({ true: z.string().min(1), false: z.string().min(1) }),
  mock: mockHintsSchema.optional(),
});

export const choiceQuestionSchema = z.object({
  ...questionBase,
  type: z.literal("choice"),
  /**
   * When set, this question's probabilities are the model's prior for that
   * policy decision slot, and its option ids must be options of that slot.
   */
  decision: decisionTypeSchema.optional(),
  /** Option id → what that option means. Ids must be self-describing. */
  criteria: z
    .record(kebabIdSchema, z.string().min(1))
    .refine((c) => Object.keys(c).length >= 2, { message: "choice needs at least 2 options" }),
  mock: mockHintsSchema.optional(),
});

export const scoreQuestionSchema = z.object({
  ...questionBase,
  type: z.literal("score"),
  /** Ordered rubric levels, lowest first. Score results are 0..levels-1. */
  criteria: z.array(z.string().min(1)).min(2),
  mock: mockHintsSchema.optional(),
});

export const decisionQuestionSchema = z.discriminatedUnion("type", [
  noulQuestionSchema,
  choiceQuestionSchema,
  scoreQuestionSchema,
]);

export type NoulQuestion = z.infer<typeof noulQuestionSchema>;
export type ChoiceQuestion = z.infer<typeof choiceQuestionSchema>;
export type ScoreQuestion = z.infer<typeof scoreQuestionSchema>;
export type DecisionQuestion = z.infer<typeof decisionQuestionSchema>;
export type DecisionQuestionInput = z.input<typeof decisionQuestionSchema>;
export type MockHints = z.infer<typeof mockHintsSchema>;
