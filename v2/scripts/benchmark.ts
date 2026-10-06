import fs from "node:fs";
import path from "node:path";
import { BENCHMARK_CASES, renderReport, runBenchmark } from "@/lib/benchmark/run";
import type { ArmId } from "@/lib/benchmark/arms";
import { DEFAULT_DESIGN_SYSTEM } from "@/lib/design-system/default";

/**
 * npm run benchmark [-- --runs 3 --arms A,B,C --cases expense-review]
 *
 * LLM: ANTHROPIC_API_KEY (and optionally ANTHROPIC_MODEL). Without it, only arm C runs, on demo states.
 * Decision model: CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN for Jev over REST; otherwise the LLM, then the mock.
 * Writes docs/BENCHMARK.md and benchmark/results/<timestamp>.json.
 */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const runs = Number(arg("runs") ?? 3);
  const arms = (arg("arms") ?? "A,B,C").split(",").map((a) => a.trim().toUpperCase()) as ArmId[];
  const caseIds = arg("cases")?.split(",");
  const cases = caseIds ? BENCHMARK_CASES.filter((c) => caseIds.includes(c.id)) : BENCHMARK_CASES;
  const { CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_API_TOKEN: apiToken } = process.env;

  const report = await runBenchmark({
    cases,
    runs,
    arms,
    deps: {
      designSystem: DEFAULT_DESIGN_SYSTEM,
      ctx: { env: {}, ip: "benchmark", ...(accountId && apiToken ? { cloudflare: { accountId, apiToken } } : {}) },
    },
    log: (line) => console.log(line),
  });

  const root = path.join(import.meta.dirname, "..");
  const resultsDir = path.join(root, "benchmark", "results");
  fs.mkdirSync(resultsDir, { recursive: true });
  const json = path.join(resultsDir, `${report.startedAt.replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(json, JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(root, "docs", "BENCHMARK.md"), renderReport(report));
  console.log(`Wrote docs/BENCHMARK.md and ${path.relative(root, json)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
