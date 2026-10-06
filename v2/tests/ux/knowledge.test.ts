import { describe, expect, it } from "vitest";
import { ANALYSIS_QUESTIONS, CAPABILITY_BY_ID, UX_PATTERNS, UX_RULES } from "@/lib/knowledge";
import { ACCESSIBILITY_LEVELS, AUDIENCES, DEVICES, EXPERTISE, FREQUENCIES, type Condition } from "@/lib/schemas";

/** Knowledge lint for the rule library and pattern registry. */

const questions = new Map(ANALYSIS_QUESTIONS.map((q) => [q.id, q]));

const FACT_VALUES: Record<string, readonly string[]> = {
  "user.expertise": EXPERTISE,
  "user.audience": AUDIENCES,
  "context.device": DEVICES,
  "context.frequency": FREQUENCIES,
  "constraints.accessibility": ACCESSIBILITY_LEVELS,
};

/** Returns a problem description, or undefined if the condition is well-formed. */
function conditionProblem(c: Condition): string | undefined {
  if ("fact" in c) {
    const allowed = FACT_VALUES[c.fact];
    const values = Array.isArray(c.value) ? c.value : [c.value];
    const bad = values.filter((v) => !allowed.includes(v));
    return bad.length ? `fact ${c.fact} has invalid value(s) ${bad.join(", ")}` : undefined;
  }
  const q = questions.get(c.question);
  if (!q) return `unknown question "${c.question}"`;
  if ("is" in c) return q.type === "noul" ? undefined : `${c.question} is ${q.type}, not noul`;
  if ("choice" in c) {
    if (q.type !== "choice") return `${c.question} is ${q.type}, not choice`;
    return c.choice in q.criteria ? undefined : `${c.question} has no option "${c.choice}"`;
  }
  if (q.type !== "score") return `${c.question} is ${q.type}, not score`;
  const threshold = "scoreGte" in c ? c.scoreGte : c.scoreLte;
  return threshold <= q.criteria.length - 1 ? undefined : `${c.question} threshold ${threshold} is above its top level`;
}

describe("UX rule library", () => {
  it("has 30–50 rules with unique ids and codes", () => {
    expect(UX_RULES.length).toBeGreaterThanOrEqual(30);
    expect(UX_RULES.length).toBeLessThanOrEqual(50);
    expect(new Set(UX_RULES.map((r) => r.id)).size).toBe(UX_RULES.length);
    expect(new Set(UX_RULES.map((r) => r.code)).size).toBe(UX_RULES.length);
  });

  it.each(UX_RULES.map((r) => [r.id, r] as const))("%s references valid questions, facts and capabilities", (_id, rule) => {
    const conditions = [...(rule.when.all ?? []), ...(rule.when.any ?? []), ...(rule.when.none ?? [])];
    for (const c of conditions) expect(conditionProblem(c)).toBeUndefined();
    for (const cap of rule.requiresCapabilities) expect(CAPABILITY_BY_ID.has(cap), cap).toBe(true);
  });

  it("puts accessibility rules in the accessibility tier", () => {
    for (const rule of UX_RULES.filter((r) => r.category === "accessibility")) {
      expect(rule.tier, rule.id).toBe("accessibility");
      expect(rule.source, `${rule.id} should cite its WCAG criterion`).toMatch(/WCAG/);
    }
  });
});

describe("UX pattern registry", () => {
  const ids = new Set(UX_PATTERNS.map((p) => p.id));

  it.each(UX_PATTERNS.map((p) => [p.id, p] as const))("%s references valid capabilities, questions and patterns", (_id, pattern) => {
    for (const cap of [...pattern.requiredCapabilities, ...pattern.optionalCapabilities]) {
      expect(CAPABILITY_BY_ID.has(cap), cap).toBe(true);
    }
    for (const c of pattern.recommendedWhen) expect(conditionProblem(c)).toBeUndefined();
    for (const other of pattern.composesWith) expect(ids.has(other), other).toBe(true);
  });
});
