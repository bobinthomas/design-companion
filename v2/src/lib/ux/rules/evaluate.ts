import { noulIs } from "@/lib/decision-model/confidence";
import { POLICY, UX_RULES } from "@/lib/knowledge";
import {
  ORDINAL_SCALES,
  type Condition,
  type DecisionEvidence,
  type DecisionQuestion,
  type DecisionResult,
  type FiredRule,
  type UXRule,
  type UXState,
  type When,
} from "@/lib/schemas";

/** Everything a condition can be evaluated against. */
export interface RuleContext {
  state: UXState;
  questions: ReadonlyMap<string, DecisionQuestion>;
  results: ReadonlyMap<string, DecisionResult>;
  noulThreshold?: number;
}

export function buildRuleContext(
  state: UXState,
  questions: readonly DecisionQuestion[],
  results: readonly DecisionResult[]
): RuleContext {
  return {
    state,
    questions: new Map(questions.map((q) => [q.id, q])),
    results: new Map(results.map((r) => [r.questionId, r])),
  };
}

/** A decision result rendered as Inspector evidence. */
export function toEvidence(result: DecisionResult, question?: DecisionQuestion): DecisionEvidence {
  return {
    questionId: result.questionId,
    question: question?.question ?? result.questionId,
    type: result.type,
    value: result.type === "noul" ? result.noul : result.type === "choice" ? result.choice : result.score,
    confidence: result.confidence,
    provider: result.provider,
  };
}

function factValue(state: UXState, path: string): string | undefined {
  const value = path.split(".").reduce<unknown>((node, key) => {
    return node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined;
  }, state);
  return typeof value === "string" ? value : undefined;
}

function ordinalCompare(a: string, b: string): number | undefined {
  const scale = ORDINAL_SCALES.find((s) => s.includes(a) && s.includes(b));
  return scale ? scale.indexOf(a) - scale.indexOf(b) : undefined;
}

export interface ConditionOutcome {
  matched: boolean;
  /** The question result consulted, if any — cited whether or not it matched. */
  evidence?: DecisionEvidence;
}

/**
 * Evaluates one condition. A question with no result never matches: absent
 * evidence is not evidence of anything.
 */
export function evaluateCondition(condition: Condition, ctx: RuleContext): ConditionOutcome {
  if ("fact" in condition) {
    const actual = factValue(ctx.state, condition.fact);
    if (actual === undefined) return { matched: false };
    const value = condition.value;
    switch (condition.op) {
      case "eq":
        return { matched: actual === value };
      case "neq":
        return { matched: actual !== value };
      case "in":
        return { matched: Array.isArray(value) ? value.includes(actual) : actual === value };
      case "notIn":
        return { matched: Array.isArray(value) ? !value.includes(actual) : actual !== value };
      case "gte":
      case "lte": {
        if (Array.isArray(value)) return { matched: false };
        const cmp = ordinalCompare(actual, value);
        if (cmp === undefined) return { matched: false };
        return { matched: condition.op === "gte" ? cmp >= 0 : cmp <= 0 };
      }
    }
  }

  const result = ctx.results.get(condition.question);
  if (!result) return { matched: false };
  const evidence = toEvidence(result, ctx.questions.get(condition.question));

  if ("is" in condition) {
    if (result.type !== "noul") return { matched: false, evidence };
    const threshold = condition.min ?? ctx.noulThreshold ?? POLICY.noulTrueThreshold;
    return { matched: noulIs(result, condition.is === "true", threshold), evidence };
  }
  if ("choice" in condition) {
    if (result.type !== "choice") return { matched: false, evidence };
    const probability = result.probabilities[condition.choice] ?? 0;
    const matched = result.choice === condition.choice && probability >= (condition.min ?? 0);
    return { matched, evidence };
  }
  if (result.type !== "score") return { matched: false, evidence };
  if ("scoreGte" in condition) return { matched: result.score >= condition.scoreGte, evidence };
  return { matched: result.score <= condition.scoreLte, evidence };
}

export interface WhenOutcome {
  matched: boolean;
  evidence: DecisionEvidence[];
}

/** all → every condition; any → at least one (when present); none → no condition. */
export function evaluateWhen(when: When, ctx: RuleContext): WhenOutcome {
  const evidence: DecisionEvidence[] = [];
  const cite = (o: ConditionOutcome) => {
    if (o.evidence && !evidence.some((e) => e.questionId === o.evidence!.questionId)) {
      evidence.push(o.evidence);
    }
  };

  for (const c of when.all ?? []) {
    const o = evaluateCondition(c, ctx);
    if (!o.matched) return { matched: false, evidence: [] };
    cite(o);
  }
  if (when.any && when.any.length > 0) {
    const matches = when.any.map((c) => evaluateCondition(c, ctx)).filter((o) => o.matched);
    if (matches.length === 0) return { matched: false, evidence: [] };
    matches.forEach(cite);
  }
  for (const c of when.none ?? []) {
    const o = evaluateCondition(c, ctx);
    if (o.matched) return { matched: false, evidence: [] };
    // The non-match is itself evidence (e.g. "records are NOT visual").
    cite(o);
  }
  return { matched: true, evidence };
}

export interface FiringRule {
  rule: UXRule;
  evidence: DecisionEvidence[];
}

/** Every rule whose `when` matches, with the evidence that made it match. */
export function fireRules(ctx: RuleContext, rules: readonly UXRule[] = UX_RULES): FiringRule[] {
  return rules.flatMap((rule) => {
    const outcome = evaluateWhen(rule.when, ctx);
    return outcome.matched ? [{ rule, evidence: outcome.evidence }] : [];
  });
}

export function toFiredRule({ rule, evidence }: FiringRule): FiredRule {
  return {
    ruleId: rule.id,
    code: rule.code,
    tier: rule.tier,
    priority: rule.priority,
    decision: rule.decision,
    evidence,
  };
}
