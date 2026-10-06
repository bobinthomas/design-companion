import { resolveLlmConfig } from "@/lib/ai/generate";
import { KNOWLEDGE_VERSIONS } from "@/lib/knowledge";
import { uxStateSchema, type PolicyOutcome, type UXState } from "@/lib/schemas";
import { analyzeState } from "@/lib/ux/analyze";
import { expenseDashboardState } from "@/lib/ux/fixtures/expense-dashboard";
import { subscriptionSignupState } from "@/lib/ux/fixtures/subscription-signup";
import { ARM_LABELS, runArm, type ArmDeps, type ArmId } from "@/lib/benchmark/arms";
import { componentRepeatability, decisionStability, measure, type RunMetrics } from "@/lib/benchmark/metrics";

/** PRD §40 benchmark runner: every arm × every case × N runs, measured identically. */

export interface BenchmarkCase {
  id: string;
  brief: string;
  /** Demo state used by C, and as the evaluation reference, when there's no LLM. */
  fallbackState: UXState;
}

export const BENCHMARK_CASES: BenchmarkCase[] = [
  { id: "expense-review", brief: expenseDashboardState.brief, fallbackState: uxStateSchema.parse(expenseDashboardState) },
  { id: "subscription-signup", brief: subscriptionSignupState.brief, fallbackState: uxStateSchema.parse(subscriptionSignupState) },
];

export interface ArmSummary {
  arm: ArmId;
  label: string;
  status: "ran" | "skipped";
  skipReason?: string;
  runs: RunMetrics[];
  mean?: Omit<RunMetrics, "ok" | "error" | "model" | "components" | "decisions"> & { validOutputRate: number };
  componentRepeatability?: number;
  decisionStability?: number;
}

export interface BenchmarkReport {
  startedAt: string;
  llm: string;
  decisionModel: string;
  runsPerArm: number;
  versions: typeof KNOWLEDGE_VERSIONS;
  designSystem: { id: string; version: string };
  cases: { id: string; brief: string; referenceSource: "llm" | "demo"; arms: ArmSummary[] }[];
}

function summarize(runs: RunMetrics[]): ArmSummary["mean"] {
  const ok = runs.filter((r) => r.ok);
  if (ok.length === 0) return undefined;
  const avg = (f: (r: RunMetrics) => number) => ok.reduce((s, r) => s + f(r), 0) / ok.length;
  return {
    validOutputRate: ok.length / runs.length,
    latencyMs: avg((r) => r.latencyMs),
    directions: avg((r) => r.directions),
    componentValidity: avg((r) => r.componentValidity),
    componentRefs: avg((r) => r.componentRefs),
    explainability: avg((r) => r.explainability),
    policyConformance: avg((r) => r.policyConformance),
    criticalFailures: avg((r) => r.criticalFailures),
    evaluationScore: avg((r) => r.evaluationScore),
    statesCoverage: avg((r) => r.statesCoverage),
  };
}

export interface BenchmarkOptions {
  cases?: BenchmarkCase[];
  runs?: number;
  arms?: ArmId[];
  deps: ArmDeps;
  now?: () => number;
  log?: (line: string) => void;
}

