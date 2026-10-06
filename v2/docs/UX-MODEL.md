# The UX model

The UX state ([src/lib/schemas/ux-state.ts](../src/lib/schemas/ux-state.ts)) is the structured problem every judgment is made against. It is produced from a brief by the LLM, reviewed by the designer, and then treated as the single source of truth for that analysis.

## The rule: describe, don't judge

> The LLM describes the problem. The decision model judges it.

If the state said `dataVolume: "high"`, asking Jev "is the data volume high?" would only echo the LLM's opinion. So the state holds observations:

| Field | Good | Bad |
|---|---|---|
| `context.dataVolume` | "Roughly 150–300 pending expense reports per manager per week" | "high" |
| `context.timePressure` | "Moderate; reimbursements are due at month end" | "urgent" |
| `context.notes` | "Managers compare amounts and categories across employees" | "Use a data table" |

The extraction prompt ([state/extract.ts](../src/lib/ux/state/extract.ts)) says this explicitly, with good and bad examples, and forbids naming UI.

## Hard constraints: the only enums

A few fields are **facts** that policy reads directly, so they come from fixed vocabularies ([vocabulary.ts](../src/lib/schemas/vocabulary.ts)):

| Field | Values | Why it's a fact |
|---|---|---|
| `user.expertise` | novice · intermediate · expert | Ordinal; rules compare it |
| `user.audience` | internal · professional · consumer | Changes trust and guidance needs |
| `context.device` | desktop · mobile · tablet · multi | A phone can't fit a side panel; critical rules **rule out** layouts on `mobile` |
| `context.frequency` and `tasks[].frequency` | rare · occasional · weekly · daily · continuous | Ordinal |
| `constraints.accessibility` | WCAG-A · WCAG-AA · WCAG-AAA | Default AA |

Rules may read only these paths (`FACT_PATHS`). A rule that reads anything else fails validation, so it can't sneak judgment in through a fact.

## Shape

| Section | Contents |
|---|---|
| Source | `brief` (the designer's own words, never paraphrased), `product`, `summary` |
| `user` | role, expertise, audience, description |
| `goal` | primary, secondary, success criteria |
| `tasks[]` | name, kind (exactly one primary), frequency, description |
| `actions[]` | what users do to records: approve, reject, export… with whether they notify others or can be undone, when the brief says |
| `context` | device, frequency, environment, data volume, time pressure, notes |
| `data` | entity, description, attributes |
| `constraints` | accessibility, design system, business, technical, brand |
| `ambiguities[]` | field, question, assumption: what the LLM assumed, for the designer to confirm |

## Lifecycle

1. **Extract** (`POST /api/ux/state`). Validated; the brief is restored verbatim.
2. **Review.** The designer edits hard constraints in place, confirms assumptions, or edits the JSON. Any edit is a `state-edited` event and **clears everything derived**: results, outcome, overrides, acceptances, layouts, evaluations, copy.
3. **Judge.** The whole state is the decision model's input for analysis. For evaluation, copy and feedback, a smaller **problem summary** is built from it (product, users, tasks, context, decisions).

## Golden states

Two fixtures double as test inputs and demo states:
- [expense-dashboard.ts](../src/lib/ux/fixtures/expense-dashboard.ts): desktop, daily, high volume, destructive *Reject*.
- [subscription-signup.ts](../src/lib/ux/fixtures/subscription-signup.ts): mobile, rare, a paid multi-step flow.

## Things to know

- Ambiguities are excluded when the mock reads the state: they're open questions, not facts.
- `actions` drives UI Copy. A state without actions has no action copy to write.
