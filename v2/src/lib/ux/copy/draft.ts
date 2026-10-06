import type { CopySlot, CopyTarget, CopyText, PolicyOutcome, UXState } from "@/lib/schemas";
import { actionVerb } from "@/lib/ux/copy/lint";

/**
 * Template copy for when no LLM is configured. Plain and correct rather
 * than good: it follows every hard guideline (the same lint runs on it),
 * so the requirements are visible even without a writer.
 */

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function pastTense(verb: string): string {
  if (verb.endsWith("e")) return `${verb}d`;
  if (/[^aeiou]y$/.test(verb)) return `${verb.slice(0, -1)}ied`;
  return `${verb}ed`;
}

function fit(text: string, max: number, fallback: string): string {
  return text.length <= max ? text : fallback.length <= max ? fallback : fallback.slice(0, max);
}

export function draftCopy(state: UXState, outcome: PolicyOutcome, targets: readonly CopyTarget[], slots: readonly CopySlot[]): Record<string, CopyText> {
  const entity = state.data.entity.toLowerCase();
  const plural = entity.endsWith("s") ? entity : `${entity}s`;
  const target = new Map(targets.map((t) => [t.id, t]));
  const filtered = outcome.decisions.some((d) => d.decision === "filtering" && d.result.choice !== "none");
  const copy: Record<string, CopyText> = {};

  for (const s of slots) {
    const t = target.get(s.target)!;
    const verb = actionVerb(t.name);
    const name = cap(t.name);
    const oneWord = !t.name.trim().includes(" ");
    const label = oneWord ? `${name} ${entity}` : name;
    const object = t.bulk ? `{count} ${plural}` : `this ${entity}`;
    const done = cap(pastTense(verb));
    const irreversible = t.risk?.destructive && !t.risk.reversible;

    const text: Record<string, string> = {
      button: fit(label, s.maxChars, name),
      "dialog-title": `${cap(verb)} ${object}?`,
      "dialog-body": [
        t.description,
        t.risk?.notifiesOthers ? "Anyone affected will be notified." : "",
        irreversible ? "This can't be undone." : "",
      ]
        .filter(Boolean)
        .join(" "),
      // Bulk: the button matches the counted title ("Reject {count}").
      "dialog-confirm": t.bulk ? fit(`${name} {count}`, s.maxChars, name) : fit(label, s.maxChars, name),
      "dialog-cancel": fit(`Keep ${entity}`, s.maxChars, "Cancel"),
      "inline-confirm": `${cap(verb)} ${object}?`,
      "undo-message": t.bulk ? `${done} {count} ${plural}` : `${done} ${entity}`,
      "undo-action": "Undo",
      success: t.bulk ? `${done} {count} ${plural}` : `${done} ${entity}`,
      error: `Couldn't ${verb} the ${entity}. Check your connection and try again.`,
      "screen-title": fit(t.name, s.maxChars, state.product),
      "empty-heading": fit(`No ${plural} here`, s.maxChars, "Nothing here yet"),
      "empty-body": `${cap(plural)} appear here when there's something to do.`,
      "empty-action": filtered ? "Clear filters" : "Refresh",
      "error-state-heading": fit(`Couldn't load ${plural}`, s.maxChars, "Couldn't load this"),
      "error-state-body": "Something went wrong on our side. Your work is safe; try again in a moment.",
      "error-state-action": "Try again",
      loading: fit(`Loading ${plural}…`, s.maxChars, "Loading…"),
    };
    copy[s.id] = { text: fit(text[s.kind], s.maxChars, text[s.kind].slice(0, s.maxChars)), alternatives: [] };
  }
  return copy;
}
