import { UX_PATTERNS } from "@/lib/knowledge";
import { evaluateCondition, type RuleContext } from "@/lib/ux/rules/evaluate";
import type { PatternMatch, UXDecision, UXPattern } from "@/lib/schemas";

/** Minimum fit for a pattern to be part of the solution. */
export const PATTERN_THRESHOLD = 0.5;

interface Scored {
  pattern: UXPattern;
  score: number;
  matchedQuestions: string[];
  matchedDecisions: string[];
}

/**
 * PRD §19 pattern resolution: patterns are scored by evidence (their
 * `recommendedWhen` conditions, evaluated like rule conditions) and by
 * compatibility with the decisions policy already made. No LLM opinion is
 * involved. The best fit is primary; other fitting patterns support it.
 */
export function resolvePatterns(
  ctx: RuleContext,
  decisions: readonly UXDecision[],
  patterns: readonly UXPattern[] = UX_PATTERNS
): PatternMatch[] {
  const chosen = new Map(decisions.map((d) => [d.decision, d.result.choice as string]));

  const scored: Scored[] = patterns.map((pattern) => {
    const matchedQuestions = pattern.recommendedWhen
      .map((c) => ({ c, o: evaluateCondition(c, ctx) }))
      .filter(({ o }) => o.matched)
      .map(({ c }) => ("question" in c ? c.question : c.fact));
    const matchedDecisions = pattern.fitsDecisions
      .filter((f) => f.choices.includes(chosen.get(f.decision) as never))
      .map((f) => `${f.decision}=${chosen.get(f.decision)}`);

    const parts: number[] = [];
    if (pattern.recommendedWhen.length > 0) parts.push(matchedQuestions.length / pattern.recommendedWhen.length);
    if (pattern.fitsDecisions.length > 0) parts.push(matchedDecisions.length / pattern.fitsDecisions.length);
    const score = parts.length > 0 ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
    return { pattern, score, matchedQuestions, matchedDecisions };
  });

  const fitting = scored
    .filter((s) => s.score >= PATTERN_THRESHOLD)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.matchedDecisions.length - a.matchedDecisions.length ||
        b.matchedQuestions.length - a.matchedQuestions.length ||
        patterns.indexOf(a.pattern) - patterns.indexOf(b.pattern)
    );

  return fitting.map((s, i) => ({
    pattern: s.pattern.id,
    name: s.pattern.name,
    score: Math.round(s.score * 100) / 100,
    role: i === 0 ? "primary" : "supporting",
    matchedQuestions: s.matchedQuestions,
    matchedDecisions: s.matchedDecisions,
  }));
}
