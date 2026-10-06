import { noulIs } from "@/lib/decision-model/confidence";
import { COPY_GUIDELINES, COPY_QUESTIONS } from "@/lib/knowledge";
import { toEvidence } from "@/lib/ux/rules/evaluate";
import type { CopySlot, CopySlotKind, CopyTarget, DecisionQuestion, DecisionResult, PolicyOutcome, UXState } from "@/lib/schemas";

/**
 * PRD §24: "The LLM generates language; policy determines interaction
 * requirements." This module is the policy half. The decision model judges
 * each action's risk; code then decides how the action is protected and
 * which strings it needs, and attaches the guidelines each string must meet.
 */

export function actionKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "action";
}

/** One state with every action, and each risk question copied per action and scoped to it. */
export function buildRiskBatch(state: UXState) {
  const actions: Record<string, unknown> = {};
  const questions: DecisionQuestion[] = [];
  state.actions.forEach((a, i) => {
    const key = `a${i + 1}`;
    actions[key] = { name: a.name, description: a.description };
    for (const t of COPY_QUESTIONS) {
      questions.push({
        ...t,
        id: `${t.id}.${key}`,
        scope: `actions.${key}`,
        instructions: `Judge only the action at actions.${key} ("${a.name}"). ${t.instructions}`,
      });
    }
  });
  const problem = {
    product: state.product,
    users: `${state.user.role}: ${state.user.description}`,
    data: `${state.data.entity}: ${state.data.description}`,
  };
  return { state: { problem, actions }, questions };
}

function slot(target: string, kind: CopySlotKind): CopySlot {
  const def = COPY_GUIDELINES.slots[kind];
  return {
    id: `${target}.${kind}`,
    target,
    kind,
    label: def.label,
    maxChars: def.maxChars,
    guidance: COPY_GUIDELINES.guidelines.filter((g) => g.appliesTo.includes(kind) || g.appliesTo.includes("*")).map((g) => g.text),
  };
}

const humanChoice = (c: string) => c.replace(/-/g, " ");

export function planCopy(state: UXState, outcome: PolicyOutcome, results: readonly DecisionResult[]): { targets: CopyTarget[]; slots: CopySlot[] } {
  const choice = (slot: string) => outcome.decisions.find((d) => d.decision === slot)?.result.choice;
  const confirmation = choice("actionConfirmation");
  const feedback = choice("statusFeedback");
  const bulkDecided = choice("bulkActions") === "bulk-action-bar";
  const byId = new Map(results.map((r) => [r.questionId, r]));
  const template = new Map(COPY_QUESTIONS.map((q) => [q.id, q]));

  const targets: CopyTarget[] = [];
  const slots: CopySlot[] = [];
  const keys = new Set<string>();

  state.actions.forEach((action, i) => {
    let key = actionKey(action.name);
    while (keys.has(key)) key = `${key}-${i + 1}`;
    keys.add(key);

    const answer = (id: string) => byId.get(`${id}.a${i + 1}`);
    const flag = (id: string) => {
      const r = answer(id);
      return r?.type === "noul" ? noulIs(r, true) : false;
    };
    const destructive = flag("copy.action.destructive");
    const reversible = flag("copy.action.reversible");
    const notifiesOthers = flag("copy.action.notifies-others");
    const costsMoney = flag("copy.action.costs-money");
    const evidence = COPY_QUESTIONS.flatMap((q) => {
      const r = answer(q.id);
      return r ? [{ ...toEvidence(r, template.get(q.id)), questionId: q.id }] : [];
    });

    const requirements: string[] = [];
    let interaction: CopyTarget["interaction"] = "none";
    if (destructive) {
      if (confirmation && confirmation !== "none") {
        interaction = confirmation as CopyTarget["interaction"];
        requirements.push(`Destructive, so it's protected the way the action-confirmation decision says: ${humanChoice(confirmation)}.`);
      } else if (confirmation === "none") {
        requirements.push("Destructive, but the action-confirmation decision is \"none\": no protection copy. Check that override.");
      } else {
        interaction = reversible ? "undo-toast" : "confirm-dialog";
        requirements.push(reversible ? "Destructive but reversible, so an undo instead of a confirmation." : "Destructive and can't be undone, so it needs a confirmation.");
      }
    }
    if (destructive && !reversible) requirements.push("Can't be undone, so the confirmation must say so.");
    if (notifiesOthers) requirements.push("Affects other people, so the copy says who and how.");
    if (costsMoney) requirements.push("Commits money, so the label says so plainly.");
    const bulk = bulkDecided && !costsMoney;
    if (bulk) requirements.push("Bulk actions were decided, so messages carry the {count} of items.");

    targets.push({
      id: key,
      kind: "action",
      name: action.name,
      description: action.description,
      risk: { destructive, reversible, notifiesOthers, costsMoney, evidence },
      interaction,
      bulk,
      requirements,
    });

    const kinds: CopySlotKind[] = ["button"];
    if (interaction === "confirm-dialog") kinds.push("dialog-title", "dialog-body", "dialog-confirm", "dialog-cancel");
    if (interaction === "inline-confirm") kinds.push("inline-confirm");
    if (interaction === "undo-toast") kinds.push("undo-message", "undo-action");
    else kinds.push("success");
    kinds.push("error");
    if (feedback) requirements.push(`Outcomes appear as ${humanChoice(feedback)} (status-feedback decision).`);
    slots.push(...kinds.map((k) => slot(key, k)));
  });

  // The screen: title, and the states policy requires it to show.
  const states = new Set(outcome.requiredStates);
  const screenKinds: CopySlotKind[] = ["screen-title"];
  if (states.has("empty")) screenKinds.push("empty-heading", "empty-body", "empty-action");
  if (states.has("error")) screenKinds.push("error-state-heading", "error-state-body", "error-state-action");
  if (states.has("loading")) screenKinds.push("loading");
  targets.push({
    id: "screen",
    kind: "screen",
    name: state.tasks.find((t) => t.kind === "primary")?.name ?? state.product,
    description: state.summary,
    interaction: "none",
    bulk: false,
    requirements: [`Required states: ${[...states].filter((s) => ["empty", "error", "loading"].includes(s)).join(", ") || "none"}.`],
  });
  slots.push(...screenKinds.map((k) => slot("screen", k)));

  return { targets, slots };
}
