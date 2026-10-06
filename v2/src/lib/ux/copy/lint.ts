import { COPY_GUIDELINES } from "@/lib/knowledge";
import type { CopyLint, CopySlot, CopyTarget, CopyText } from "@/lib/schemas";

/**
 * Deterministic copy checks from knowledge/copy-guidelines.json. Errors are
 * hard rules (the LLM is retried until they pass); warnings are reported.
 */

const normalize = (text: string) => text.toLowerCase().replace(/[.!?…"“”']/g, "").trim();

/** "Apply promo code" → "apply" */
export function actionVerb(name: string): string {
  return name.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
}

export function lintCopy(slots: readonly CopySlot[], copy: Record<string, CopyText>, targets: readonly CopyTarget[]): CopyLint[] {
  const issues: CopyLint[] = [];
  const target = new Map(targets.map((t) => [t.id, t]));

  for (const slot of slots) {
    const entry = copy[slot.id];
    if (!entry) continue;
    const t = target.get(slot.target);
    const texts = [entry.text, ...entry.alternatives];

    for (const g of COPY_GUIDELINES.guidelines) {
      if (!g.check || !(g.appliesTo.includes(slot.kind) || g.appliesTo.includes("*"))) continue;
      const check = g.check;
      for (const [i, text] of texts.entries()) {
        const where = i === 0 ? "" : ` (alternative ${i})`;
        const fail = (message: string) =>
          issues.push({ slotId: slot.id, guidelineId: g.id, code: g.code, severity: g.severity, message: `${message}${where}` });
        const lower = text.toLowerCase();

        if (check.type === "maxChars" && text.length > slot.maxChars) fail(`"${text}" is ${text.length} characters; the limit is ${slot.maxChars}.`);
        if (check.type === "forbidExact" && check.values.includes(normalize(text))) fail(`"${text}" doesn't say what happens. ${g.text}`);
        if (check.type === "forbidPhrase") {
          const hit = check.values.find((v) => lower.includes(v));
          if (hit) fail(`"${text}" contains "${hit}". ${g.text}`);
        }
        if (check.type === "includesActionVerb" && t?.kind === "action" && !lower.includes(actionVerb(t.name))) {
          fail(`"${text}" doesn't contain "${actionVerb(t.name)}". ${g.text}`);
        }
        if (check.type === "mustMentionWhen") {
          const applies = check.when === "bulk" ? t?.bulk : t?.risk?.destructive && !t.risk.reversible;
          if (applies && !check.values.some((v) => lower.includes(v.toLowerCase()))) fail(`"${text}" is missing ${check.when === "bulk" ? "{count}" : "that it can't be undone"}. ${g.text}`);
        }
      }
    }
  }
  return issues;
}