export async function runBenchmark({ cases = BENCHMARK_CASES, runs = 3, arms = ["A", "B", "C"], deps, now = Date.now, log = () => undefined }: BenchmarkOptions): Promise<BenchmarkReport> {
  const llm = resolveLlmConfig(deps.clientConfig);
  const report: BenchmarkReport = {
    startedAt: new Date(now()).toISOString(),
    llm: llm ? `${llm.provider}:${llm.model ?? "default"}` : "none",
    decisionModel: "",
    runsPerArm: runs,
    versions: KNOWLEDGE_VERSIONS,
    designSystem: { id: deps.designSystem.id, version: deps.designSystem.version },
    cases: [],
  };

  for (const c of cases) {
    // The reference reading of the brief that every arm is evaluated against.
    const caseDeps = { ...deps, fallbackState: c.fallbackState };
    const reference = await referenceFor(c, caseDeps);
    report.decisionModel ||= reference.decisionModel;
    const summaries: ArmSummary[] = [];

    for (const arm of arms) {
      if ((arm === "A" || arm === "B") && !llm) {
        summaries.push({ arm, label: ARM_LABELS[arm], status: "skipped", skipReason: "needs an LLM key (ANTHROPIC_API_KEY)", runs: [] });
        continue;
      }
      const results: RunMetrics[] = [];
      for (let i = 0; i < runs; i++) {
        const start = now();
        try {
          const out = await runArm(arm, c.brief, caseDeps);
          const latencyMs = now() - start;
          results.push(await measure(out.output, reference, deps.designSystem, deps.ctx, { latencyMs, model: out.model, outcome: out.outcome }));
          log(`${c.id} ${arm} run ${i + 1}: ok in ${latencyMs} ms`);
        } catch (error) {
          results.push({
            ok: false,
            error: error instanceof Error ? error.message.slice(0, 300) : "failed",
            latencyMs: now() - start,
            directions: 0,
            componentValidity: 0,
            componentRefs: 0,
            explainability: 0,
            policyConformance: 0,
            criticalFailures: 0,
            evaluationScore: 0,
            statesCoverage: 0,
            components: [],
          });
          log(`${c.id} ${arm} run ${i + 1}: FAILED ${error instanceof Error ? error.message.slice(0, 120) : ""}`);
        }
      }
      summaries.push({
        arm,
        label: ARM_LABELS[arm],
        status: "ran",
        runs: results,
        mean: summarize(results),
        componentRepeatability: componentRepeatability(results),
        decisionStability: arm === "C" ? decisionStability(results) : undefined,
      });
    }
    report.cases.push({ id: c.id, brief: c.brief, referenceSource: reference.source, arms: summaries });
  }
  return report;
}

async function referenceFor(c: BenchmarkCase, deps: ArmDeps): Promise<{ state: UXState; outcome: PolicyOutcome; source: "llm" | "demo"; decisionModel: string }> {
  // With an LLM, the reference is C's own reading of the brief; without, the demo state.
  const llm = resolveLlmConfig(deps.clientConfig);
  let state = c.fallbackState;
  let source: "llm" | "demo" = "demo";
  if (llm) {
    const { extractState } = await import("@/lib/ux/state/extract");
    try {
      state = (await extractState(c.brief, deps.clientConfig, deps.generate)).state;
      source = "llm";
    } catch {
      // A failed extraction shouldn't sink the run: fall back to the demo reading, which the report says.
    }
  }
  const a = await analyzeState({ state, overrides: [], gapSettlements: [], designSystem: deps.designSystem, ctx: deps.ctx });
  const { state: _s, questions: _q, results: _r, decisionModel, ...outcome } = a;
  return { state, outcome, source, decisionModel: `${decisionModel.provider} (${decisionModel.model})` };
}

const pct = (x?: number) => (x === undefined ? "—" : `${Math.round(x * 100)}%`);
const num = (x?: number, d = 1) => (x === undefined ? "—" : x.toFixed(d));

