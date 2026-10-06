import { afterEach, describe, expect, it, vi } from "vitest";
import { confidenceBand } from "@/lib/decision-model/confidence";
import { evaluateDecisions } from "@/lib/decision-model/evaluate";
import { getQuota, tryConsumeQuota, type QuotaStore } from "@/lib/decision-model/quota";
import { ANALYSIS_QUESTIONS } from "@/lib/knowledge";
import { uxStateSchema } from "@/lib/schemas";
import { expenseDashboardState } from "@/lib/ux/fixtures/expense-dashboard";

const state = uxStateSchema.parse(expenseDashboardState);
const questions = ANALYSIS_QUESTIONS.slice(0, 3);

function memoryStore(): QuotaStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    put: async (k, v) => {
      data.set(k, v);
    },
  };
}

/** A fake AI binding that answers any question set in Jev's format. */
function fakeAi() {
  return {
    run: vi.fn(async (_model: string, input: { questions: Record<string, { type: string; criteria: unknown }> }) => ({
      model: "jev-test",
      answers: Object.fromEntries(
        Object.entries(input.questions).map(([key, q]) => {
          if (q.type === "noul") return [key, { type: "noul", noul: 0.9 }];
          if (q.type === "choice") {
            const first = Object.keys(q.criteria as Record<string, string>)[0];
            return [key, { type: "choice", choice: first, confidence: 0.8, probabilities: { [first]: 0.8 } }];
          }
          return [key, { type: "score", score: 1, confidence: 0.7, probabilities: { "1": 0.7 } }];
        })
      ),
    })),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("confidence bands (§15)", () => {
  it("bands by the configured thresholds", () => {
    expect(confidenceBand(0.9)).toBe("proceed");
    expect(confidenceBand(0.85)).toBe("proceed");
    expect(confidenceBand(0.7)).toBe("uncertain");
    expect(confidenceBand(0.5)).toBe("needs-review");
  });
});

describe("quota", () => {
  it("allows the limit per IP per UTC day, then denies; resets the next day", async () => {
    const store = memoryStore();
    const day1 = new Date("2026-10-06T10:00:00Z");
    expect((await tryConsumeQuota(store, "1.2.3.4", 2, day1)).allowed).toBe(true);
    expect((await tryConsumeQuota(store, "1.2.3.4", 2, day1)).allowed).toBe(true);
    const third = await tryConsumeQuota(store, "1.2.3.4", 2, day1);
    expect(third).toEqual({ allowed: false, status: { limit: 2, used: 2, remaining: 0 } });
    // Other IPs are unaffected.
    expect((await tryConsumeQuota(store, "5.6.7.8", 2, day1)).allowed).toBe(true);
    // Next UTC day starts fresh.
    const day2 = new Date("2026-10-07T00:30:00Z");
    expect((await getQuota(store, "1.2.3.4", 2, day2)).remaining).toBe(2);
  });
});

describe("evaluateDecisions fallback chain", () => {
  it("uses the mock, with a notice, when nothing is configured", async () => {
    const run = await evaluateDecisions(state, questions, { env: {}, ip: "local" });
    expect(run.provider).toBe("mock");
    expect(run.results).toHaveLength(3);
    expect(run.notices.join(" ")).toMatch(/No decision model configured/);
  });

  it("uses the shared binding within quota and records usage", async () => {
    const ai = fakeAi();
    const store = memoryStore();
    const run = await evaluateDecisions(state, questions, {
      env: { AI: ai, JEV_QUOTA: store },
      ip: "1.2.3.4",
    });
    expect(run.provider).toBe("jev");
    expect(run.model).toBe("jev-test");
    expect(run.quota).toEqual({ limit: 2, used: 1, remaining: 1 });
    expect(run.notices).toEqual([]);
  });

  it("falls back once the daily quota is spent", async () => {
    const ai = fakeAi();
    const store = memoryStore();
    const ctx = { env: { AI: ai, JEV_QUOTA: store }, ip: "1.2.3.4" };
    await evaluateDecisions(state, questions, ctx);
    await evaluateDecisions(state, questions, ctx);
    const third = await evaluateDecisions(state, questions, ctx);
    expect(ai.run).toHaveBeenCalledTimes(2);
    expect(third.provider).toBe("mock");
    expect(third.notices.join(" ")).toMatch(/today's 2 free Jev analyses/);
  });

  it("refunds the quota when the shared binding fails", async () => {
    const store = memoryStore();
    const failing = { run: vi.fn().mockRejectedValue(new Error("2021: Insufficient AI Gateway credits")) };
    const run = await evaluateDecisions(state, questions, {
      env: { AI: failing, JEV_QUOTA: store },
      ip: "1.2.3.4",
    });
    expect(run.provider).toBe("mock");
    expect(run.notices[0]).toMatch(/Jev failed \(2021/);
    expect(run.quota).toEqual({ limit: 2, used: 0, remaining: 2 });
  });

  it("fails closed: never uses the shared binding without a quota store", async () => {
    const ai = fakeAi();
    const run = await evaluateDecisions(state, questions, { env: { AI: ai }, ip: "1.2.3.4" });
    expect(ai.run).not.toHaveBeenCalled();
    expect(run.provider).toBe("mock");
  });

  it("prefers the visitor's own Cloudflare token, without touching the quota", async () => {
    const ai = fakeAi();
    const store = memoryStore();
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ result: await ai.run("typesafe/jev", body.input) }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const run = await evaluateDecisions(state, questions, {
      cloudflare: { accountId: "acct", apiToken: "tok" },
      env: { AI: ai, JEV_QUOTA: store },
      ip: "1.2.3.4",
    });
    expect(run.provider).toBe("jev");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(store.data.size).toBe(0);
  });

  it("falls through to the next provider when one fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad", { status: 401 })));
    const run = await evaluateDecisions(state, questions, {
      cloudflare: { accountId: "acct", apiToken: "bad" },
      env: { AI: fakeAi(), JEV_QUOTA: memoryStore() },
      ip: "1.2.3.4",
    });
    expect(run.provider).toBe("jev");
    expect(run.notices[0]).toMatch(/your Cloudflare account\) failed .*token was rejected/);
    expect(run.notices.at(-1)).toBe("Answered by Jev instead.");
  });
});
