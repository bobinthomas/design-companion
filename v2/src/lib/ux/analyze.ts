import { z } from "zod";
import { evaluateDecisions, type DecisionContext, type DecisionRun } from "@/lib/decision-model/evaluate";
import { ANALYSIS_QUESTIONS } from "@/lib/knowledge";
import { runPolicy, type GapSettlement } from "@/lib/ux/pipeline";
import type { DesignerOverride } from "@/lib/ux/policy/engine";
import {
  decisionResultSchema,
  decisionTypeSchema,
  designSystemSchema,
  gapResolutionKindSchema,
  type DecisionResult,
  type DesignSystem,
  type PolicyOutcome,
  type UXState,
} from "@/lib/schemas";

/** Request fields shared by /api/ux/decide and /api/ux/analyze. */
export const analysisInputSchema = z.object({
  /**
   * Results from an earlier run. When present, the decision model is not
   * called again — overrides and gap settlements re-run policy only.
   */
  results: z.array(decisionResultSchema).optional(),
  overrides: z
    .array(
      z.object({
        decision: decisionTypeSchema,
        choice: z.string(),
        reason: z.string().min(1),
        timestamp: z.iso.datetime().optional(),
      })
    )
    .default([]),
  gapSettlements: z
    .array(
      z.object({
        gapId: z.string(),
        kind: gapResolutionKindSchema,
        reason: z.string().min(1),
        timestamp: z.iso.datetime(),
      })
    )
    .default([]),
  /** Defaults to the bundled default design system. */
  designSystem: designSystemSchema.optional(),
});

export interface DecisionModelInfo {
  provider: DecisionRun["provider"];
  model: string;
  notices: string[];
  quota?: DecisionRun["quota"];
}

export type AnalysisResponse = PolicyOutcome & {
  state: UXState;
  questions: typeof ANALYSIS_QUESTIONS;
  results: DecisionResult[];
  decisionModel: DecisionModelInfo;
};

export class UnknownResultsError extends Error {
  constructor(readonly questionIds: string[]) {
    super(`Results for unknown questions: ${questionIds.join(", ")}`);
  }
}

/**
 * State → (decision model, unless results are supplied) → UX policy →
 * patterns → requirements → design-system resolution → components + gaps.
 */
export async function analyzeState(input: {
  state: UXState;
  results?: DecisionResult[];
  overrides: DesignerOverride[];
  gapSettlements: GapSettlement[];
  designSystem?: DesignSystem;
  ctx: DecisionContext;
}): Promise<AnalysisResponse> {
  let run: DecisionModelInfo & { results: DecisionResult[] };
  if (input.results) {
    const known = new Set(ANALYSIS_QUESTIONS.map((q) => q.id));
    const unknown = input.results.filter((r) => !known.has(r.questionId)).map((r) => r.questionId);
    if (unknown.length > 0) throw new UnknownResultsError(unknown);
    run = {
      results: input.results,
      provider: input.results[0]?.provider ?? "mock",
      model: input.results[0]?.model ?? "none",
      notices: ["Reused earlier decision-model results; the model was not called again."],
    };
  } else {
    run = await evaluateDecisions(input.state, ANALYSIS_QUESTIONS, input.ctx);
  }

  const outcome = runPolicy({
    state: input.state,
    questions: ANALYSIS_QUESTIONS,
    results: run.results,
    overrides: input.overrides,
    gapSettlements: input.gapSettlements,
    designSystem: input.designSystem,
  });

  return {
    state: input.state,
    questions: ANALYSIS_QUESTIONS,
    results: run.results,
    decisionModel: { provider: run.provider, model: run.model, notices: run.notices, quota: run.quota },
    ...outcome,
  };
}
