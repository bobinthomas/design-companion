import { NextResponse } from "next/server";
import { z } from "zod";
import { decisionContext, decisionCredentialsSchema, parseBody } from "@/lib/api";
import { applyMappingResults, buildMappingBatch } from "@/lib/design-system/capabilities";
import { evaluateDecisions } from "@/lib/decision-model/evaluate";
import { designSystemSchema, pendingMappingSchema } from "@/lib/schemas";

const requestSchema = decisionCredentialsSchema.extend({
  designSystem: designSystemSchema,
  pending: z.array(pendingMappingSchema).min(1),
});

/**
 * §21e step 3: asks the decision model about ambiguous component/capability
 * pairs only — one bounded batch, so one decision-model request — and
 * applies the answers. The designer reviews the result next.
 */
export async function POST(request: Request) {
  const body = await parseBody(request, requestSchema);
  if (!body.ok) return body.response;
  const { designSystem, pending, ...credentials } = body.data;

  const batch = buildMappingBatch(designSystem, pending);
  const run = await evaluateDecisions(batch.state, batch.questions, await decisionContext(request, credentials));
  const applied = applyMappingResults(designSystem, batch, run.results);

  return NextResponse.json({
    designSystem: applied.designSystem,
    entries: applied.entries,
    asked: batch.pairs.length,
    skipped: pending.length - batch.pairs.length,
    provider: run.provider,
    model: run.model,
    notices: run.notices,
    quota: run.quota,
  });
}
