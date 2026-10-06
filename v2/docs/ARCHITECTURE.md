# Architecture

Design Companion V2 is a decision-guided generative UX system. This document is the map: the layers, how a request moves through them, where state lives, and the rules the code keeps. The companion documents go deeper:

| Document | Covers |
|---|---|
| [UX-MODEL.md](UX-MODEL.md) | The UX state: what it describes, and why it never judges |
| [DECISION-MODEL.md](DECISION-MODEL.md) | Atomic questions, providers (Jev, LLM, mock), confidence, quota, batching |
| [UX-POLICY.md](UX-POLICY.md) | Rules, tiers, vetoes, decisions, overrides, patterns, requirements |
| [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) | Import, normalization, capabilities, resolution, gaps |
| [KNOWLEDGE.md](KNOWLEDGE.md) | Generated review copy of every rule, pattern, question and guideline |
| [BENCHMARK.md](BENCHMARK.md) | Generated benchmark report (PRD §40) |

## The one idea

> LLMs generate possibilities. Decision models make bounded judgments. Code and UX policy enforce decisions. Designers retain authority.

Every feature is built from the same five steps, in the same order:

```text
 interpret            judge                  decide                   constrain             generate / evaluate
 (LLM)                (decision model)       (code + knowledge)       (code + knowledge)    (LLM, then code)
 brief ─► UX state ─► atomic questions ─►    rules ─► decisions ─►    capabilities ─►       directions, copy, issues
                      typed results          patterns, requirements   components + gaps     ─► checks, lint, scores
```

Nothing downstream trusts anything upstream without a schema. The LLM never chooses a component, a decision or a priority. The decision model never sees the rules. The rules never call a model.

## Layers and modules

| Layer | Module | Calls a model? | Deterministic? |
|---|---|---|---|
| Contracts | `src/lib/schemas/` | — | — |
| Knowledge | `knowledge/`, `src/lib/knowledge/` | no | yes, validated at module load |
| Interpretation | `src/lib/ux/state/extract.ts` | LLM | no |
| Judgment | `src/lib/decision-model/` | Jev, LLM or mock | only the mock |
| Policy | `src/lib/ux/rules/`, `policy/`, `patterns/`, `components/`, `pipeline.ts` | no | **yes** |
| Design system | `src/lib/design-system/` | decision model for ambiguous mappings only | yes, except that step |
| Generation | `src/lib/ux/layouts/`, `copy/`, `feedback/cluster.ts` | LLM, or deterministic drafts | drafts only |
| Evaluation | `src/lib/ux/evaluate/`, `copy/lint.ts` | decision model for questions | checks and aggregation: yes |
| Trace | `src/lib/session/` | — | pure functions |
| API | `src/app/api/` | via the layers | — |
| UI | `src/app/*/page.tsx`, `src/components/` | — | — |

## A request, end to end

UX Analyze → Layout Brainstorm → Evaluate, as the product runs it:

1. **`POST /api/ux/state`.** The brief goes to the visitor's LLM with a prompt that forbids judging ("Roughly 200 reports a week", never "high"). The result is validated against `uxStateSchema`. Without a key, a labelled demo state is returned.
2. **The designer reviews the state.** Edits clear everything derived from it.
3. **`POST /api/ux/decide`.**
   - `analyzeState()` sends the 35 analysis questions to the decision provider chain in **one** request.
   - Then `runPolicy()` does the rest deterministically: fire rules → decide slots (tier-lexicographic, vetoes, priors) → match patterns → collect capability requirements → resolve them against the design system → gaps with behaviors → components.
4. **Overrides and gap settlements** re-run step 3 with the earlier `results`, so no new model call.
5. **`POST /api/ux/layouts`.** The server re-runs policy from the inputs: it never trusts an outcome the browser sends.
   - **Blocked:** a critical gap → `409`.
   - **Otherwise:** the LLM generates against a per-request schema that allows only selected components and known gaps, and requires every net-new gap as a placeholder. Without a key, a deterministic composer drafts from the outcome.
