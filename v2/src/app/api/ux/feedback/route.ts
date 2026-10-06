import { NextResponse } from "next/server";
import { z } from "zod";
import { decisionContext, decisionCredentialsSchema, parseBody } from "@/lib/api";
import { uxStateSchema } from "@/lib/schemas";
import { summarizeFeedback } from "@/lib/ux/feedback/summarize";

const requestSchema = decisionCredentialsSchema.extend({
  feedback: z.string().trim().min(20).max(20000),
  /** Optional analysis to read the feedback against. */
  context: z.object({ sessionId: z.string(), state: uxStateSchema }).optional(),
});

/** PRD §25 Feedback Summary V2: cluster → judge each issue (one request) → feedback rules → priorities. */
export async function POST(request: Request) {
  const body = await parseBody(request, requestSchema);
  if (!body.ok) return body.response;
  const { feedback, context, ...credentials } = body.data;
  try {
    return NextResponse.json(
      await summarizeFeedback({ input: feedback, context, ctx: await decisionContext(request, credentials), clientConfig: credentials.clientConfig })
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Summarizing failed" }, { status: 502 });
  }
}
