import { evaluateDecisions, type DecisionContext } from "@/lib/decision-model/evaluate";
import { EVALUATOR, evaluationCategoryOf, KNOWLEDGE_VERSIONS } from "@/lib/knowledge";
import { toEvidence } from "@/lib/ux/rules/evaluate";
import {
  EVALUATION_CATEGORIES,
  type CategoryScore,
  type DecisionQuestion,
  type DecisionResult,
  type EvaluationCategory,
  type EvaluationIssue,
  type EvaluationRun,
  type PolicyOutcome,
  type UXEvaluation,
  type UXState,
} from "@/lib/schemas";
import { buildEvaluationBatch, type PreparedSubject } from "@/lib/ux/evaluate/batch";
import { runChecks, type CheckResult } from "@/lib/ux/evaluate/checks";

/**
 * PRD §27–28 UX Evaluate: atomic questions (decision model) + deterministic
 * checks (code), combined in code into 12 category scores and an overall
 * score. Every score cites the question results and checks behind it, and
 * every issue names exactly what produced it.
 */

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const;

/** 0..100: a noul probability, or a score's position on its rubric. */
export function questionValue(result: DecisionResult): number {
  if (result.type === "noul") return result.noul * 100;
  if (result.type === "score") return (result.score / Math.max(1, result.legend.length - 1)) * 100;
  return 0;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function questionIssue(template: DecisionQuestion, result: DecisionResult): EvaluationIssue | undefined {
  const config = EVALUATOR.questions[template.id];
  const value = questionValue(result) / 100;
  const category = evaluationCategoryOf(template);
  if (value < EVALUATOR.failBelow) {
    return { severity: config.severity, category, issue: config.issue, recommendation: config.recommendation, from: { questionId: template.id } };
  }
  if (result.type === "noul" && value < EVALUATOR.unsureBelow) {
    return {
      severity: "low",
      category,
      issue: `Possibly: ${config.issue.charAt(0).toLowerCase()}${config.issue.slice(1)}`,
      recommendation: config.recommendation,
      from: { questionId: template.id },
    };
  }
  return undefined;
}

function checkIssue(check: CheckResult): EvaluationIssue {
  return {
    severity: check.severity,
    category: check.category,
    issue: check.detail ? `${check.label}: no. ${check.detail}` : `${check.label}: no.`,
    recommendation: check.recommendation,
    from: { checkId: check.id, ...(check.ruleId ? { ruleId: check.ruleId } : {}), ...(check.gapId ? { gapId: check.gapId } : {}) },
    ...(check.location ? { location: check.location } : {}),
  };
}

/** Combines one subject's question results and checks into a UXEvaluation. */
export function aggregate(
  subjectId: string,
  answered: { template: DecisionQuestion; result: DecisionResult }[],
  checks: CheckResult[],
  versions: UXEvaluation["versions"]
): UXEvaluation {
  const categories = {} as Record<EvaluationCategory, CategoryScore>;
  for (const category of EVALUATION_CATEGORIES) {
    const qs = answered.filter((a) => evaluationCategoryOf(a.template) === category);
    const cs = checks.filter((c) => c.category === category);
    const q = qs.length > 0 ? mean(qs.map((a) => questionValue(a.result))) : undefined;
    const c = cs.length > 0 ? mean(cs.map((x) => (x.passed ? 100 : 0))) : undefined;
    let score = q !== undefined && c !== undefined ? EVALUATOR.questionShare * q + (1 - EVALUATOR.questionShare) * c : (q ?? c ?? 50);
    if (cs.some((x) => !x.passed && x.severity === "critical")) score = Math.min(score, EVALUATOR.criticalCategoryCap);
    categories[category] = {
      score: Math.round(score),
      evidence: qs.map((a) => ({ ...toEvidence(a.result, a.template), questionId: a.template.id })),
      checks: cs.map((x) => x.id),
    };
  }

  const weights = EVALUATOR.categoryWeights;
  const totalWeight = EVALUATION_CATEGORIES.reduce((sum, c) => sum + weights[c], 0);
  let overall = EVALUATION_CATEGORIES.reduce((sum, c) => sum + categories[c].score * weights[c], 0) / totalWeight;

  const issues = [
    ...checks.filter((c) => !c.passed).map(checkIssue),
    ...answered.flatMap((a) => questionIssue(a.template, a.result) ?? []),
  ].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  if (issues.some((i) => i.severity === "critical")) overall = Math.min(overall, EVALUATOR.criticalOverallCap);

  return {
    subjectId,
    overallScore: Math.round(overall),
    categories,
    issues,
    checks: checks.map(({ severity: _s, recommendation: _r, location: _l, ...check }) => check),
    versions,
  };
}

export interface EvaluationInput {
  state: UXState;
  outcome: PolicyOutcome;
  subjects: PreparedSubject[];
  ctx: DecisionContext;
  /** Injected for tests; defaults to the provider fallback chain. */
  decide?: typeof evaluateDecisions;
  id?: string;
  now?: Date;
}

/** Evaluates up to three subjects with one decision-model request. */
export async function evaluateSubjects({
  state,
  outcome,
  subjects,
  ctx,
  decide = evaluateDecisions,
  id = crypto.randomUUID(),
  now = new Date(),
}: EvaluationInput): Promise<EvaluationRun> {
  const batch = buildEvaluationBatch(state, outcome, subjects);
  const run = await decide(batch.state, batch.questions, ctx);
  const versions = { ...outcome.versions, decisionModel: run.model, evaluator: KNOWLEDGE_VERSIONS.evaluator };

  const evaluations = subjects.map((subject, i) => {
    const answered = run.results.flatMap((result) => {
      const entry = batch.index.get(result.questionId);
      return entry && entry.subject === i ? [{ template: entry.template, result }] : [];
    });
    return aggregate(subject.id, answered, runChecks(subject, outcome, state), versions);
  });

  const notices = [...run.notices];
  if (subjects.some((s) => s.kind === "description")) {
    notices.push("A description can only be judged by the decision model; structural checks need a generated direction.");
  }

  return {
    id,
    evaluatedAt: now.toISOString(),
    provider: run.provider,
    model: run.model,
    notices,
    subjects: subjects.map((s) => ({
      id: s.id,
      kind: s.kind,
      label: s.label,
      ...(s.kind === "direction" && s.layoutRunId ? { layoutRunId: s.layoutRunId } : {}),
      ...(s.kind === "description" ? { description: s.description } : {}),
    })),
    evaluations,
    results: run.results,
    basedOn: outcome.decisions.map((d) => ({ decision: d.decision, choice: d.result.choice })),
  };
}

