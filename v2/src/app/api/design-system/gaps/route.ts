import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/api";
import { DEFAULT_DESIGN_SYSTEM } from "@/lib/design-system/default";
import { detectGaps, gapBehavior } from "@/lib/design-system/gaps";
import { DesignSystemRegistry } from "@/lib/design-system/registry";
import { KNOWLEDGE_VERSIONS } from "@/lib/knowledge";
import { capabilityRequirementSchema, designSystemSchema } from "@/lib/schemas";

const requestSchema = z.object({
  requirements: z.array(capabilityRequirementSchema).min(1),
  /** Defaults to the bundled default design system. */
  designSystem: designSystemSchema.optional(),
});

/** §21c: resolve capability requirements against a design system and report gaps. */
export async function POST(request: Request) {
  const body = await parseBody(request, requestSchema);
  if (!body.ok) return body.response;

  const designSystem = body.data.designSystem ?? DEFAULT_DESIGN_SYSTEM;
  const { resolutions, gaps } = detectGaps(body.data.requirements, new DesignSystemRegistry(designSystem));

  return NextResponse.json({
    resolutions,
    gaps: gaps.map((gap) => ({ ...gap, behavior: gapBehavior(gap) })),
    blocked: gaps.some((g) => gapBehavior(g) === "block"),
    versions: {
      capabilities: KNOWLEDGE_VERSIONS.capabilities,
      compositions: KNOWLEDGE_VERSIONS.compositions,
      policy: KNOWLEDGE_VERSIONS.policy,
      designSystem: { id: designSystem.id, version: designSystem.version },
    },
  });
}
