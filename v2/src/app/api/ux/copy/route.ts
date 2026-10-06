import { NextResponse } from "next/server";
import { z } from "zod";
import { decisionContext, decisionCredentialsSchema, parseBody } from "@/lib/api";
import { ANALYSIS_QUESTIONS } from "@/lib/knowledge";
import { decisionResultSchema, uxStateSchema } from "@/lib/schemas";
import { analysisInputSchema, assertKnownResults, UnknownResultsError } from "@/lib/ux/analyze";
import { generateCopy } from "@/lib/ux/copy/generate";
import { runPolicy } from "@/lib/ux/pipeline";

const requestSchema = decisionCredentialsSchema
  .extend(analysisInputSchema.shape)
  .extend({
    state: uxStateSchema,
    results: z.array(decisionResultSchema).min(1),
    tone: z.string().trim().min(1).max(120).default("clear, calm and concise"),
  });

/**
 * PRD §24 UI Copy V2: action risk from the decision model (one request),
 * interaction requirements from policy, words from the LLM (or templates),
 * checked against versioned copy guidelines.
 */
export async function POST(request: Request) {
  const body = await parseBody(request, requestSchema);
  if (!body.ok) return body.response;
  const { state, results, overrides, gapSettlements, designSystem, tone, ...credentials } = body.data;
  if (state.actions.length === 0) {
    return NextResponse.json({ error: "The UX state lists no actions to write copy for. Add actions to the state first." }, { status: 400 });
  }
  try {
    assertKnownResults(results);
    const outcome = runPolicy({ state, questions: ANALYSIS_QUESTIONS, results, overrides, gapSettlements, designSystem });
    return NextResponse.json(
      await generateCopy({ state, outcome, tone, ctx: await decisionContext(request, credentials), clientConfig: credentials.clientConfig })
    );
  } catch (error) {
    if (error instanceof UnknownResultsError) {
      return NextResponse.json({ error: error.message, questionIds: error.questionIds }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Copy generation failed" }, { status: 502 });
  }
}
