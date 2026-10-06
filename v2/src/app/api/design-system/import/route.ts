import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/api";
import { importDesignSystem } from "@/lib/design-system/import";
import { KNOWLEDGE_VERSIONS } from "@/lib/knowledge";
import { rawDesignSystemSchema } from "@/lib/schemas";

const requestSchema = z.object({ designSystem: rawDesignSystemSchema });

/**
 * §37 Phase 1 import: ingest JSON → normalize → infer capabilities. Returns
 * the normalized design system, the normalization report, and the inferred
 * claims that still need confirmation (see /api/design-system/map).
 */
export async function POST(request: Request) {
  const body = await parseBody(request, requestSchema);
  if (!body.ok) return body.response;

  const result = importDesignSystem(body.data.designSystem, "json");
  return NextResponse.json({
    ...result,
    versions: {
      capabilities: KNOWLEDGE_VERSIONS.capabilities,
      normalization: KNOWLEDGE_VERSIONS.normalization,
    },
  });
}
