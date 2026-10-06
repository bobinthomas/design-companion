import { CAPABILITY_BY_ID, EVALUATION_QUESTIONS } from "@/lib/knowledge";
import type { DecisionQuestion, LayoutVariant, PolicyOutcome, UXState } from "@/lib/schemas";

/**
 * PRD §28: evaluation is decomposed into atomic questions. All subjects of
 * one evaluation go to the decision model in a single request — one state
 * holding the problem and every solution, with each question template
 * copied per solution and scoped to it — so comparing three directions
 * costs one Jev request, not three.
 */

export type PreparedSubject =
  | { kind: "direction"; id: string; label: string; variant: LayoutVariant; layoutRunId?: string }
  | { kind: "description"; id: string; label: string; description: string };

export interface EvaluationBatch {
  state: Record<string, unknown>;
  questions: DecisionQuestion[];
  /** Batch question id → { subject index, template question }. */
  index: Map<string, { subject: number; template: DecisionQuestion }>;
}

/** The problem as evaluators need it: who, what, where, and what was decided. */
export function describeProblem(state: UXState, outcome: PolicyOutcome) {
  return {
    product: state.product,
    summary: state.summary,
    users: `${state.user.role} (${state.user.expertise}, ${state.user.audience}): ${state.user.description}`,
    goal: state.goal.primary,
    primaryTask: state.tasks.find((t) => t.kind === "primary")?.name,
    tasks: state.tasks.map((t) => `${t.name} (${t.kind}, ${t.frequency})`),
    actions: state.actions.map((a) => `${a.name}: ${a.description}`),
    context: {
      device: state.context.device,
      frequency: state.context.frequency,
      environment: state.context.environment,
      dataVolume: state.context.dataVolume,
      timePressure: state.context.timePressure,
    },
    decisions: outcome.decisions.map((d) => `${d.label}: ${d.result.choice.replace(/-/g, " ")}`),
    requiredStates: outcome.requiredStates,
    designSystemComponents: outcome.components.map((c) => c.name),
    designSystemGaps: outcome.gaps.map((g) => `${CAPABILITY_BY_ID.get(g.capability)?.name ?? g.capability} (${g.behavior})`),
  };
}

/** A direction as plain, readable structure — what a reviewer would read. */
export function describeDirection(variant: LayoutVariant, outcome: PolicyOutcome) {
  const name = new Map(outcome.components.map((c) => [c.component, c.name]));
  return {
    title: variant.title,
    strategy: variant.strategy,
    summary: variant.summary,
    rationale: variant.rationale,
    regionsTopToBottom: variant.regions.map((r, i) => {
      const parts = r.components.map((c) =>
        "component" in c
          ? `${name.get(c.component) ?? c.component} (${c.purpose}${c.states.length > 0 ? `; states: ${c.states.join(", ")}` : ""})`
          : `NEW COMPONENT NEEDED (${c.purpose})`
      );
      return `${i + 1}. ${r.name} — ${r.purpose}: ${parts.join("; ")}`;
    }),
    tradeoffs: variant.tradeoffs,
    onPhones: variant.mobileNotes,
    onDesktop: variant.desktopNotes,
  };
}

export function buildEvaluationBatch(
  state: UXState,
  outcome: PolicyOutcome,
  subjects: readonly PreparedSubject[],
  templates: readonly DecisionQuestion[] = EVALUATION_QUESTIONS
): EvaluationBatch {
  const solutions: Record<string, unknown> = {};
  const questions: DecisionQuestion[] = [];
  const index: EvaluationBatch["index"] = new Map();

  subjects.forEach((subject, i) => {
    const key = `s${i + 1}`;
    solutions[key] =
      subject.kind === "direction"
        ? describeDirection(subject.variant, outcome)
        : { title: subject.label, description: subject.description };
    for (const template of templates) {
      const id = `${template.id}.${key}`;
      questions.push({
        ...template,
        id,
        scope: `solutions.${key}`,
        instructions: `Judge only the solution at solutions.${key} ("${subject.label}"), against the problem. ${template.instructions}`,
      });
      index.set(id, { subject: i, template });
    }
  });

  return { state: { problem: describeProblem(state, outcome), solutions }, questions, index };
}
