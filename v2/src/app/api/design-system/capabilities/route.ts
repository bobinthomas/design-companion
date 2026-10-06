import { NextResponse } from "next/server";
import { CAPABILITIES, COMPOSITIONS, KNOWLEDGE_VERSIONS } from "@/lib/knowledge";

/** The capability vocabulary and composition recipes, with their versions. */
export async function GET() {
  return NextResponse.json({
    versions: {
      capabilities: KNOWLEDGE_VERSIONS.capabilities,
      compositions: KNOWLEDGE_VERSIONS.compositions,
    },
    capabilities: CAPABILITIES,
    compositions: COMPOSITIONS,
  });
}
