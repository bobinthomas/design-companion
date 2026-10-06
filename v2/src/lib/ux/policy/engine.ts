import { confidenceBand } from "@/lib/decision-model/confidence";
import { resolveCapability } from "@/lib/design-system/gaps";
import type { DesignSystemRegistry } from "@/lib/design-system/registry";
import { DECISION_CAPABILITIES, POLICY, type PolicyConfig } from "@/lib/knowledge";
import { toEvidence, type FiringRule, type RuleContext } from "@/lib/ux/rules/evaluate";
import {
  DECISION_LABELS,
  DECISION_OPTIONS,
  DECISION_TYPES,
  PRIORITIES,
  RULE_TIERS,
  type AppliedRule,
  type ChoiceResult,
  type DecisionAlternative,
  type DecisionEvidence,
  type DecisionType,
  type Priority,
  type RuleTier,
  type UXDecision,
  type UXRule,
} from "@/lib/schemas";

type Ranking = PolicyConfig["ranking"];
type TierScores = Record<RuleTier, number>;

/** A designer's choice for a slot, applied on top of the system's recommendation. */
export interface DesignerOverride {
  decision: DecisionType;
  choice: string;
  reason: string;
  timestamp?: string;
}

export interface DecideInput {
  ctx: RuleContext;
  fired: readonly FiringRule[];
  overrides?: readonly DesignerOverride[];
  /** When given, options the design system can't build are penalized at the design-system tier. */
  registry?: DesignSystemRegistry;
  ranking?: Ranking;
}

export interface DecideOutput {
  decisions: UXDecision[];
  warnings: string[];
  /** Per slot, the priority a capability requirement should inherit (§21b). */
  requirementPriority: Partial<Record<DecisionType, { priority: Priority; tier: RuleTier }>>;
}

const emptyScores = (): TierScores =>
  Object.fromEntries(RULE_TIERS.map((t) => [t, 0])) as TierScores;

const total = (s: TierScores) => RULE_TIERS.reduce((sum, t) => sum + s[t], 0);
const pct = (p: number) => `${Math.round(p * 100)}%`;
const strongest = (a: Priority, b: Priority) => (PRIORITIES.indexOf(a) <= PRIORITIES.indexOf(b) ? a : b);

/**
 * Picks the best option: walk the tiers in §13 order, keeping only
 * candidates within `tolerance` of the best score at each tier. A lower tier
 * can therefore only choose among options that are effectively tied on every
 * higher tier. Remaining ties go to the higher total, then vocabulary order.
 */
function pickBest(candidates: string[], scores: Record<string, TierScores>, tolerance: number, order: readonly string[]) {
  let remaining = [...candidates];
  for (const tier of RULE_TIERS) {
    const best = Math.max(...remaining.map((c) => scores[c][tier]));
    remaining = remaining.filter((c) => scores[c][tier] >= best - tolerance);
  }
  return remaining.sort(
    (a, b) => total(scores[b]) - total(scores[a]) || order.indexOf(a) - order.indexOf(b)
  )[0];
}

function rank(options: readonly string[], scores: Record<string, TierScores>, vetoed: ReadonlySet<string>, tolerance: number) {
  const open = options.filter((o) => !vetoed.has(o));
  const ranked: string[] = [];
  while (open.length > 0) {
    const best = pickBest(open, scores, tolerance, options);
    ranked.push(best);
    open.splice(open.indexOf(best), 1);
  }
  return [...ranked, ...options.filter((o) => vetoed.has(o))];
}

/** The first tier (in §13 order) where `a` beats `b` by more than the tolerance. */
function decisiveMargin(a: TierScores, b: TierScores, tolerance: number): number {
  for (const tier of RULE_TIERS) {
    const diff = a[tier] - b[tier];
    if (Math.abs(diff) > tolerance) return diff;
  }
  return total(a) - total(b);
}

function dedupe(evidence: DecisionEvidence[]): DecisionEvidence[] {
  const seen = new Set<string>();
  return evidence.filter((e) => (seen.has(e.questionId) ? false : (seen.add(e.questionId), true)));
}

/**
 * PRD §11 UX Policy Engine: turns rule firings and decision-model priors
 * into one decision per applicable slot. Deterministic — same inputs, same
 * decisions — and every outcome carries its evidence, rules and rejected
 * alternatives for the Decision Inspector.
 */
