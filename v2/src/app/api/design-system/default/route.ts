import { NextResponse } from "next/server";
import { DEFAULT_DESIGN_SYSTEM_IMPORT } from "@/lib/design-system/default";

/** The bundled default design system and its normalization report. */
export async function GET() {
  return NextResponse.json(DEFAULT_DESIGN_SYSTEM_IMPORT);
}
