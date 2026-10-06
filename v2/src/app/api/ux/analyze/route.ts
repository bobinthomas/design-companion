import { NextResponse } from "next/server";
import { z } from "zod";
import { friendlyErrorMessage } from "@/lib/ai/errors";
import { decisionContext, decisionCredentialsSchema, parseBody } from "@/lib/api";
import { analysisInputSchema, analyzeState } from "@/lib/ux/analyze";
import { extractState } from "@/lib/ux/state/extract";

const requestSchema = decisionCredentialsSchema.extend(analysisInputSchema.omit({ results: true }).shape).extend({
  prompt: z.string().trim().min(12, "Add a bit more detail so the problem can be described."),
});

/**
 * PRD §34 one-shot analysis: prompt → state → questions → results →
 * decisions → patterns → components. The UI uses /api/ux/state then
 * /api/ux/decide instead, so the designer can review the state in between.
 */
export async function POST(request: Request) {
  const body = await parseBody(request, requestSchema);
  if (!body.ok) return body.response;
  const { prompt, overrides, gapSettlements, designSystem, ...credentials } = body.data;

  let extraction;
  try {
    extraction = await extractState(prompt, credentials.clientConfig);
  } catch (error) {
    console.error("state extraction failed", error);
    return NextResponse.json({ error: friendlyErrorMessage(error) }, { status: 502 });
  }

  const analysis = await analyzeState({
    state: extraction.state,
    overrides,
    gapSettlements,
    designSystem,
    ctx: await decisionContext(request, credentials),
  });
  return NextResponse.json({
    ...analysis,
    stateSource: { kind: extraction.source, model: extraction.model, notices: extraction.notices },
  });
}
