import {
  ANALYSIS_QUESTIONS,
  CAPABILITIES,
  COMPOSITIONS,
  EVALUATION_QUESTIONS,
  EVALUATOR,
  evaluationCategoryOf,
  KNOWLEDGE_VERSIONS,
  UX_PATTERNS,
  UX_RULES,
} from "@/lib/knowledge";
import { renderPattern, renderRule } from "@/lib/ux/rules/dsl";
import { EVALUATION_CATEGORY_LABELS, type DecisionQuestion } from "@/lib/schemas";

/**
 * Flattens the knowledge base into browsable entries for /knowledge. Server
 * side only: the page ships these plain objects, not the validating loader.
 */

export interface KnowledgeEntry {
  id: string;
  title: string;
  /** Grouping within a section, e.g. a rule's category. */
  group: string;
  /** Short tags: tier, priority, type… */
  tags: string[];
  /** The full readable body (DSL, criteria, acceptance criteria). */
  body: string;
}

export interface KnowledgeSection {
  id: string;
  label: string;
  version: string;
  description: string;
  entries: KnowledgeEntry[];
}

function questionBody(q: DecisionQuestion): string {
  const answers =
    q.type === "noul"
      ? `TRUE   ${q.criteria.true}\nFALSE  ${q.criteria.false}`
      : q.type === "choice"
        ? Object.entries(q.criteria)
            .map(([k, v]) => `${k.padEnd(22)} ${v}`)
            .join("\n")
        : q.criteria.map((c, i) => `${i}  ${c}`).join("\n");
  return `${q.instructions}\n\n${answers}`;
}

/** Extra sections (copy guidelines, feedback rules) are registered by their modules. */
export function knowledgeSections(extra: KnowledgeSection[] = []): KnowledgeSection[] {
  return [
    {
      id: "rules",
      label: "UX rules",
      version: KNOWLEDGE_VERSIONS.rules,
      description: "Policy that turns decision-model judgments into decisions. Tier order decides conflicts; a critical RULE OUT is a veto.",
      entries: UX_RULES.map((r) => ({
        id: r.id,
        title: r.code,
        group: r.category,
        tags: [r.tier, r.priority, ...(r.decision ? [r.decision] : [])],
        body: renderRule(r),
      })),
    },
    {
      id: "patterns",
      label: "Patterns",
      version: KNOWLEDGE_VERSIONS.patterns,
      description: "UX structures defined by the capabilities they need, never by component names.",
      entries: UX_PATTERNS.map((p) => ({ id: p.id, title: p.name, group: "pattern", tags: p.requiredCapabilities, body: renderPattern(p) })),
    },
    {
      id: "analysis-questions",
      label: "Analysis questions",
      version: KNOWLEDGE_VERSIONS.questionSet,
      description: "Atomic questions the decision model answers about the UX state.",
      entries: ANALYSIS_QUESTIONS.map((q) => ({
        id: q.id,
        title: q.question,
        group: q.category,
        tags: [q.type, ...(q.type === "choice" && q.decision ? [`prior: ${q.decision}`] : [])],
        body: questionBody(q),
      })),
    },
    {
      id: "evaluation-questions",
      label: "Evaluation questions",
      version: KNOWLEDGE_VERSIONS.evaluator,
      description: "Asked once per evaluated solution. A poor answer raises the issue shown, at its severity.",
      entries: EVALUATION_QUESTIONS.map((q) => {
        const c = EVALUATOR.questions[q.id];
        return {
          id: q.id,
          title: q.question,
          group: EVALUATION_CATEGORY_LABELS[evaluationCategoryOf(q)],
          tags: [q.type, c.severity],
          body: `${questionBody(q)}\n\nISSUE           ${c.issue}\nRECOMMENDATION  ${c.recommendation}`,
        };
      }),
    },
    {
      id: "capabilities",
      label: "Capabilities",
      version: KNOWLEDGE_VERSIONS.capabilities,
      description: "The shared language between UX policy and any design system, plus composition recipes.",
      entries: [
        ...CAPABILITIES.map((c) => ({
          id: c.id,
          title: c.name,
          group: c.category,
          tags: c.requiredStates,
          body: [
            c.description,
            "",
            "ACCEPTANCE",
            ...c.acceptanceCriteria.map((a) => `- ${a}`),
            ...(c.accessibility.length > 0 ? ["", "ACCESSIBILITY", ...c.accessibility.map((a) => `- ${a}`)] : []),
          ].join("\n"),
        })),
        ...COMPOSITIONS.map((r) => ({
          id: r.id,
          title: `Recipe: ${r.id}`,
          group: "compositions",
          tags: [r.provides],
          body: `PROVIDES  ${r.provides}\nFROM      ${r.parts.join(" + ")}${r.notes ? `\n\n${r.notes}` : ""}`,
        })),
      ],
    },
    ...extra,
  ];
}
