import { describe, expect, it, vi } from "vitest";
import type { generateStructured } from "@/lib/ai/generate";
import { ARM_A_PROMPT, ARM_B_PROMPT } from "@/lib/benchmark/arms";
import { componentRepeatability, decisionStability, type RunMetrics } from "@/lib/benchmark/metrics";
import { BENCHMARK_CASES, renderReport, runBenchmark } from "@/lib/benchmark/run";
import { DEFAULT_DESIGN_SYSTEM } from "@/lib/design-system/default";
import { analyzeState } from "@/lib/ux/analyze";
import { composeDirections } from "@/lib/ux/layouts/compose";
import { LAYOUT_SYSTEM_PROMPT } from "@/lib/ux/layouts/generate";
import { STATE_SYSTEM_PROMPT } from "@/lib/ux/state/extract";
import type { GenerationOutput } from "@/lib/schemas";

const ctx = { env: {}, ip: "bench" };
const expense = BENCHMARK_CASES[0];

const direction = (id: string, components: string[], states: string[] = []) => ({
  id,
  title: id,
  strategy: id,
  summary: "s",
  rationale: "r",
  supportingDecisions: [],
  rulesApplied: [],
  regions: [{ name: "Main", purpose: "p", components: components.map((component, i) => ({ component, purpose: "p", states: i === 0 ? states : [] })) }],
  advantages: ["a"],
  tradeoffs: ["t"],
  mobileNotes: [],
  desktopNotes: ["d"],
});

/** A fake LLM: invents components for A, sticks to the registry for B, and plays the product's own steps for C. */
async function fakeLlm(): Promise<typeof generateStructured> {
  const a = await analyzeState({ state: expense.fallbackState, overrides: [], gapSettlements: [], ctx });
  const { state: _s, questions: _q, results: _r, decisionModel: _d, ...outcome } = a;
  const cOutput = composeDirections(expense.fallbackState, outcome);
  const outputs: Record<string, unknown> = {
    [ARM_A_PROMPT]: { variants: [direction("grid", ["magic-grid", "button"]), direction("cards", ["fancy-cards", "data-table"])] },
    [ARM_B_PROMPT]: { variants: [direction("table", ["data-table", "button"], ["loading"]), direction("list", ["list", "button"])] },
    [STATE_SYSTEM_PROMPT]: expense.fallbackState,
    [LAYOUT_SYSTEM_PROMPT]: cOutput,
  };
  return vi.fn(async ({ systemPrompt, schema }: { systemPrompt: string; schema: { parse: (x: unknown) => unknown } }) => ({
    data: schema.parse(outputs[systemPrompt]),
    source: "anthropic" as const,
    model: "fake",
  })) as unknown as typeof generateStructured;
}

describe("benchmark harness (PRD §40)", () => {
  it("runs all three arms on the same brief and measures them the same way", async () => {
    let t = 0;
    const report = await runBenchmark({
      cases: [expense],
      runs: 2,
      deps: { designSystem: DEFAULT_DESIGN_SYSTEM, ctx, clientConfig: { provider: "anthropic", apiKey: "fake" }, generate: await fakeLlm() },
      now: () => (t += 10),
    });
    const arms = Object.fromEntries(report.cases[0].arms.map((a) => [a.arm, a]));
    expect(arms.A.status).toBe("ran");
    expect(arms.A.mean!.componentValidity).toBeCloseTo(0.5); // two of four references are invented
    expect(arms.B.mean!.componentValidity).toBe(1);
    expect(arms.C.mean!.componentValidity).toBe(1);
    expect(arms.A.mean!.explainability).toBe(0);
    expect(arms.C.mean!.explainability).toBe(1);
    expect(arms.C.mean!.statesCoverage).toBe(1);
    expect(arms.A.mean!.statesCoverage).toBe(0);
    expect(arms.C.mean!.criticalFailures).toBe(0);
    expect(arms.A.mean!.criticalFailures).toBeGreaterThan(0); // no protection for Reject
    expect(arms.C.decisionStability).toBe(1);
    expect(arms.C.componentRepeatability).toBe(1);
    expect(report.cases[0].referenceSource).toBe("llm");

    const md = renderReport(report);
    expect(md).toMatch(/\| Design-system component validity \| 50% \| 100% \| 100% \|/);
    expect(md).not.toMatch(/were not run/);
  });

  it("without an LLM, runs only C and says the report doesn't answer the question", async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const report = await runBenchmark({ cases: [expense], runs: 1, deps: { designSystem: DEFAULT_DESIGN_SYSTEM, ctx } });
      expect(report.cases[0].arms.map((a) => a.status)).toEqual(["skipped", "skipped", "ran"]);
      expect(renderReport(report)).toMatch(/Arms A and B were not run[\s\S]*does \*\*not\*\* answer the research question/);
    } finally {
      if (original) process.env.ANTHROPIC_API_KEY = original;
    }
  });

  it("records failures as invalid output instead of crashing", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("Model response failed validation")) as unknown as typeof generateStructured;
    const report = await runBenchmark({
      cases: [expense],
      runs: 1,
      arms: ["A"],
      deps: { designSystem: DEFAULT_DESIGN_SYSTEM, ctx, clientConfig: { provider: "anthropic", apiKey: "fake" }, generate: failing },
    });
    const a = report.cases[0].arms[0];
    expect(a.runs[0]).toMatchObject({ ok: false, error: "Model response failed validation" });
    expect(a.mean).toBeUndefined();
    expect(renderReport(report)).toMatch(/Failures:\n- A: Model response failed validation/);
  });
});

describe("repeatability metrics", () => {
  const run = (components: string[], decisions?: Record<string, string>) => ({ ok: true, components, decisions }) as RunMetrics;
  it("measures component overlap and decision agreement across runs", () => {
    expect(componentRepeatability([run(["a", "b"]), run(["a", "b"])])).toBe(1);
    expect(componentRepeatability([run(["a", "b"]), run(["b", "c"])])).toBeCloseTo(1 / 3);
    expect(componentRepeatability([run(["a"])])).toBeUndefined();
    expect(decisionStability([run([], { layout: "x", search: "y" }), run([], { layout: "x", search: "z" })])).toBe(0.5);
  });

  it("keeps the generation output contract shared by all arms", () => {
    const out: GenerationOutput = { variants: [direction("a", ["x"]), direction("b", ["y"])] as never, assumptions: [] };
    expect(out.variants).toHaveLength(2);
  });
});
