import { NextResponse } from "next/server";
import { z } from "zod";
import { decisionContext, decisionCredentialsSchema, parseBody } from "@/lib/api";
import { evaluateDecisions, type DecisionRun } from "@/lib/decision-model/evaluate";
import { ANALYSIS_QUESTIONS } from "@/lib/knowledge";
import { runPolicy } from "@/lib/ux/pipeline";
import {
  decisionResultSchema,
  decisionTypeSchema,
  designSystemSchema,
  uxStateSchema,
} from "@/lib/schemas";

const requestSchema = decisionCredentialsSchema.extend({
  state: uxStateSchema,
  /**
   * Results from an earlier run. When present, the decision model is not
   * called again — this is how overrides are re-applied without spending
   * another Jev request.
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
  /** Defaults to the bundled default design system. */
  designSystem: designSystemSchema.optional(),
});

/**
 * State → atomic questions → decision model → UX policy → patterns →
 * capability requirements → design-system resolution → components + gaps.
 * The decision model is the only non-deterministic step.
 */
export async function POST(request: Request) {
  const body = await parseBody(request, requestSchema);
  if (!body.ok) return body.response;
  const { state, results: suppliedResults, overrides, designSystem, ...credentials } = body.data;

  let run: Pick<DecisionRun, "results" | "provider" | "model" | "notices" | "quota">;
  if (suppliedResults) {
    const known = new Set(ANALYSIS_QUESTIONS.map((q) => q.id));
    const unknown = suppliedResults.filter((r) => !known.has(r.questionId)).map((r) => r.questionId);
    if (unknown.length > 0) {
      return NextResponse.json({ error: "Results for unknown questions", questionIds: unknown }, { status: 400 });
    }
    run = {
      results: suppliedResults,
      provider: suppliedResults[0]?.provider ?? "mock",
      model: suppliedResults[0]?.model ?? "none",
      notices: ["Reused earlier decision-model results; the model was not called again."],
    };
  } else {
    run = await evaluateDecisions(state, ANALYSIS_QUESTIONS, await decisionContext(request, credentials));
  }

  const outcome = runPolicy({ state, questions: ANALYSIS_QUESTIONS, results: run.results, overrides, designSystem });

  return NextResponse.json({
    state,
    questions: ANALYSIS_QUESTIONS,
    results: run.results,
    decisionModel: { provider: run.provider, model: run.model, notices: run.notices, quota: run.quota },
    ...outcome,
  });
}
