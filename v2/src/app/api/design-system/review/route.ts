import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/api";
import { applyDesignerReview } from "@/lib/design-system/capabilities";
import { CAPABILITY_BY_ID } from "@/lib/knowledge";
import { designSystemSchema, kebabIdSchema } from "@/lib/schemas";

const requestSchema = z.object({
  designSystem: designSystemSchema,
  reviews: z
    .array(
      z.object({
        component: kebabIdSchema,
        capability: kebabIdSchema.refine((c) => CAPABILITY_BY_ID.has(c), { message: "unknown capability" }),
        accept: z.boolean(),
        level: z.enum(["full", "partial"]).optional(),
        missing: z.array(z.string()).optional(),
      })
    )
    .min(1),
});

/**
 * §21e step 4: the designer confirms or rejects capability claims. The
 * result is a new patch version, so traces made against the old one stay
 * reproducible.
 */
export async function POST(request: Request) {
  const body = await parseBody(request, requestSchema);
  if (!body.ok) return body.response;
  const { designSystem, reviews } = body.data;
  const unknown = reviews.filter((r) => !designSystem.components.some((c) => c.id === r.component)).map((r) => r.component);
  if (unknown.length > 0) {
    return NextResponse.json({ error: `Unknown components: ${[...new Set(unknown)].join(", ")}` }, { status: 400 });
  }
  return NextResponse.json({ designSystem: designSystemSchema.parse(applyDesignerReview(designSystem, reviews)) });
}
