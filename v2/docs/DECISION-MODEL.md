# The decision model

The decision model answers **small, typed questions** about a state. It never sees rules, never chooses components, and never writes text. Code: [src/lib/decision-model/](../src/lib/decision-model/).

## Atomic questions

A question ([decision-question.ts](../src/lib/schemas/decision-question.ts)) is one of three types, in Jev's native `instructions` + `criteria` shape:

| Type | Answer | Example |
|---|---|---|
| `noul` | probability that it's true | *Is the expected data volume high?* |
| `choice` | one option id, with probabilities | *Which data presentation fits?* data-table · card-grid · list… |
| `score` | level on an ordered rubric, with a distribution | *How severe is the cost of an error?* |

Rules for writing them:
- **One judgment per question.** Never "is this UX good?" (PRD §28).
- **Self-describing option ids** (`persistent-filter-bar`, not `option-2`). Constrained decision heads follow the option *name* more than the rubric text; a test lints this.
- **Mock hints** (`mock.keywords`, `mock.default`) make the no-key demo deterministic.
- **`scope`** (optional) names the part of the state the question is about, for batched requests.

### Question sets

| Set | File | Count | Asked about |
|---|---|---|---|
| Analysis | `knowledge/questions/analysis.json` | 35 | The UX state (feeds policy). Two choice questions are decision **priors** linked to a slot |
| Evaluation | `knowledge/questions/evaluation.json` | 15 | Each solution being evaluated |
| Copy | `knowledge/questions/copy.json` | 4 | Each action: destructive? reversible? affects others? costs money? |
| Feedback | `knowledge/questions/feedback.json` | 7 | Each feedback issue: blocks the task? frequent? discoverability? … severity |
| Capability mapping | generated | ≤ 40 | "Does Table provide sorting?" for ambiguous design-system claims |

## Batching: one request per job

Every feature sends **one** request, however many subjects it covers. The state holds each subject under a key, and each question template is copied per subject:

```jsonc
{
  "problem":   { /* who, what, decisions */ },
  "solutions": { "s1": { /* direction A */ }, "s2": { /* direction B */ } }
}
// questions: eval.task.primary-central.s1 (scope "solutions.s1"), eval.task.primary-central.s2 (scope "solutions.s2"), …
// instructions are prefixed: Judge only the solution at solutions.s2 ("Exception first"). …
```

So evaluating three directions costs one of the visitor's two free daily Jev requests, not three. Jev reads the instructions; the mock honours `scope` and reads only that subject; the LLM provider sees the instructions.

## Providers

```ts
interface DecisionProvider {
  readonly id: "jev" | "llm" | "mock";
  evaluate(state: DecisionState, questions: readonly DecisionQuestion[]): Promise<DecisionResult[]>;
}
```

| Provider | How |
|---|---|
| **Jev** ([adapters/jev.ts](../src/lib/decision-model/adapters/jev.ts)) | `typesafe/jev` on Cloudflare Workers AI, through the `AI` binding or REST with the visitor's own token. Ids become identifier-safe keys. Output is validated and normalized: type must match, choices must be known, score levels keyed by label or index |
| **LLM** ([adapters/llm.ts](../src/lib/decision-model/adapters/llm.ts)) | The visitor's LLM returns probabilities only, against a per-request schema; choice, score and confidence are computed in code, so providers are comparable |
| **Mock** ([adapters/mock.ts](../src/lib/decision-model/adapters/mock.ts)) | Keyword hits at word starts in the (scoped) serialized state. Deterministic, labelled `mock-1.0.0` everywhere |

### Fallback chain

[evaluate.ts](../src/lib/decision-model/evaluate.ts) tries, in order:
1. **Visitor's Cloudflare token** (REST): no quota.
2. **Shared `AI` binding:** 2 requests per IP per UTC day, counted in KV. It fails closed without KV, and refunds the visitor's request when a call fails.
3. **Visitor's LLM.**
4. **Mock:** never fails.

Each skip or failure adds a plain-language notice, e.g. *"Jev failed (2021: Insufficient AI Gateway credits)."* Results from any provider are re-validated and matched to the questions.

## Confidence

| Result | Confidence |
|---|---|
| noul | `max(p, 1 − p)` |
| choice, score | probability of the winning answer |

Bands (from `knowledge/policy.json`): **≥ 0.85 proceed**, **≥ 0.65 uncertain**, **otherwise needs review**. A noul answer counts as true at ≥ 0.7 and false at ≤ 0.3 (a rule can set its own minimum).

## Account notes

- Jev is a partner model billed through Cloudflare AI credits. Without credits it answers error 2021 and the chain falls through; no code change is needed once credits are added.
- `next dev` calls Workers AI **remotely** (real, tiny charges). KV is simulated locally.
- The Jev adapter follows Cloudflare's documented format but hasn't been checked against a successful live response yet, so parsing is deliberately tolerant.
