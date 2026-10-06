import { NextResponse } from "next/server";
import { decisionContext, decisionCredentialsSchema, parseBody } from "@/lib/api";
import { analysisInputSchema, analyzeState, UnknownResultsError } from "@/lib/ux/analyze";
import { uxStateSchema } from "@/lib/schemas";

const requestSchema = decisionCredentialsSchema.extend(analysisInputSchema.shape).extend({ state: uxStateSchema });

/**
 * State → atomic questions → decision model → UX policy → patterns →
 * capability requirements → design-system resolution → components + gaps.
 * The decision model is the only non-deterministic step, and is skipped
 * when earlier `results` are supplied.
 */
export async function POST(request: Request) {
  const body = await parseBody(request, requestSchema);
  if (!body.ok) return body.response;
  const { state, results, overrides, gapSettlements, designSystem, ...credentials } = body.data;

  try {
    return NextResponse.json(
      await analyzeState({
        state,
        results,
        overrides,
        gapSettlements,
        designSystem,
        ctx: await decisionContext(request, credentials),
      })
    );
  } catch (error) {
    if (error instanceof UnknownResultsError) {
      return NextResponse.json({ error: error.message, questionIds: error.questionIds }, { status: 400 });
    }
    throw error;
  }
}
