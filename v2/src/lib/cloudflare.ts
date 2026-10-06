import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { AiBinding } from "@/lib/decision-model/adapters/jev";
import type { QuotaStore } from "@/lib/decision-model/quota";

export interface V2Bindings {
  AI?: AiBinding;
  JEV_QUOTA?: QuotaStore;
}

/**
 * Worker bindings for the current request. Returns an empty object outside
 * a Cloudflare context (e.g. a plain `next dev` without bindings), so
 * callers degrade to the next decision provider instead of crashing.
 */
export async function getBindings(): Promise<V2Bindings> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const bindings = env as unknown as Record<string, unknown>;
    return {
      AI: bindings.AI as AiBinding | undefined,
      JEV_QUOTA: bindings.JEV_QUOTA as QuotaStore | undefined,
    };
  } catch {
    return {};
  }
}

/** Caller IP as seen by Cloudflare; "local" in development. */
export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "local";
}