export function decide({ ctx, fired, overrides = [], registry, ranking = POLICY.ranking }: DecideInput): DecideOutput {
  const decisions: UXDecision[] = [];
  const warnings: string[] = [];
  const requirementPriority: DecideOutput["requirementPriority"] = {};

  for (const slot of DECISION_TYPES) {
    const options = DECISION_OPTIONS[slot] as readonly string[];
    const slotRules = fired.filter(
      (f) => f.rule.decision === slot && (f.rule.recommend.length > 0 || f.rule.avoid.length > 0)
    );
    const priorQuestion = [...ctx.questions.values()].find((q) => q.type === "choice" && q.decision === slot);
    const priorResult = priorQuestion ? ctx.results.get(priorQuestion.id) : undefined;
    const prior = priorResult?.type === "choice" ? (priorResult as ChoiceResult) : undefined;
    const override = overrides.find((o) => o.decision === slot);

    if (slotRules.length === 0 && !prior && !override) continue; // slot not in play

    // ---------- score every option per tier ----------
    const scores: Record<string, TierScores> = Object.fromEntries(options.map((o) => [o, emptyScores()]));
    const vetoes = new Map<string, UXRule>();
    const applied: AppliedRule[] = [];
    const dsMissing = new Map<string, string[]>();

    for (const { rule } of slotRules) {
      const weight = ranking.priorityWeights[rule.priority];
      for (const target of rule.recommend) {
        scores[target][rule.tier] += weight;
        applied.push({ id: rule.id, code: rule.code, tier: rule.tier, priority: rule.priority, effect: "recommend", target, contribution: weight, reason: rule.reason });
      }
      for (const target of rule.avoid) {
        if (rule.priority === "critical") {
          if (!vetoes.has(target)) vetoes.set(target, rule);
          applied.push({ id: rule.id, code: rule.code, tier: rule.tier, priority: rule.priority, effect: "veto", target, contribution: 0, reason: rule.reason });
        } else {
          scores[target][rule.tier] -= weight;
          applied.push({ id: rule.id, code: rule.code, tier: rule.tier, priority: rule.priority, effect: "avoid", target, contribution: -weight, reason: rule.reason });
        }
      }
    }

    if (prior) {
      for (const option of options) {
        scores[option].task += (prior.probabilities[option] ?? 0) * ranking.priorWeight;
      }
    }

    if (registry) {
      for (const option of options) {
        const missing: string[] = [];
        for (const capability of DECISION_CAPABILITIES[slot][option] ?? []) {
          const outcome = resolveCapability(registry, capability).outcome;
          if (outcome === "partial" || outcome === "unconfirmed" || outcome === "missing") {
            scores[option]["design-system"] -= ranking.designSystemPenalty[outcome];
            missing.push(capability);
          }
        }
        if (missing.length > 0) dsMissing.set(option, missing);
      }
    }

    // ---------- rank and choose ----------
    const vetoed = new Set(vetoes.keys());
    const ranked = rank(options, scores, vetoed, ranking.tieTolerance);
    const allVetoed = ranked.every((o) => vetoed.has(o));
    const systemChoice = ranked[0];
    if (allVetoed) {
      warnings.push(`Every ${DECISION_LABELS[slot].toLowerCase()} option is ruled out by a critical rule; review this decision.`);
    }

    const runnerUp = ranked.find((o) => o !== systemChoice && !vetoed.has(o));
    const margin = runnerUp
      ? decisiveMargin(scores[systemChoice], scores[runnerUp], ranking.tieTolerance)
      : Number.POSITIVE_INFINITY;

    // ---------- evidence, confidence, source ----------
    const supporting = slotRules.filter(
      ({ rule }) =>
        rule.recommend.includes(systemChoice as never) ||
        rule.avoid.some((a) => a !== systemChoice)
    );
    const evidence = dedupe([
      ...supporting.flatMap((f) => f.evidence),
      ...(prior && priorQuestion ? [toEvidence(prior, priorQuestion)] : []),
    ]);
    const rulesContributed = applied.length > 0;

    let confidence: number;
    if (rulesContributed) {
      const ruleEvidence = dedupe(supporting.flatMap((f) => f.evidence));
      const evidenceConfidence =
        ruleEvidence.length > 0
          ? ruleEvidence.reduce((sum, e) => sum + e.confidence, 0) / ruleEvidence.length
          : 0.75;
      const marginFactor = Number.isFinite(margin) ? Math.min(1, 0.7 + 0.15 * Math.max(0, margin)) : 1;
      confidence = evidenceConfidence * marginFactor;
    } else if (prior) {
      confidence = prior.probabilities[systemChoice] ?? prior.confidence;
    } else {
      confidence = 0.5;
    }
    confidence = Math.round(Math.min(1, Math.max(0, confidence)) * 100) / 100;

    const reasons = [
      ...new Set(
        slotRules.filter(({ rule }) => rule.recommend.includes(systemChoice as never)).map(({ rule }) => rule.reason)
      ),
    ];
    if (prior && prior.choice === systemChoice) {
      reasons.push(`Decision model rated ${systemChoice} the best fit (${pct(prior.probabilities[systemChoice] ?? 0)}).`);
    }
    if (reasons.length === 0 && dsMissing.size > 0 && !dsMissing.has(systemChoice)) {
      reasons.push("The closest fit your design system can build.");
    }

    // Alternatives are options something actually argued about — a rule or
    // the decision model — not options penalized only for being unbuildable.
    const considered = new Set(applied.map((a) => a.target as string));
    const alternatives: DecisionAlternative[] = ranked
      .filter((o) => o !== systemChoice)
      .filter((o) => considered.has(o) || (prior?.probabilities[o] ?? 0) >= 0.05)
      .slice(0, ranking.maxAlternatives)
      .map((option) => {
        const veto = vetoes.get(option);
        if (veto) return { choice: option as never, vetoed: true, reasonRejected: `Ruled out (${veto.code}): ${veto.reason}` };
        const avoidReasons = slotRules.filter(({ rule }) => rule.avoid.includes(option as never)).map(({ rule }) => rule.reason);
        if (avoidReasons.length > 0) return { choice: option as never, vetoed: false, reasonRejected: [...new Set(avoidReasons)].join(" ") };
        const missing = dsMissing.get(option);
        if (missing && !dsMissing.has(systemChoice)) {
          return { choice: option as never, vetoed: false, reasonRejected: `Your design system can't fully build it (${missing.join(", ")}).` };
        }
        if (prior && !rulesContributed) {
          return {
            choice: option as never,
            vetoed: false,
            reasonRejected: `Decision model rated it less likely (${pct(prior.probabilities[option] ?? 0)} vs ${pct(prior.probabilities[systemChoice] ?? 0)}).`,
          };
        }
        return { choice: option as never, vetoed: false, reasonRejected: `Less supported by UX rules than ${systemChoice}.` };
      });

    // ---------- requirement priority for this slot ----------
    const recommendersOf = (choice: string) => slotRules.filter(({ rule }) => rule.recommend.includes(choice as never));
    const priorityFor = (choice: string) => {
      const rules = recommendersOf(choice).length > 0 ? recommendersOf(choice) : slotRules;
      if (rules.length === 0) return { priority: ranking.defaultRequirementPriority, tier: "task" as RuleTier };
      const top = rules.reduce((a, b) => (strongest(a.rule.priority, b.rule.priority) === a.rule.priority ? a : b));
      return { priority: top.rule.priority, tier: top.rule.tier };
    };

    // ---------- designer override ----------
    const id = `decision.${slot}`;
    let decision: UXDecision = {
      id,
      decision: slot,
      label: DECISION_LABELS[slot],
      question: priorQuestion?.question ?? `Which ${DECISION_LABELS[slot].toLowerCase()} fits this task?`,
      result: { choice: systemChoice as never, confidence },
      band: allVetoed ? "needs-review" : confidenceBand(confidence),
      source: rulesContributed ? "rule" : prior ? "decision-model" : "default",
      reasons,
      evidence,
      rulesApplied: applied,
      alternatives,
      requiresCapabilities: DECISION_CAPABILITIES[slot][systemChoice] ?? [],
    };
    let finalChoice = systemChoice;

    if (override) {
      if (!options.includes(override.choice)) {
        warnings.push(`Ignored override "${override.choice}": not an option for ${DECISION_LABELS[slot].toLowerCase()}.`);
      } else {
        finalChoice = override.choice;
        const veto = vetoes.get(override.choice);
        if (veto) {
          warnings.push(`Your ${DECISION_LABELS[slot].toLowerCase()} override "${override.choice}" contradicts critical rule ${veto.code}: ${veto.reason}`);
        }
        decision = {
          ...decision,
          result: { choice: override.choice as never, confidence: 1 },
          band: "proceed",
          source: "designer",
          reasons: [override.reason],
          alternatives:
            override.choice === systemChoice
              ? decision.alternatives
              : [
                  { choice: systemChoice as never, vetoed: false, reasonRejected: "System recommendation, overridden by the designer." },
                  ...decision.alternatives.filter((a) => a.choice !== override.choice),
                ].slice(0, Math.max(1, ranking.maxAlternatives)),
          requiresCapabilities: DECISION_CAPABILITIES[slot][override.choice] ?? [],
          override: {
            decisionId: id,
            systemChoice: systemChoice as never,
            designerChoice: override.choice as never,
            overrideReason: override.reason,
            timestamp: override.timestamp ?? new Date().toISOString(),
            actor: "designer",
          },
        };
      }
    }

    requirementPriority[slot] = priorityFor(finalChoice);
    decisions.push(decision);
  }

  return { decisions, warnings, requirementPriority };
}
