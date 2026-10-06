import { NextResponse } from "next/server";
import { z } from "zod";
import { decisionContext, decisionCredentialsSchema, parseBody } from "@/lib/api";
import { evaluateDecisions } from "@/lib/decision-model/evaluate";
import { ANALYSIS_QUESTIONS, KNOWLEDGE_VERSIONS } from "@/lib/knowledge";
import { uxStateSchema } from "@/lib/schemas";

const requestSchema = decisionCredentialsSchema.extend({
  state: uxStateSchema,
  /** Subset of analysis question ids; defaults to the full analysis set. */
  questionIds: z.array(z.string()).optional(),
});

/**
 * Runs atomic decision questions against a UX state and returns the raw,
 * typed results with full provenance. Policy is applied elsewhere — this
 * endpoint only answers questions.
 */
export async function POST(request: Request) {
  const body = await parseBody(request, requestSchema);
  if (!body.ok) return body.response;
  const { state, questionIds, ...credentials } = body.data;

  const questions = questionIds
    ? ANALYSIS_QUESTIONS.filter((q) => questionIds.includes(q.id))
    : ANALYSIS_QUESTIONS;
  if (questions.length === 0) {
    return NextResponse.json({ error: "No matching questions" }, { status: 400 });
  }

  const run = await evaluateDecisions(state, questions, await decisionContext(request, credentials));

  return NextResponse.json({
    questions,
    ...run,
    versions: {
      decisionModel: run.model,
      questionSet: KNOWLEDGE_VERSIONS.questionSet,
      policy: KNOWLEDGE_VERSIONS.policy,
    },
  });
}
