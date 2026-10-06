import { NextResponse } from "next/server";
import { z } from "zod";
import { decisionContext, decisionCredentialsSchema, parseBody } from "@/lib/api";
import { ANALYSIS_QUESTIONS } from "@/lib/knowledge";
import { buildVariantSchema, decisionResultSchema, evaluationSubjectInputSchema, uxStateSchema } from "@/lib/schemas";
import { analysisInputSchema, assertKnownResults, UnknownResultsError } from "@/lib/ux/analyze";
import type { PreparedSubject } from "@/lib/ux/evaluate/batch";
import { evaluateSubjects } from "@/lib/ux/evaluate/evaluate";
import { generationVocabulary } from "@/lib/ux/layouts/generate";
import { runPolicy } from "@/lib/ux/pipeline";

const requestSchema = decisionCredentialsSchema
  .extend(analysisInputSchema.shape)
  .extend({
    state: uxStateSchema,
    /** The analysis's results: evaluation is judged against those decisions. */
    results: z.array(decisionResultSchema).min(1),
    subjects: z.array(evaluationSubjectInputSchema).min(1).max(3),
  });

class StaleDirectionError extends Error {}

/**
 * PRD §27–28 UX Evaluate. Re-runs policy from the analysis inputs, checks
 * each direction still fits those decisions, then evaluates every subject
 * with one decision-model request plus deterministic checks.
 */
export async function POST(request: Request) {
  const body = await parseBody(request, requestSchema);
  if (!body.ok) return body.response;
  const { state, results, overrides, gapSettlements, designSystem, subjects, ...credentials } = body.data;

  try {
    assertKnownResults(results);
    const outcome = runPolicy({ state, questions: ANALYSIS_QUESTIONS, results, overrides, gapSettlements, designSystem });
    const { requiredGapIds: _required, ...vocab } = generationVocabulary(outcome);
    const variantSchema = buildVariantSchema(vocab);

    let descriptions = 0;
    const prepared: PreparedSubject[] = subjects.map((s) => {
      if (s.kind === "description") {
        descriptions += 1;
        return { kind: "description", id: descriptions === 1 ? "description" : `description-${descriptions}`, label: s.title, description: s.description };
      }
      const parsed = variantSchema.safeParse(s.variant);
      if (!parsed.success) {
        throw new StaleDirectionError(
          `"${s.variant.title}" no longer fits the current decisions (${parsed.error.issues[0]?.message}). Generate the directions again, then evaluate.`
        );
      }
      return { kind: "direction", id: parsed.data.id, label: parsed.data.title, variant: parsed.data, layoutRunId: s.layoutRunId };
    });

    return NextResponse.json(
      await evaluateSubjects({ state, outcome, subjects: prepared, ctx: await decisionContext(request, credentials) })
    );
  } catch (error) {
    if (error instanceof StaleDirectionError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof UnknownResultsError) {
      return NextResponse.json({ error: error.message, questionIds: error.questionIds }, { status: 400 });
    }
    throw error;
  }
}
