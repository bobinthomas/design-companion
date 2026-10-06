import { NextResponse } from "next/server";
import { z } from "zod";
import { PROVIDERS, type Provider } from "@/lib/ai/providers";
import { clientIp, getBindings } from "@/lib/cloudflare";
import { evaluateDecisions } from "@/lib/decision-model/evaluate";
import { ANALYSIS_QUESTIONS, KNOWLEDGE_VERSIONS } from "@/lib/knowledge";
import { uxStateSchema } from "@/lib/schemas";

const requestSchema = z.object({
  state: uxStateSchema,
  /** Subset of analysis question ids; defaults to the full analysis set. */
  questionIds: z.array(z.string()).optional(),
  cloudflare: z.object({ accountId: z.string(), apiToken: z.string() }).optional(),
  clientConfig: z
    .object({
      provider: z.enum(PROVIDERS as [Provider, ...Provider[]]),
      apiKey: z.string(),
      model: z.string().optional(),
    })
    .optional(),
});

/**
 * Runs atomic decision questions against a UX state and returns the raw,
 * typed results with full provenance. Policy is applied elsewhere — this
 * endpoint only answers questions.
 */
export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", detail: parsed.error.message.slice(0, 500) },
      { status: 400 }
    );
  }
  const { state, questionIds, cloudflare, clientConfig } = parsed.data;

  const questions = questionIds
    ? ANALYSIS_QUESTIONS.filter((q) => questionIds.includes(q.id))
    : ANALYSIS_QUESTIONS;
  if (questions.length === 0) {
    return NextResponse.json({ error: "No matching questions" }, { status: 400 });
  }

  const run = await evaluateDecisions(state, questions, {
    cloudflare,
    llm: clientConfig,
    env: await getBindings(),
    ip: clientIp(request),
  });

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
