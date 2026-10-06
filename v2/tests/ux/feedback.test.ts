import { describe, expect, it, vi } from "vitest";
import type { generateStructured } from "@/lib/ai/generate";
import { evaluateDecisions } from "@/lib/decision-model/evaluate";
import { FEEDBACK_KNOWLEDGE, FEEDBACK_QUESTIONS } from "@/lib/knowledge";
import { feedbackRunSchema, uxStateSchema } from "@/lib/schemas";
import { buildClusteringSchema, draftClusters, fragments, quoteAppears } from "@/lib/ux/feedback/cluster";
import { buildFeedbackBatch, prioritize, summarizeFeedback } from "@/lib/ux/feedback/summarize";
import { expenseDashboardState } from "@/lib/ux/fixtures/expense-dashboard";

const ctx = { env: {}, ip: "local" };

const FEEDBACK = `Interview notes, managers:
- "I can't find the export button. I need it every day for finance and it's buried in a menu."
- Couldn't find where to change the approval limit.
- "I rejected the wrong report by accident and it was deleted, I had to start over."
- The status colours are confusing, I didn't understand what amber means.
- Approving one by one is tedious, I have 200 a week and it takes forever.
- I love how fast the search is.
- After I click approve nothing happened, did it work? I'm worried it didn't go through.`;

async function withoutLlm<T>(fn: () => Promise<T>): Promise<T> {
  const original = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    return await fn();
  } finally {
    if (original) process.env.ANTHROPIC_API_KEY = original;
  }
}

const summarize = () => withoutLlm(() => summarizeFeedback({ input: FEEDBACK, ctx, id: "f1" }));

describe("quotes must be real (no hallucinated evidence)", () => {
  it("accepts verbatim and lightly normalised quotes, and shortened ones", () => {
    expect(quoteAppears("I can't find the export button.", FEEDBACK)).toBe(true);
    expect(quoteAppears("“I can’t find the export button”", FEEDBACK)).toBe(true);
    expect(quoteAppears("I rejected the wrong report … I had to start over", FEEDBACK)).toBe(true);
    expect(quoteAppears("Export is perfect", FEEDBACK)).toBe(false);
  });

  it("rejects a clustering that invents evidence, so the LLM is retried", () => {
    const schema = buildClusteringSchema(FEEDBACK);
    const issue = { id: "export", title: "Can't find export", kind: "discoverability", summary: "Export is hidden.", evidence: ["I can't find the export button"] };
    expect(schema.safeParse({ issues: [issue] }).success).toBe(true);
    const invented = schema.safeParse({ issues: [{ ...issue, evidence: ["Export should be a big green button"] }] });
    expect(invented.success).toBe(false);
    expect(invented.error?.message).toMatch(/Not found in the feedback/);
  });
});

describe("draft clustering (no LLM)", () => {
  it("splits feedback into quotable fragments and groups them by kind", () => {
    expect(fragments(FEEDBACK).length).toBeGreaterThanOrEqual(8);
    const c = draftClusters(FEEDBACK);
    const kinds = c.issues.map((i) => i.kind);
    expect(kinds).toEqual(expect.arrayContaining(["discoverability", "error-recovery", "comprehension", "efficiency"]));
    expect(c.positives[0].evidence.join(" ")).toMatch(/love how fast the search is/);
    expect(() => buildClusteringSchema(FEEDBACK).parse(c)).not.toThrow();
  });
});

describe("judgment and policy (PRD §25)", () => {
  it("asks every feedback question once per issue, in one request", async () => {
    const issues = draftClusters(FEEDBACK).issues;
    const batch = buildFeedbackBatch(issues);
    expect(batch.questions).toHaveLength(FEEDBACK_QUESTIONS.length * issues.length);
    const decide = vi.fn(evaluateDecisions);
    await withoutLlm(() => summarizeFeedback({ input: FEEDBACK, ctx, decide }));
    expect(decide).toHaveBeenCalledTimes(1);
  });

  it("turns 'can't find export, every day' into surfacing it, and data loss into recovery, at the right priority", async () => {
    const run = await summarize();
    expect(() => feedbackRunSchema.parse(run)).not.toThrow();
    const find = run.issues.find((i) => i.kind === "discoverability")!;
    expect(find.recommendations.map((r) => r.code)).toContain("FB_SURFACE_FREQUENT");
    const loss = run.issues.find((i) => i.kind === "error-recovery")!;
    expect(loss.recommendations.map((r) => r.code)).toEqual(expect.arrayContaining(["FB_ADD_RECOVERY"]));
    expect(loss.priority).toBe("P0");
    expect(loss.judgments.map((j) => j.questionId)).toEqual(FEEDBACK_QUESTIONS.map((q) => q.id));
    expect(run.issues.find((i) => i.kind === "comprehension")!.recommendations.map((r) => r.code)).toContain("FB_PLAIN_LANGUAGE");
    // Sorted by priority.
    const order = run.issues.map((i) => i.priority);
    expect([...order].sort()).toEqual(order);
    expect(run.notices.join(" ")).toMatch(/grouped by keywords/);
  });

  it("reads feedback against an analysis when one is given", async () => {
    const state = uxStateSchema.parse(expenseDashboardState);
    const batch = buildFeedbackBatch(draftClusters(FEEDBACK).issues, state);
    expect(batch.state).toMatchObject({ product: { product: "Expense Management", primaryTask: "Review and approve expenses" } });
    const run = await withoutLlm(() => summarizeFeedback({ input: FEEDBACK, ctx, context: { sessionId: "s1", state } }));
    expect(run.context).toEqual({ sessionId: "s1", product: "Expense Management" });
  });

  it("prioritises by severity and reach", () => {
    expect(prioritize(1, true, true, 1).priority).toBe("P0");
    expect(prioritize(2.6, false, false, 1).priority).toBe("P0");
    expect(prioritize(1, true, false, 1).priority).toBe("P1");
    expect(prioritize(1, false, false, 1).priority).toBe("P2");
    expect(prioritize(0.4, false, false, 4).priority).toBe("P2");
    expect(prioritize(0.4, false, false, 1).priority).toBe("P3");
  });

  it("feedback rules reference real questions, capabilities and UX rules (validated at load)", () => {
    expect(FEEDBACK_KNOWLEDGE.rules.length).toBeGreaterThanOrEqual(10);
  });
});

describe("with an LLM", () => {
  it("uses the model's clustering, held to the real-quotes schema", async () => {
    const clustering = {
      issues: [{ id: "export-hidden", title: "Can't find export", kind: "discoverability", summary: "Daily export is buried.", evidence: ["I need it every day for finance and it's buried in a menu"] }],
      positives: [],
      nextQuestions: ["How do managers export today?"],
    };
    const generate = vi.fn().mockResolvedValue({ data: clustering, source: "anthropic", model: "claude-sonnet-5" });
    const run = await summarizeFeedback({
      input: FEEDBACK,
      ctx,
      clientConfig: { provider: "anthropic", apiKey: "k" },
      generate: generate as unknown as typeof generateStructured,
    });
    expect(run).toMatchObject({ source: "llm", model: "anthropic:claude-sonnet-5", nextQuestions: ["How do managers export today?"] });
    expect(run.issues[0].recommendations.map((r) => r.code)).toContain("FB_SURFACE_FREQUENT");
    expect(generate.mock.calls[0][0].schema.safeParse({ issues: [{ ...clustering.issues[0], evidence: ["made up"] }] }).success).toBe(false);
  });
});
