import { NextResponse } from "next/server";
import { z } from "zod";
import { PROVIDERS, type Provider } from "@/lib/ai/providers";
import { clientIp, getBindings } from "@/lib/cloudflare";
import type { DecisionContext } from "@/lib/decision-model/evaluate";

/** Optional credentials any decision-model endpoint accepts from Settings. */
export const decisionCredentialsSchema = z.object({
  cloudflare: z.object({ accountId: z.string(), apiToken: z.string() }).optional(),
  clientConfig: z
    .object({
      provider: z.enum(PROVIDERS as [Provider, ...Provider[]]),
      apiKey: z.string(),
      model: z.string().optional(),
    })
    .optional(),
});

export async function decisionContext(
  request: Request,
  credentials: z.infer<typeof decisionCredentialsSchema>
): Promise<DecisionContext> {
  return {
    cloudflare: credentials.cloudflare,
    llm: credentials.clientConfig,
    env: await getBindings(),
    ip: clientIp(request),
  };
}

/** Parses a JSON body, returning a 400 response on invalid input. */
export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    response: NextResponse.json(
      {
        error: "Invalid request",
        issues: parsed.error.issues.slice(0, 20).map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 400 }
    ),
  };
}
