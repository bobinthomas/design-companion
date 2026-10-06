import { NextResponse } from "next/server";
import { z } from "zod";
import { decisionCredentialsSchema, parseBody } from "@/lib/api";
import { ANALYSIS_QUESTIONS } from "@/lib/knowledge";
import { decisionResultSchema, uxStateSchema } from "@/lib/schemas";
import { analysisInputSchema, assertKnownResults, UnknownResultsError } from "@/lib/ux/analyze";
import { GenerationBlockedError, generateLayouts } from "@/lib/ux/layouts/generate";
import { runPolicy } from "@/lib/ux/pipeline";

const requestSchema = decisionCredentialsSchema
  .pick({ clientConfig: true })
  .extend(analysisInputSchema.shape)
  .extend({
    state: uxStateSchema,
    /** Results from the analysis; layouts never call the decision model. */
    results: z.array(decisionResultSchema).min(1),
    /** Optional designer steering, e.g. "make one direction mobile-first". */
    instruction: z.string().max(500).optional(),
  });

/**
 * PRD §23 Layout Brainstorm V2. Policy is re-run here from the analysis
 * inputs rather than trusted from the client, so blocking gaps are enforced
 * on the server: a blocked outcome gets 409 and no generation.
 */
export async function POST(request: Request) {
  const body = await parseBody(request, requestSchema);
  if (!body.ok) return body.response;
  const { state, results, overrides, gapSettlements, designSystem, clientConfig, instruction } = body.data;

  try {
    assertKnownResults(results);
    const outcome = runPolicy({ state, questions: ANALYSIS_QUESTIONS, results, overrides, gapSettlements, designSystem });
    return NextResponse.json(await generateLayouts({ state, outcome, clientConfig, instruction }));
  } catch (error) {
    if (error instanceof GenerationBlockedError) {
      return NextResponse.json({ error: error.message, blockingGaps: error.gaps }, { status: 409 });
    }
    if (error instanceof UnknownResultsError) {
      return NextResponse.json({ error: error.message, questionIds: error.questionIds }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Layout generation failed" },
      { status: 502 }
    );
  }
}
