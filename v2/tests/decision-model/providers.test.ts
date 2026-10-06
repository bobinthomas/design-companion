import { describe, expect, it, vi } from "vitest";
import { JevProvider } from "@/lib/decision-model/adapters/jev";
import { LlmDecisionProvider } from "@/lib/decision-model/adapters/llm";
import { MockDecisionProvider } from "@/lib/decision-model/adapters/mock";
import { assertResultsMatch } from "@/lib/decision-model/provider";
import { ANALYSIS_QUESTIONS } from "@/lib/knowledge";
import { decisionResultSchema, uxStateSchema, type DecisionQuestion } from "@/lib/schemas";
import { expenseDashboardState } from "@/lib/ux/fixtures/expense-dashboard";
import type { generateStructured } from "@/lib/ai/generate";

const state = uxStateSchema.parse(expenseDashboardState);
const byId = (id: string) => ANALYSIS_QUESTIONS.find((q) => q.id === id)!;

const noulQ = byId("data.volume.high");
const choiceQ = byId("decision.data-presentation");
const scoreQ = byId("risk.error-cost");
const sample: DecisionQuestion[] = [noulQ, choiceQ, scoreQ];

describe("MockDecisionProvider", () => {
  it("answers every analysis question with valid, matching results", async () => {
    const results = await new MockDecisionProvider().evaluate(state, ANALYSIS_QUESTIONS);
    results.forEach((r) => decisionResultSchema.parse(r));
    assertResultsMatch(ANALYSIS_QUESTIONS, results);
  });

  it("is deterministic", async () => {
    const mock = new MockDecisionProvider();
    expect(await mock.evaluate(state, ANALYSIS_QUESTIONS)).toEqual(
      await mock.evaluate(state, ANALYSIS_QUESTIONS)
    );
  });

  it("gives sensible judgments for the expense dashboard", async () => {
    const results = await new MockDecisionProvider().evaluate(state, ANALYSIS_QUESTIONS);
    const get = (id: string) => results.find((r) => r.questionId === id)!;
    const noul = (id: string) => {
      const r = get(id);
      if (r.type !== "noul") throw new Error(id);
      return r.noul;
    };

    expect(noul("data.volume.high")).toBeGreaterThan(0.7);
    expect(noul("data.comparison.required")).toBeGreaterThan(0.7);
    expect(noul("data.filtering.required")).toBeGreaterThan(0.7);
    expect(noul("task.bulk-actions.required")).toBeGreaterThan(0.7);
    expect(noul("action.destructive.present")).toBeGreaterThan(0.7);
    expect(noul("data.records.visual")).toBeLessThan(0.3);
    expect(noul("task.multi-step.required")).toBeLessThan(0.3);
    // Ambiguities are excluded from mock judgments ("phone" appears only there).
    expect(noul("device.mobile.likely")).toBeLessThan(0.3);

    const presentation = get("decision.data-presentation");
    expect(presentation.type === "choice" && presentation.choice).toBe("data-table");
    const errorCost = get("risk.error-cost");
    expect(errorCost.type === "score" && errorCost.score).toBeGreaterThan(1.5);
  });

  it("matches keywords at word starts only", async () => {
    const formQ = byId("task.data-entry.heavy");
    const noForm = uxStateSchema.parse({
      ...expenseDashboardState,
      summary: "Shows information on a platform",
    });
    const [r] = await new MockDecisionProvider().evaluate(noForm, [formQ]);
    expect(r.type === "noul" && r.noul).toBeLessThan(0.5);
  });
});

