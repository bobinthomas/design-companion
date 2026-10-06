import { generateStructured, resolveLlmConfig } from "@/lib/ai/generate";
import type { ProviderClientConfig } from "@/lib/ai/providers";
import { evaluateDecisions, type DecisionContext } from "@/lib/decision-model/evaluate";
import { FEEDBACK_KNOWLEDGE, FEEDBACK_QUESTIONS, KNOWLEDGE_VERSIONS } from "@/lib/knowledge";
import { evaluateWhen, toEvidence } from "@/lib/ux/rules/evaluate";
import type { DecisionQuestion, DecisionResult, FeedbackClustering, FeedbackIssue, FeedbackRun, UXState } from "@/lib/schemas";
import { buildClusteringSchema, buildFeedbackUserPrompt, draftClusters, FEEDBACK_SYSTEM_PROMPT } from "@/lib/ux/feedback/cluster";

/**
 * PRD §25 end to end: clustering (LLM or draft) → per-issue atomic
 * questions (one decision-model request) → feedback rules → priority, all
 * in code. Example from the PRD: "Users can't find the export function" →
 * is discoverability low? is export frequent? → surface it, or signpost it.
 */

type Cluster = FeedbackClustering["issues"][number];

export function buildFeedbackBatch(issues: readonly Cluster[], context?: UXState) {
  const solutions: Record<string, unknown> = {};
  const questions: DecisionQuestion[] = [];
  issues.forEach((issue, i) => {
    const key = `i${i + 1}`;
    solutions[key] = { title: issue.title, kind: issue.kind, summary: issue.summary, evidence: issue.evidence };
    for (const t of FEEDBACK_QUESTIONS) {
      questions.push({
        ...t,
        id: `${t.id}.${key}`,
        scope: `issues.${key}`,
        instructions: `Judge only the issue at issues.${key} ("${issue.title}"). ${t.instructions}`,
      });
    }
  });
  const product = context
    ? { product: context.product, users: `${context.user.role}: ${context.user.description}`, primaryTask: context.tasks.find((t) => t.kind === "primary")?.name }
    : undefined;
  return { state: { ...(product ? { product } : {}), issues: solutions }, questions };
}

/** Severity × reach → P0–P3, with the reason in words. */
export function prioritize(severity: number, blocks: boolean, frequent: boolean, mentions: number): { priority: FeedbackIssue["priority"]; reason: string } {
  const reach = frequent ? "in a frequent task" : mentions >= 3 ? `mentioned ${mentions} times` : "in a less frequent situation";
  if ((blocks && frequent) || severity >= 2.5) return { priority: "P0", reason: `${blocks ? "Stops people finishing" : "Blocking severity"}, ${reach}.` };
  if (blocks || severity >= 1.75) return { priority: "P1", reason: `${blocks ? "Stops people finishing" : "Major severity"}, ${reach}.` };
  if (severity >= 1 || frequent || mentions >= 3) return { priority: "P2", reason: `Slows or annoys people, ${reach}.` };
  return { priority: "P3", reason: "Cosmetic or rare." };
}

const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;

export function judgeIssues(issues: readonly Cluster[], results: readonly DecisionResult[], context?: UXState): FeedbackIssue[] {
  const byId = new Map(results.map((r) => [r.questionId, r]));
  const templates = new Map(FEEDBACK_QUESTIONS.map((q) => [q.id, q]));

  return issues
    .map((issue, i) => {
      const own = FEEDBACK_QUESTIONS.flatMap((q) => {
        const r = byId.get(`${q.id}.i${i + 1}`);
        return r ? [{ ...r, questionId: q.id }] : [];
      });
      const ctx = {
        state: (context ?? {}) as UXState,
        questions: templates,
        results: new Map(own.map((r) => [r.questionId, r])),
      };
      const isTrue = (id: string) => {
        const r = ctx.results.get(id);
        return r?.type === "noul" && r.noul >= 0.7;
      };
      const severityResult = ctx.results.get("fb.severity");
      const severity = severityResult?.type === "score" ? severityResult.score : 1;
      const { priority, reason } = prioritize(severity, isTrue("fb.blocks-task"), isTrue("fb.frequent"), issue.evidence.length);

      const recommendations = FEEDBACK_KNOWLEDGE.rules
        .filter((rule) => !rule.kinds || rule.kinds.includes(issue.kind))
        .filter((rule) => evaluateWhen(rule.when, ctx).matched)
        .map((rule) => ({ ruleId: rule.id, code: rule.code, text: rule.recommend, capabilities: rule.capabilities, relatedRules: rule.relatedRules }));

      return {
        id: issue.id,
        title: issue.title,
        kind: issue.kind,
        summary: issue.summary,
        evidence: issue.evidence,
        mentions: issue.evidence.length,
        judgments: own.map((r) => toEvidence(r, templates.get(r.questionId))),
        severity: Math.round(severity * 100) / 100,
        priority,
        priorityReason: reason,
        recommendations,
      };
    })
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.severity - a.severity || b.mentions - a.mentions);
}

export interface FeedbackInput {
  input: string;
  ctx: DecisionContext;
  context?: { sessionId: string; state: UXState };
  clientConfig?: ProviderClientConfig;
  decide?: typeof evaluateDecisions;
  generate?: typeof generateStructured;
  id?: string;
  now?: Date;
}

export async function summarizeFeedback({
  input,
  ctx,
  context,
  clientConfig,
  decide = evaluateDecisions,
  generate = generateStructured,
  id = crypto.randomUUID(),
  now = new Date(),
}: FeedbackInput): Promise<FeedbackRun> {
  const notices: string[] = [];
  let clusters: FeedbackClustering;
  let source: FeedbackRun["source"];
  let model: string;

  if (resolveLlmConfig(clientConfig)) {
    const r = await generate({
      systemPrompt: FEEDBACK_SYSTEM_PROMPT,
      userPrompt: buildFeedbackUserPrompt(input, context?.state.product),
      schema: buildClusteringSchema(input),
      clientConfig,
      maxTokens: 6000,
    });
    clusters = r.data;
    source = "llm";
    model = `${r.source}:${r.model}`;
  } else {
    clusters = draftClusters(input);
    source = "draft";
    model = "draft";
    notices.push("No LLM key is configured, so comments were grouped by keywords. Add a key in Settings for real clustering.");
  }

  const batch = buildFeedbackBatch(clusters.issues, context?.state);
  const run =
    batch.questions.length > 0
      ? await decide(batch.state, batch.questions, ctx)
      : { results: [], provider: "mock" as const, model: "none", notices: ["No issues were found, so the decision model wasn't asked."] };
  notices.push(...run.notices);

  return {
    id,
    createdAt: now.toISOString(),
    source,
    model,
    notices,
    decisionModel: { provider: run.provider, model: run.model },
    input,
    ...(context ? { context: { sessionId: context.sessionId, product: context.state.product } } : {}),
    issues: judgeIssues(clusters.issues, run.results, context?.state),
    positives: clusters.positives,
    nextQuestions: clusters.nextQuestions,
    results: run.results,
    versions: { feedbackRules: KNOWLEDGE_VERSIONS.feedbackRules, prompts: KNOWLEDGE_VERSIONS.prompts, decisionModel: run.model },
  };
}