6. **`POST /api/ux/evaluate`.**
   - **Questions:** all directions go to the decision model in **one** batched request, with each question scoped to its direction.
   - **Checks and scores:** deterministic checks run in code, and code aggregates 12 category scores with evidence and sourced issues.
7. **The session trace** records every step in the browser and exports as JSON.

UI Copy and Feedback Summary follow the same shape. In each, the decision model judges something small (each action's risk, each issue's impact), versioned rules decide, and the LLM only writes or groups.

## Where state lives

V2 is **stateless on the server**. There's no database and no server session.

| Data | Where | Key |
|---|---|---|
| LLM key and model | browser localStorage | `design-companion-v2:provider-settings` |
| Cloudflare account and token (own Jev) | browser localStorage | `design-companion-v2:cloudflare-settings` |
| Analysis sessions (trace, layouts, evaluations, copy) | browser localStorage, 20 most recent | `design-companion-v2:analysis-sessions` |
| Imported design systems and the active one | browser localStorage, 5 most recent | `design-companion-v2:design-systems`, `…:active-design-system` |
| Feedback summaries | browser localStorage, 10 most recent | `design-companion-v2:feedback-runs` |
| Shared-Jev quota counters | Cloudflare KV `JEV_QUOTA` | `jev:<ip>:<YYYY-MM-DD>` |

Credentials travel with each request that needs them and are never stored or logged server side. Because the server re-derives policy from the inputs on every request, nothing the client holds can bypass a block or a veto.

## Invariants the code keeps

| Invariant | Enforced by |
|---|---|
| Every boundary is validated | Zod schemas on LLM output, provider results, knowledge files, imports, API bodies |
| Knowledge can't be invalid at runtime | Knowledge is statically imported and parsed at module load; a bad file fails the build and the tests |
| The LLM can't invent a component, decision or gap | Per-request schemas (`buildGenerationSchema`, `buildVariantSchema`), with a validation-error retry |
| The LLM can't invent evidence | `buildClusteringSchema(input)` rejects quotes not found in the feedback |
| A lower rule tier never outvotes a higher one | Lexicographic ranking in `policy/engine.ts`; tested |
| Critical rules veto | Critical `avoid` → option ruled out; an override is allowed but warned and recorded |
| Designers have final authority | Overrides and gap settlements are applied in the pipeline and kept in the trace; rules are never changed by them |
| One request per judgment batch | Analysis, evaluation (all subjects), copy (all actions), feedback (all issues) and mapping (all pairs) are each one decision-model call |
| Every result is reproducible | Results record knowledge, policy, design-system and model versions (`versions`) |
| Nothing fails silently | Fallbacks add plain-language notices; drafts and demo data are labelled everywhere |

## Fallbacks

| Missing | What happens |
|---|---|
| LLM key | Demo state (closest fixture), deterministic layout drafts, template copy, keyword feedback clustering, all labelled |
| Jev credits or quota | Next provider: the visitor's own Cloudflare token, then the shared binding (2/IP/day), then the visitor's LLM, then the mock, with notices |
| KV namespace | The shared binding isn't used (fail closed) |
| Imported design system | The bundled default (36 components) |

## Deployment shape

One Next.js 16 app (`v2/`), built by OpenNext into a single Cloudflare Worker, `design-companion-v2`. Bindings:
- `AI` (Workers AI, Jev);
- `JEV_QUOTA` (KV);
- `ASSETS`.

V1 is a separate Worker from the repository root; the two share nothing at runtime.

## Deviations from the PRD

- **Provider state type.** PRD §33 types the provider's state as `UXState`. Providers here accept any object, because capability mapping, evaluation, copy and feedback batches all send other shapes. Questions carry an optional `scope` so one request can hold several subjects.
- **Copy guidelines live outside the rules.** UI Copy uses its own guidelines file rather than UX rules, to keep the UX rule library within the PRD's 30–50 target and to give copy checks their own lint.
