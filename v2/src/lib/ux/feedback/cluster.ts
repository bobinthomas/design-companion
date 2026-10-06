import { FEEDBACK_KNOWLEDGE } from "@/lib/knowledge";
import { FEEDBACK_ISSUE_KINDS, feedbackClusteringSchema, type FeedbackClustering, type FeedbackIssueKind } from "@/lib/schemas";

/**
 * Step 1 of PRD §25: raw feedback → UX issues. The LLM may group and quote,
 * never invent: every evidence quote must be found in the input, or the
 * output fails validation and the model is retried. Without an LLM, a
 * keyword clusterer drafts the grouping from the same knowledge file.
 */

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”«»„]/g, '"')
    .replace(/[‘’`]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when the quote (or each part of it around an ellipsis) appears in the input. */
export function quoteAppears(quote: string, input: string): boolean {
  const haystack = normalize(input);
  const parts = normalize(quote)
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .split(/\.\.\.|…/)
    .map((p) => p.trim().replace(/^[.,;:!?-]+|[.,;:!?-]+$/g, "").trim())
    .filter((p) => p.length > 0);
  return parts.length > 0 && parts.every((p) => haystack.includes(p));
}

/** The clustering contract for this input: valid shape, unique ids, and only real quotes. */
export function buildClusteringSchema(input: string) {
  return feedbackClusteringSchema.superRefine((c, ctx) => {
    const ids = c.issues.map((i) => i.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: ["issues"], message: "Issue ids must be unique" });
    c.issues.forEach((issue, i) =>
      issue.evidence.forEach((q, j) => {
        if (!quoteAppears(q, input)) {
          ctx.addIssue({ code: "custom", path: ["issues", i, "evidence", j], message: `Not found in the feedback, quote it verbatim: "${q.slice(0, 80)}"` });
        }
      })
    );
    c.positives.forEach((p, i) =>
      p.evidence.forEach((q, j) => {
        if (!quoteAppears(q, input)) ctx.addIssue({ code: "custom", path: ["positives", i, "evidence", j], message: `Not found in the feedback: "${q.slice(0, 80)}"` });
      })
    );
  });
}

export const FEEDBACK_SYSTEM_PROMPT = `You group raw product feedback (interview notes, survey answers, support tickets, usability observations) into UX issues.

You only group and quote. You do not judge severity, frequency or priority, and you do not recommend fixes; that is done afterwards.

Rules:
- Every evidence item is a VERBATIM quote copied from the feedback (you may shorten with "…"). Quotes that aren't in the input are rejected.
- Never create an issue without evidence in the input. Merge comments that describe the same underlying problem.
- Choose the issue kind from: ${FEEDBACK_ISSUE_KINDS.join(", ")}.
- Title: the problem in users' terms, e.g. "Can't find the export". Summary: one or two neutral sentences.
- List positive signals separately, with quotes.
- Suggest up to 3 questions worth researching next.

Return JSON only:
{
  "issues": [ { "id": "kebab-case", "title": string, "kind": string, "summary": string, "evidence": [string] } ],
  "positives": [ { "title": string, "evidence": [string] } ],
  "nextQuestions": [string]
}`;

export function buildFeedbackUserPrompt(input: string, product?: string): string {
  return `${product ? `Product: ${product}\n\n` : ""}Feedback:\n"""\n${input.trim()}\n"""\n\nGroup it into UX issues as JSON.`;
}

function hits(text: string, keywords: readonly string[]): number {
  return keywords.filter((k) => text.includes(k)).length;
}

/** Splits feedback into short, quotable fragments: lines, then sentences. */
export function fragments(input: string): string[] {
  return input
    .split(/\r?\n/)
    .flatMap((line) => line.replace(/^\s*[-*•\d.)]+\s*/, "").split(/(?<=[.!?])\s+(?=[A-Z"“])/))
    .map((s) => s.trim().replace(/^["“]|["”]$/g, ""))
    // Headings ("Interview notes, managers:") label the input; they aren't feedback.
    .filter((s) => s.length >= 8 && !s.endsWith(":"));
}

/** Keyword clustering for the no-LLM draft. Crude, but every quote is real. */
export function draftClusters(input: string): FeedbackClustering {
  const byKind = new Map<FeedbackIssueKind, string[]>();
  const positives: string[] = [];
  for (const fragment of fragments(input)) {
    const lower = fragment.toLowerCase();
    let best: FeedbackIssueKind | undefined;
    let bestHits = 0;
    for (const kind of FEEDBACK_ISSUE_KINDS) {
      const n = hits(lower, FEEDBACK_KNOWLEDGE.kinds[kind].keywords);
      if (n > bestHits) {
        best = kind;
        bestHits = n;
      }
    }
    if (best) byKind.set(best, [...(byKind.get(best) ?? []), fragment]);
    else if (hits(lower, FEEDBACK_KNOWLEDGE.positiveKeywords) > 0) positives.push(fragment);
    else byKind.set("other", [...(byKind.get("other") ?? []), fragment]);
  }

  const issues = [...byKind.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 12)
    .map(([kind, quotes]) => ({
      id: kind,
      title: FEEDBACK_KNOWLEDGE.kinds[kind].label,
      kind,
      summary: `${quotes.length} comment${quotes.length === 1 ? "" : "s"} grouped by keywords as "${FEEDBACK_KNOWLEDGE.kinds[kind].label.toLowerCase()}".`,
      evidence: quotes.slice(0, 8).map((q) => q.slice(0, 300)),
    }));

  return {
    issues,
    positives: positives.length > 0 ? [{ title: "What people liked", evidence: positives.slice(0, 6).map((q) => q.slice(0, 300)) }] : [],
    nextQuestions: [],
  };
}
