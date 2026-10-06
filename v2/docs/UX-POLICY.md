# UX policy

Policy turns judgments into decisions. **It calls no model**: given the same state, results, overrides, settlements, design system and knowledge, it always produces the same outcome. Code: [src/lib/ux/](../src/lib/ux/); entry point `runPolicy()` in [pipeline.ts](../src/lib/ux/pipeline.ts).

```text
results ─► fireRules ─► decide ─► resolvePatterns ─► buildRequirements ─► detectGaps (+ settlements) ─► resolveComponents
```

## Rules

A rule ([ux-rule.ts](../src/lib/schemas/ux-rule.ts), files in `knowledge/ux-rules/`) reads like the PRD §30 DSL:

```text
WHEN      Is the expected data volume high?  is true
AND NOT   Are records primarily recognized visually?  is true
RECOMMEND data-table  (Data presentation)
AVOID     card-grid
BECAUSE   Many text-and-number records are scanned fastest in a table.
```

- **Conditions:** question results (`is`, `choice`, `scoreGte` / `scoreLte`, optional `min`) or hard facts (`context.device eq mobile`, ordinal `gte` / `lte`). A question with no result **never** matches.
- **Effects:** `recommend` and `avoid` options of one decision slot; `requiresCapabilities`; `requiresStates`.
- **Tier**, in this order: accessibility > task > business > technical > design-system > visual.
- **Priority:** critical 3 · high 2 · medium 1 · low 0.5. A **critical avoid is a veto**.
- **Library:** 50 rules in 11 files, versioned 0.2.0 until a designer reviews them ([KNOWLEDGE.md](KNOWLEDGE.md)).

## Deciding a slot

There are 12 slots (layout, navigation, dataPresentation, detailView, selection, search, filtering, bulkActions, pagination, actionConfirmation, statusFeedback, formStructure). A slot is **in play** only if a rule speaks to it, a prior answered it, or the designer overrode it. Nothing is guessed.

**Scoring, per tier:**
- **Rule recommends:** + weight. **Rule avoids:** − weight. **Critical avoid:** veto.
- **Prior** (a decision-linked choice question): + probability, at the task tier.
- **Design system can't build an option:** − 0.5 (partial) or − 1 (unconfirmed or missing) per capability, **at the design-system tier only**.

**Ranking is lexicographic with a tie tolerance of 0.25.** Candidates are narrowed tier by tier, from accessibility down; remaining ties go to the higher total, then to vocabulary order. Two consequences, both tested:
- No number of lower-tier rules outvotes one higher-tier rule.
- The design system only breaks genuine ties. A clear task preference wins, and the problem is reported as a gap.

**Confidence:**
- *rules decided:* mean evidence confidence × `min(1, 0.7 + 0.15 × margin)`;
- *prior only:* its probability;
- *nothing:* 0.5;
- then banded (proceed / uncertain / needs review).

**Explanations:**
- **Reasons:** the recommending rules' `because`.
- **Alternatives:** only options something argued about, each with why it lost (veto with its code, the avoiding rules, can't be built, a lower prior).

## Overrides (PRD §16)

The designer may choose any option in the slot:
- **Source and confidence:** the source becomes `designer`, confidence 1, and the system's choice is kept as an alternative.
- **Record:** decision, system choice, designer choice, reason, timestamp and actor.
- **Rules are never changed**, and requirements are recomputed for the new choice.
- **Choosing a vetoed option** is allowed, but warned and recorded, naming the critical rule. An option outside the slot is ignored, with a warning.

## Patterns

[patterns/resolve.ts](../src/lib/ux/patterns/resolve.ts) gives each of the 14 patterns a fit score:
- half from how many of its `recommendedWhen` conditions match;
- half from how many of its `fitsDecisions` were chosen.

A pattern with conditions must match **at least one**: compatibility alone doesn't make a table a Comparison. A score ≥ 0.5 is included; the best is primary.

## Requirements

[policy/requirements.ts](../src/lib/ux/policy/requirements.ts) collects capability requirements:
- from **chosen decisions**, inheriting the priority and tier of the strongest recommending rule (so *Reject* protection is critical);
- from **fired rules' `requiresCapabilities`**;
- from **pattern `requiredCapabilities`**: high for the primary pattern, medium for supporting ones.

Rules' `requiresStates` apply to the whole solution (`requiredStates`). Requirements then go to design-system resolution ([DESIGN-SYSTEM.md](DESIGN-SYSTEM.md)).

## Beyond analysis: the same discipline elsewhere

| Feature | The policy part, in code |
|---|---|
| Layouts | Refuse while blocked; per-request vocabulary; every net-new gap shown as a placeholder |
| Evaluation | Deterministic checks (blocking gaps, critical overrides, registry-only, decisions shown, required states, responsive notes); scores aggregated with caps |
| Copy | Interaction per action (the decided confirmation wins; else irreversible → confirm, reversible → undo); slots; guideline lint |
| Feedback | 13 feedback rules on the same `evaluateWhen` engine; P0–P3 from severity × reach |

## Golden tests

- **Expense dashboard:** 10 decisions, the destructive veto, navigation flagged for review, zero gaps on the default system. On Acme it's blocked, then unblocked by an undo override.
- **Mobile sign-up:** split view and side panel ruled out on the phone; multi-step with stepper and wizard.

See [tests/ux/policy.test.ts](../tests/ux/policy.test.ts) and [tests/ux/subscription.test.ts](../tests/ux/subscription.test.ts).
