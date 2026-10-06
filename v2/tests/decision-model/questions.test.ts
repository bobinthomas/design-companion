import { describe, expect, it } from "vitest";
import { ANALYSIS_QUESTIONS } from "@/lib/knowledge";
import { DECISION_OPTIONS, type DecisionQuestion } from "@/lib/schemas";

/** Knowledge lint for the decision question registry. */

function answerKeys(q: DecisionQuestion): string[] {
  if (q.type === "noul") return ["true", "false"];
  if (q.type === "choice") return Object.keys(q.criteria);
  return q.criteria.map((_, i) => String(i));
}

describe("analysis question set", () => {
  it("has 10–30 questions with unique ids", () => {
    const ids = ANALYSIS_QUESTIONS.map((q) => q.id);
    expect(ids.length).toBeGreaterThanOrEqual(10);
    expect(ids.length).toBeLessThanOrEqual(30);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(ANALYSIS_QUESTIONS.map((q) => [q.id, q] as const))(
    "%s has valid mock hints",
    (_id, q) => {
      expect(q.mock, "every question needs mock hints for the no-key demo").toBeDefined();
      const keys = answerKeys(q);
      expect(keys).toContain(q.mock!.default);
      for (const key of Object.keys(q.mock!.keywords)) {
        expect(keys).toContain(key);
      }
    }
  );

  it("uses self-describing choice option ids (decision models follow the option name)", () => {
    for (const q of ANALYSIS_QUESTIONS) {
      if (q.type !== "choice") continue;
      for (const option of Object.keys(q.criteria)) {
        expect(option, `${q.id}: "${option}"`).not.toMatch(/^([a-z]|option-?\d+|\d+|yes|no)$/);
        expect(option.length, `${q.id}: "${option}"`).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it("links decision-prior choice questions only to options of that decision slot", () => {
    for (const q of ANALYSIS_QUESTIONS) {
      if (q.type !== "choice" || !q.decision) continue;
      const allowed = DECISION_OPTIONS[q.decision] as readonly string[];
      for (const option of Object.keys(q.criteria)) {
        expect(allowed, `${q.id} → ${q.decision}`).toContain(option);
      }
    }
  });
});
