import { NextResponse } from "next/server";
import { generateStructured } from "@/lib/anthropic";
import { COPY_SYSTEM_PROMPT, buildCopyUserPrompt } from "@/lib/prompts/copy";
import { mockCopyOutput } from "@/lib/mocks/copy";
import { copyOutputSchema, type GenerateRequestBody } from "@/lib/types";

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
      systemPrompt: COPY_SYSTEM_PROMPT,
      userPrompt: buildCopyUserPrompt(body),
      schema: copyOutputSchema,
      mock: mockCopyOutput,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("copy generation failed", error);
    return NextResponse.json(
      { error: "Something went wrong. Try again in a moment." },
      { status: 502 }
    );
  }
}
