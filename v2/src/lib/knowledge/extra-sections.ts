import { COPY_GUIDELINES, COPY_QUESTIONS, FEEDBACK_KNOWLEDGE, FEEDBACK_QUESTIONS, KNOWLEDGE_VERSIONS } from "@/lib/knowledge";
import type { KnowledgeSection } from "@/lib/knowledge/browse";
import { renderCondition } from "@/lib/ux/rules/dsl";
import type { Condition, DecisionQuestion } from "@/lib/schemas";

/** Knowledge sections for UI Copy and Feedback Summary (PRD §24–25). */

const QUESTION_TEXT = new Map([...COPY_QUESTIONS, ...FEEDBACK_QUESTIONS].map((q) => [q.id, q.question]));

/** Feedback rules use their own questions, which the shared DSL renderer doesn't know. */
function condition(c: Condition): string {
  const text = renderCondition(c);
  return "question" in c ? text.replace(c.question, QUESTION_TEXT.get(c.question) ?? c.question) : text;
}

function questionEntry(q: DecisionQuestion, group: string) {
  const answers = q.type === "noul" ? `TRUE   ${q.criteria.true}\nFALSE  ${q.criteria.false}` : q.type === "score" ? q.criteria.map((c, i) => `${i}  ${c}`).join("\n") : "";
  return { id: q.id, title: q.question, group, tags: [q.type], body: `${q.instructions}\n\n${answers}` };
}

export function extraKnowledgeSections(): KnowledgeSection[] {
  return [
    {
      id: "copy",
      label: "Copy guidelines",
      version: KNOWLEDGE_VERSIONS.copyGuidelines,
      description: "What UI Copy checks every string against. Errors are hard rules the writer is retried on; warnings are reported.",
      entries: [
        ...COPY_GUIDELINES.guidelines.map((g) => ({
          id: g.id,
          title: g.code,
          group: "guidelines",
          tags: [g.severity, ...g.appliesTo],
          body: [g.text, g.check ? `\nCHECK   ${g.check.type}${"values" in g.check ? `: ${g.check.values.join(", ")}` : ""}` : "", g.source ? `SOURCE  ${g.source}` : ""]
            .filter(Boolean)
            .join("\n"),
        })),
        ...COPY_QUESTIONS.map((q) => questionEntry(q, "action-risk questions")),
      ],
    },
    {
      id: "feedback",
      label: "Feedback rules",
      version: KNOWLEDGE_VERSIONS.feedbackRules,
      description: "How Feedback Summary turns the decision model's judgments about an issue into recommended changes.",
      entries: [
        ...FEEDBACK_KNOWLEDGE.rules.map((r) => {
          const lines: string[] = [];
          (r.when.all ?? []).forEach((c, i) => lines.push(`${(i === 0 ? "WHEN" : "AND").padEnd(10)}${condition(c)}`));
          if (r.when.any?.length) lines.push(`${(lines.length ? "AND ANY" : "WHEN ANY").padEnd(10)}${r.when.any.map(condition).join("  |  ")}`);
          (r.when.none ?? []).forEach((c) => lines.push(`${(lines.length ? "AND NOT" : "WHEN NOT").padEnd(10)}${condition(c)}`));
          if (r.kinds) lines.push(`${"FOR".padEnd(10)}${r.kinds.join(", ")} issues`);
          lines.push(`${"RECOMMEND".padEnd(10)}${r.recommend}`);
          if (r.capabilities.length) lines.push(`${"NEEDS".padEnd(10)}${r.capabilities.join(", ")}`);
          if (r.relatedRules.length) lines.push(`${"SEE".padEnd(10)}${r.relatedRules.join(", ")}`);
          return { id: r.id, title: r.code, group: "rules", tags: r.kinds ?? ["any kind"], body: lines.join("\n") };
        }),
        ...FEEDBACK_QUESTIONS.map((q) => questionEntry(q, "issue questions")),
      ],
    },
  ];
}