/** docs/BENCHMARK.md */
export function renderReport(r: BenchmarkReport): string {
  const out: string[] = [
    "# Benchmark: does separating UX judgment from generation help?",
    "",
    "> Generated by `npm run benchmark`. Do not edit by hand; re-run it.",
    "",
    "PRD §40 asks: **does separating UX judgment from generative interface generation improve the consistency, explainability, usability, accessibility and design-system compliance of AI-generated interfaces?**",
    "",
    "| Arm | Pipeline |",
    "|---|---|",
    "| A — LLM only | brief → LLM → directions |",
    "| B — LLM + design system | brief + the design system's component catalogue → LLM (registry ids enforced) → directions |",
    "| C — Decision-guided | brief → UX state → decision model → UX policy → design system → LLM → directions |",
    "",
    `Run ${r.startedAt} · LLM: **${r.llm}** · decision model: **${r.decisionModel}** · ${r.runsPerArm} runs per arm per case · design system ${r.designSystem.id} ${r.designSystem.version} · rules ${r.versions.rules} · evaluator ${r.versions.evaluator}`,
    "",
  ];
  if (r.llm === "none") {
    out.push(
      "> **Arms A and B were not run: no LLM key was configured.** Only arm C ran, on the demo states with template drafts. This report checks that the harness works; it does **not** answer the research question. Run `ANTHROPIC_API_KEY=… npm run benchmark` for a real comparison.",
      ""
    );
  }
  if (/mock/.test(r.decisionModel)) {
    out.push("> The decision model was the keyword mock, so evaluation scores and C's decisions reflect demo judgments, not Jev.", "");
  }

  for (const c of r.cases) {
    out.push(`## ${c.id}`, "", `Brief: *${c.brief}* · evaluated against the ${c.referenceSource === "llm" ? "LLM-extracted" : "demo"} state`, "");
    out.push(
      "| Metric | " + c.arms.map((a) => `${a.arm} — ${a.label}`).join(" | ") + " |",
      "|---|" + c.arms.map(() => "---").join("|") + "|"
    );
    const row = (name: string, f: (a: ArmSummary) => string) => out.push(`| ${name} | ${c.arms.map((a) => (a.status === "skipped" ? "not run" : f(a))).join(" | ")} |`);
    row("Valid structured output", (a) => pct(a.mean?.validOutputRate ?? 0));
    row("Design-system component validity", (a) => pct(a.mean?.componentValidity));
    row("Required states shown (loading, empty, error)", (a) => pct(a.mean?.statesCoverage));
    row("Critical / protection failures per run", (a) => num(a.mean?.criticalFailures));
    row("UX evaluation score (0–100)", (a) => num(a.mean?.evaluationScore, 0));
    row("Explainability (cites decisions and rules)", (a) => pct(a.mean?.explainability));
    row("Policy conformance ⚠", (a) => pct(a.mean?.policyConformance));
    row("Component repeatability (Jaccard)", (a) => num(a.componentRepeatability, 2));
    row("Decision stability", (a) => (a.arm === "C" ? pct(a.decisionStability) : "n/a"));
    row("Mean latency", (a) => (a.mean ? `${Math.round(a.mean.latencyMs)} ms` : "—"));
    const failures = c.arms.flatMap((a) => a.runs.filter((x) => !x.ok).map((x) => `${a.arm}: ${x.error}`));
    if (failures.length > 0) out.push("", "Failures:", ...failures.map((f) => `- ${f}`));
    out.push("");
  }

  out.push(
    "## How to read this",
    "",
    "- **Design-system component validity:** the share of component references that exist in the design system. A invents names freely; B and C are held to the registry by their schemas.",
    "- **Critical / protection failures:** failed critical checks plus destructive actions shown without confirmation or undo, judged against the reference decisions.",
    "- **UX evaluation score:** the product's own evaluator (15 atomic questions plus checks), the same for all arms.",
    "- **Explainability:** a direction counts when it cites a decided slot *and* a rule that actually fired. A and B have no decisions to cite, which is the point of the comparison, not a flaw in them.",
    "- **⚠ Policy conformance** measures agreement with C's own decisions, so it favours C by construction. Read it as \"how much of the decided structure each arm happens to show\", not as quality.",
    "- **Repeatability:** mean pairwise Jaccard similarity of the component sets across runs; **decision stability** is the share of decision slots that got the same choice in every run.",
    "- **Same judge:** with an LLM and no Jev, the evaluation questions are answered by the same LLM that generated A and B. A real study should use Jev, or a different model, as the judge, plus expert designers (PRD §44, inter-rater agreement).",
    ""
  );
  return out.join("\n");
}
