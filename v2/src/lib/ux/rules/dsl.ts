import { ANALYSIS_QUESTIONS } from "@/lib/knowledge";
import { DECISION_LABELS, type Condition, type UXPattern, type UXRule } from "@/lib/schemas";

/**
 * PRD §30 UX Decision DSL — a designer-readable rendering of a rule:
 *
 *   WHEN    Is the expected data volume high?  is true
 *   AND NOT Are records primarily recognized visually?  is true
 *   RECOMMEND data-table  (Data presentation)
 *   AVOID     card-grid
 *   BECAUSE   Many text-and-number records are scanned fastest…
 *
 * Read-only for now: the JSON stays the source of truth, and this is
 * generated from it, so the two can't drift.
 */

const questionText = new Map(ANALYSIS_QUESTIONS.map((q) => [q.id, q.question]));

export function renderCondition(c: Condition): string {
  if ("fact" in c) {
    const value = Array.isArray(c.value) ? c.value.join(" | ") : c.value;
    const op = { eq: "is", neq: "is not", in: "is one of", notIn: "is not one of", gte: "is at least", lte: "is at most" }[c.op];
    return `${c.fact} ${op} ${value}`;
  }
  const q = questionText.get(c.question) ?? c.question;
  if ("is" in c) return `${q}  is ${c.is}${c.min !== undefined ? ` (≥ ${c.min})` : ""}`;
  if ("choice" in c) return `${q}  = ${c.choice}${c.min !== undefined ? ` (p ≥ ${c.min})` : ""}`;
  return "scoreGte" in c ? `${q}  score ≥ ${c.scoreGte}` : `${q}  score ≤ ${c.scoreLte}`;
}

function renderWhen(rule: UXRule | { when: UXRule["when"] }): string[] {
  const lines: string[] = [];
  let first = true;
  const push = (keyword: string, c: Condition) => {
    lines.push(`${(first ? `WHEN${keyword ? ` ${keyword}` : ""}` : `AND${keyword ? ` ${keyword}` : ""}`).padEnd(10)}${renderCondition(c)}`);
    first = false;
  };
  for (const c of rule.when.all ?? []) push("", c);
  const any = rule.when.any ?? [];
  if (any.length === 1) push("", any[0]);
  if (any.length > 1) {
    lines.push(`${(first ? "WHEN ANY" : "AND ANY").padEnd(10)}of:`);
    first = false;
    for (const c of any) lines.push(`${"".padEnd(12)}• ${renderCondition(c)}`);
  }
  for (const c of rule.when.none ?? []) push("NOT", c);
  return lines;
}

export function renderRule(rule: UXRule): string {
  const lines = [`RULE ${rule.id}   [${rule.code} · ${rule.tier} · ${rule.priority}]`, ...renderWhen(rule)];
  if (rule.decision && rule.recommend.length > 0) {
    lines.push(`${"RECOMMEND".padEnd(10)}${rule.recommend.join(" or ")}   (${DECISION_LABELS[rule.decision]})`);
  }
  if (rule.decision && rule.avoid.length > 0) {
    const verb = rule.priority === "critical" ? "RULE OUT" : "AVOID";
    lines.push(`${verb.padEnd(10)}${rule.avoid.join(", ")}${rule.recommend.length === 0 ? `   (${DECISION_LABELS[rule.decision]})` : ""}`);
  }
  if (rule.requiresCapabilities.length > 0) lines.push(`${"REQUIRE".padEnd(10)}${rule.requiresCapabilities.join(", ")}`);
  if (rule.requiresStates.length > 0) lines.push(`${"STATES".padEnd(10)}${rule.requiresStates.join(", ")}`);
  lines.push(`${"BECAUSE".padEnd(10)}${rule.reason}`);
  if (rule.source) lines.push(`${"SOURCE".padEnd(10)}${rule.source}`);
  return lines.join("\n");
}

export function renderPattern(pattern: UXPattern): string {
  const lines = [`PATTERN ${pattern.id}   [${pattern.name}]`, `${"PURPOSE".padEnd(10)}${pattern.purpose}`];
  pattern.recommendedWhen.forEach((c, i) => lines.push(`${(i === 0 ? "FITS WHEN" : "OR").padEnd(10)}${renderCondition(c)}`));
  for (const f of pattern.fitsDecisions) {
    lines.push(`${"MATCHES".padEnd(10)}${DECISION_LABELS[f.decision]} = ${f.choices.join(" | ")}`);
  }
  lines.push(`${"NEEDS".padEnd(10)}${pattern.requiredCapabilities.length ? pattern.requiredCapabilities.join(", ") : "(no specific capability)"}`);
  if (pattern.optionalCapabilities.length) lines.push(`${"MAY USE".padEnd(10)}${pattern.optionalCapabilities.join(", ")}`);
  lines.push(`${"STATES".padEnd(10)}${pattern.requiredStates.join(", ")}`);
  if (pattern.composesWith.length) lines.push(`${"WITH".padEnd(10)}${pattern.composesWith.join(", ")}`);
  for (const a of pattern.antiPatterns) lines.push(`${"AVOID".padEnd(10)}${a}`);
  return lines.join("\n");
}
