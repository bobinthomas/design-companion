import { ANALYSIS_QUESTIONS, KNOWLEDGE_VERSIONS, UX_PATTERNS, UX_RULES } from "@/lib/knowledge";
import { renderPattern, renderRule } from "@/lib/ux/rules/dsl";
import { RULE_CATEGORIES, RULE_TIERS } from "@/lib/schemas";

/**
 * Renders docs/KNOWLEDGE.md: every question, rule and pattern in readable
 * form, for designer review. Generated from knowledge/ — never edited by hand.
 * `npm run knowledge:doc` regenerates it; a test fails if it's stale.
 */
export function renderKnowledgeDoc(): string {
  const out: string[] = [];
  const fence = (body: string) => ["```text", body, "```"].join("\n");

  out.push(
    "# UX Knowledge — review copy",
    "",
    "> Generated from `knowledge/` by `npm run knowledge:doc`. Do not edit by hand; change the JSON and regenerate.",
    "",
    `Versions: questions ${KNOWLEDGE_VERSIONS.questionSet} · rules ${KNOWLEDGE_VERSIONS.rules} · patterns ${KNOWLEDGE_VERSIONS.patterns} · policy ${KNOWLEDGE_VERSIONS.policy}`,
    "",
    `**${UX_RULES.length} rules · ${UX_PATTERNS.length} patterns · ${ANALYSIS_QUESTIONS.length} analysis questions**`,
    "",
    "## How to read this",
    "",
    "- **Tiers** decide which considerations win, in this order: " + RULE_TIERS.join(" → ") + ". A lower tier can only break a near-tie on every higher tier.",
    "- **Priority** is strength within a tier: critical · high · medium · low. A critical rule's `RULE OUT` is a veto, not a preference.",
    "- **WHEN** conditions are answered by the decision model (questions) or read from hard facts in the UX state (`context.device`, …).",
    "- A noul question \"is true\" means the model's probability is at least 0.7.",
    "",
    "### What to look for when reviewing",
    "",
    "1. Is the **BECAUSE** true, and true often enough to be a rule?",
    "2. Is the **tier** right? (Accessibility only for genuine access needs; technical for device/platform limits.)",
    "3. Is the **priority** right? Is anything marked critical that shouldn't be a hard veto, or vice versa?",
    "4. Are the **WHEN** conditions too broad (fires where it shouldn't) or too narrow?",
    "5. What's **missing**: a rule you'd apply that isn't here?",
    ""
  );

  out.push("## Rules", "");
  for (const category of RULE_CATEGORIES) {
    const rules = UX_RULES.filter((r) => r.category === category);
    if (rules.length === 0) continue;
    out.push(`### ${category} (${rules.length})`, "");
    for (const rule of rules) out.push(fence(renderRule(rule)), "");
  }

  out.push("## Patterns", "");
  for (const pattern of UX_PATTERNS) out.push(fence(renderPattern(pattern)), "");

  out.push("## Analysis questions", "", "| Id | Type | Question | Answers |", "|---|---|---|---|");
  for (const q of ANALYSIS_QUESTIONS) {
    const answers =
      q.type === "noul"
        ? "true / false"
        : q.type === "choice"
          ? Object.keys(q.criteria).join(", ")
          : q.criteria.map((_, i) => String(i)).join(" / ") + " (levels)";
    out.push(`| \`${q.id}\` | ${q.type} | ${q.question} | ${answers} |`);
  }
  out.push("");
  return out.join("\n");
}
