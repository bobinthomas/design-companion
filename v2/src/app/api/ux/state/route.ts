import { NextResponse } from "next/server";
import { z } from "zod";
import { decisionCredentialsSchema, parseBody } from "@/lib/api";
import { friendlyErrorMessage } from "@/lib/ai/errors";
import { extractState } from "@/lib/ux/state/extract";

const requestSchema = decisionCredentialsSchema.pick({ clientConfig: true }).extend({
  brief: z.string().trim().min(12, "Add a bit more detail so the problem can be described."),
});

/**
 * Brief → UX state (PRD §7). Interpretation only: no decisions are made
 * here, so the designer can review and correct the state before any
 * decision-model request is spent.
 */
export async function POST(request: Request) {
  const body = await parseBody(request, requestSchema);
  if (!body.ok) return body.response;

  try {
    return NextResponse.json(await extractState(body.data.brief, body.data.clientConfig));
  } catch (error) {
    console.error("state extraction failed", error);
    return NextResponse.json({ error: friendlyErrorMessage(error) }, { status: 502 });
  }
}
