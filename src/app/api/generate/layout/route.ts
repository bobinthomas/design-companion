import { NextResponse } from "next/server";
import { generateStructured } from "@/lib/generate";
import { LAYOUT_SYSTEM_PROMPT, buildLayoutUserPrompt } from "@/lib/prompts/layout";
import { mockLayoutOutput } from "@/lib/mocks/layout";
import { layoutOutputSchema, type GenerateRequestBody } from "@/lib/types";
import { friendlyErrorMessage } from "@/lib/errors";

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
      systemPrompt: LAYOUT_SYSTEM_PROMPT,
      userPrompt: buildLayoutUserPrompt(body),
      schema: layoutOutputSchema,
      mock: mockLayoutOutput,
      clientConfig: body.clientConfig,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("layout generation failed", error);
    return NextResponse.json({ error: friendlyErrorMessage(error) }, { status: 502 });
  }
}
