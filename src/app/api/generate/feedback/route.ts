import { NextResponse } from "next/server";
import { generateStructured } from "@/lib/anthropic";
import { FEEDBACK_SYSTEM_PROMPT, buildFeedbackUserPrompt } from "@/lib/prompts/feedback";
import { mockFeedbackOutput } from "@/lib/mocks/feedback";
import { feedbackOutputSchema, type GenerateRequestBody } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as GenerateRequestBody;

  if (!body.input || body.input.trim().length < 8) {
    return NextResponse.json(
      { error: "Add a bit more detail so I can give you something useful." },
      { status: 400 }
    );
  }

  try {
    const result = await generateStructured({
      systemPrompt: FEEDBACK_SYSTEM_PROMPT,
      userPrompt: buildFeedbackUserPrompt(body),
      schema: feedbackOutputSchema,
      mock: mockFeedbackOutput,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("feedback generation failed", error);
    return NextResponse.json(
      { error: "Something went wrong. Try again in a moment." },
      { status: 502 }
    );
  }
}