describe("JevProvider", () => {
  const jevOutput = {
    model: "jev-1.13.0",
    answers: {
      data_volume_high: { type: "noul", noul: 0.97 },
      decision_data_presentation: {
        type: "choice",
        choice: "data-table",
        confidence: 0.91,
        probabilities: { "data-table": 0.91, "card-grid": 0.04, list: 0.04, kanban: 0.01 },
      },
      risk_error_cost: {
        type: "score",
        score: 1.7,
        confidence: 0.72,
        // Jev may key score levels by label rather than index.
        probabilities: {
          [scoreQ.type === "score" ? scoreQ.criteria[1] : ""]: 0.28,
          [scoreQ.type === "score" ? scoreQ.criteria[2] : ""]: 0.72,
        },
      },
    },
    usage: { input_tokens: 426, output_tokens: 73 },
  };

  it("maps questions to Jev's native format and parses typed answers (binding)", async () => {
    const run = vi.fn().mockResolvedValue(jevOutput);
    const results = await new JevProvider({ kind: "binding", ai: { run } }).evaluate(state, sample);

    const [model, input] = run.mock.calls[0];
    expect(model).toBe("typesafe/jev");
    expect(Object.keys(input.questions)).toEqual([
      "data_volume_high",
      "decision_data_presentation",
      "risk_error_cost",
    ]);
    expect(input.questions.data_volume_high).toEqual({
      type: "noul",
      instructions: noulQ.instructions,
      criteria: noulQ.criteria,
    });

    assertResultsMatch(sample, results);
    const [noul, choice, score] = results;
    expect(noul).toMatchObject({ type: "noul", noul: 0.97, confidence: 0.97, model: "jev-1.13.0" });
    expect(choice).toMatchObject({ type: "choice", choice: "data-table", confidence: 0.91 });
    // Unmentioned options are filled in so probabilities cover every option.
    expect(choice.type === "choice" && Object.keys(choice.probabilities)).toHaveLength(6);
    expect(score).toMatchObject({ type: "score", score: 1.7 });
    expect(score.type === "score" && score.probabilities["2"]).toBeCloseTo(0.72);
  });

  it("unwraps the REST { result } envelope and sends the account's credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: jevOutput, success: true }), { status: 200 })
    );
    const provider = new JevProvider({
      kind: "rest",
      accountId: "acct",
      apiToken: "tok",
      fetch: fetchMock as unknown as typeof fetch,
    });
    const results = await provider.evaluate(state, sample);
    expect(results).toHaveLength(3);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acct/ai/run");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body).model).toBe("typesafe/jev");
  });

  it("reports a rejected token clearly", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("nope", { status: 401 }));
    const provider = new JevProvider({
      kind: "rest",
      accountId: "acct",
      apiToken: "bad",
      fetch: fetchMock as unknown as typeof fetch,
    });
    await expect(provider.evaluate(state, sample)).rejects.toThrow(/Cloudflare token was rejected/);
  });

  it("rejects missing answers and mismatched types", async () => {
    const missing = vi.fn().mockResolvedValue({ answers: {} });
    await expect(
      new JevProvider({ kind: "binding", ai: { run: missing } }).evaluate(state, [noulQ])
    ).rejects.toThrow(/no answer/);

    const wrongType = vi.fn().mockResolvedValue({
      answers: { data_volume_high: { type: "score", score: 1 } },
    });
    await expect(
      new JevProvider({ kind: "binding", ai: { run: wrongType } }).evaluate(state, [noulQ])
    ).rejects.toThrow(/expected noul/);
  });
});

describe("LlmDecisionProvider", () => {
  it("computes choice, score and confidence from the LLM's probabilities", async () => {
    const generate = vi.fn().mockResolvedValue({
      source: "anthropic",
      model: "claude-sonnet-5",
      data: {
        answers: {
          "data.volume.high": { noul: 0.2 },
          // Unnormalized on purpose: the provider normalizes.
          "decision.data-presentation": {
            probabilities: { "data-table": 6, "card-grid": 2, list: 2, timeline: 0, kanban: 0, chart: 0 },
          },
          "risk.error-cost": { probabilities: { "0": 0, "1": 0.5, "2": 0.5 } },
        },
      },
    }) as unknown as typeof generateStructured;

    const provider = new LlmDecisionProvider({ provider: "anthropic", apiKey: "k" }, generate);
    const [noul, choice, score] = await provider.evaluate(state, sample);

    expect(noul).toMatchObject({ type: "noul", noul: 0.2, confidence: 0.8, provider: "llm" });
    expect(noul.model).toBe("anthropic:claude-sonnet-5");
    expect(choice).toMatchObject({ type: "choice", choice: "data-table" });
    expect(choice.confidence).toBeCloseTo(0.6);
    expect(score.type === "score" && score.score).toBeCloseTo(1.5);
  });
});
