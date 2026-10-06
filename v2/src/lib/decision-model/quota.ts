/** Minimal structural type for a Workers KV namespace. */
export interface QuotaStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface QuotaStatus {
  limit: number;
  used: number;
  remaining: number;
}

/** Counters live 48h so a key always outlives its UTC day. */
const TTL_SECONDS = 60 * 60 * 48;

function dayKey(ip: string, now: Date): string {
  return `jev:${ip}:${now.toISOString().slice(0, 10)}`;
}

async function readUsed(store: QuotaStore, key: string): Promise<number> {
  const raw = await store.get(key);
  const used = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(used) ? used : 0;
}

export async function getQuota(
  store: QuotaStore,
  ip: string,
  limit: number,
  now = new Date()
): Promise<QuotaStatus> {
  const used = await readUsed(store, dayKey(ip, now));
  return { limit, used, remaining: Math.max(0, limit - used) };
}

/**
 * Consumes one shared-binding Jev request for this IP and UTC day. KV is
 * eventually consistent, so this is a soft limit — concurrent requests from
 * different locations may occasionally slip one past it. That is acceptable
 * for cost control; it is not a security boundary.
 */
export async function tryConsumeQuota(
  store: QuotaStore,
  ip: string,
  limit: number,
  now = new Date()
): Promise<{ allowed: boolean; status: QuotaStatus }> {
  const key = dayKey(ip, now);
  const used = await readUsed(store, key);
  if (used >= limit) {
    return { allowed: false, status: { limit, used, remaining: 0 } };
  }
  await store.put(key, String(used + 1), { expirationTtl: TTL_SECONDS });
  return { allowed: true, status: { limit, used: used + 1, remaining: limit - used - 1 } };
}

/**
 * Gives back one request after a failed Jev call — a failure isn't billed,
 * so it shouldn't cost the visitor one of their daily analyses.
 */
export async function refundQuota(
  store: QuotaStore,
  ip: string,
  limit: number,
  now = new Date()
): Promise<QuotaStatus> {
  const key = dayKey(ip, now);
  const used = Math.max(0, (await readUsed(store, key)) - 1);
  await store.put(key, String(used), { expirationTtl: TTL_SECONDS });
  return { limit, used, remaining: Math.max(0, limit - used) };
}
