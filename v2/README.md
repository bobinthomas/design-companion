# Design Companion V2

**AI that reasons about UX before it generates it.**

Design Companion V2 is a *decision-guided generative UX system*. It doesn't ask one large language model to decide everything and then draw a UI. It separates the work into layers with distinct responsibilities:

| Layer | Responsibility | Implemented by |
|---|---|---|
| Interpretation | Turn a natural-language brief into a structured UX state | LLM (bring-your-own key) |
| Judgment | Answer small, typed UX questions about that state | Decision model: TypeSafe's **Jev** on Cloudflare Workers AI |
| Policy | Combine judgments with rules, constraints and accessibility | Deterministic code + versioned rules |
| Design system intelligence | Know what the user's design system can actually build | Normalizer, capability model, gap detection |
| Generation | Explore layouts and copy *inside* the valid space | LLM, constrained by per-request schemas |
| Evaluation | Check the result against intent and constraints | Atomic questions + deterministic checks |
| Direction | Accept, override or refine every important decision | The designer |

> LLMs generate possibilities. Decision models make bounded judgments. Code and UX policy enforce decisions. Designers retain authority.

V2 is a **separate app** from V1 (the repository root). It lives in `v2/`, has its own `package.json`, and deploys as its own Cloudflare Worker, so both versions stay usable side by side.

- **Product spec:** [docs/PRD.md](docs/PRD.md) (v2.2; earlier versions in [docs/archive/](docs/archive/))
- **Implementation plan and status:** [docs/PLAN.md](docs/PLAN.md)

---

## Contents

1. [Status](#status)
2. [Quick start](#quick-start)
3. [Configuration](#configuration)
4. [Architecture](#architecture)
5. [Core contracts](#core-contracts)
6. [The UX state](#the-ux-state)
7. [Decision-model layer](#decision-model-layer)
8. [UX Policy](#ux-policy)
9. [Design System Intelligence](#design-system-intelligence)
10. [Knowledge base](#knowledge-base)
11. [API reference](#api-reference)
12. [User interface](#user-interface)
13. [Testing](#testing)
14. [Deployment](#deployment)
15. [Project structure](#project-structure)
16. [Design decisions](#design-decisions)
17. [Known limitations](#known-limitations)
18. [Roadmap](#roadmap)

---

## Status

V2 is being built in ten milestones that follow the PRD's sprint plan. **Milestones 1–4 are complete** on the `v2` branch.

| # | Milestone | Status |
|---|---|---|
| 1 | Contracts: Zod schemas for every intermediate representation, app scaffold, Worker config | ✅ Done |
| 2 | Decision infrastructure: `DecisionProvider`, Jev / LLM / mock adapters, question registry, confidence policy, quota | ✅ Done |
| 3 | Design System Intelligence: capability vocabulary, normalizer, capability mapping, gap detection, registry APIs | ✅ Done |
| 4 | UX Policy: rule engine, policy engine, pattern and component resolvers, 43 rules, 8 patterns, expense-dashboard golden test | ✅ Done |
| 5 | Knowledge base: patterns to 14, forms/content/responsive rules, designer review of all rules | Next |
| 6 | UX Analyze + Decision Inspector + overrides + audit trail | Planned |
| 7 | Decision-guided Layout Brainstorm | Planned |
| 8 | UX Evaluation + Compare Solutions | Planned |
| 9 | UI Copy and Feedback Summary migration; Design System Review screen | Planned |
| 10 | Benchmark (LLM-only vs LLM + design system vs decision-guided), docs, deploy | Planned |

**What works today:**
- The full deterministic pipeline, from UX state to decisions, patterns, components and design-system gaps, exposed as JSON APIs (`POST /api/ux/decide`).
- The Settings screen.
- 164 passing tests.

The designer-facing screens (UX Analyze, Evaluate, Copy, Feedback, Knowledge, Design System Review) start in Milestone 6. Until then their header links lead to 404 pages.

---

## Quick start

Requirements: Node.js 24, npm.

```bash
cd v2
npm install
npm run dev        # http://localhost:3002  (V1 runs on 3000)
```

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server on port 3002, with Cloudflare bindings available via OpenNext |
| `npm test` | Run all Vitest suites once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` | Next.js production build |
| `npm run preview` | Build the Worker bundle and run it locally with Wrangler |
| `npm run deploy` | Build the Worker bundle and deploy to Cloudflare |
| `npm run cf-typegen` | Generate Cloudflare binding types |

V2 runs with **no configuration at all**. With nothing set up:
- The deterministic parts (policy, rules, normalization, gap detection) run for real.
- Decision questions are answered by a keyword-based mock.
- LLM steps return canned demo data.

Every fallback is labelled in API responses, so demo output is never mistaken for real judgment.

---

## Configuration

V2 has three independent things you can turn on.

### 1. An LLM (for interpretation and generation)

Open **Settings** and save an API key for **Anthropic**, **Groq** or **OpenRouter**, with an optional model override. Defaults:

| Provider | Default model |
|---|---|
| Anthropic | `claude-sonnet-5` |
| Groq | `llama-3.3-70b-versatile` |
| OpenRouter | `openai/gpt-4o-mini` |

The key is stored only in the browser's `localStorage` under `design-companion-v2:provider-settings`. It is sent with each request that needs it and is never stored or logged on the server.

For local development you can instead set `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`) in `v2/.env.local`; copy [.env.local.example](.env.local.example). A key saved in Settings always takes precedence.

### 2. The decision model (Jev)

Decision questions go to Jev (`typesafe/jev`) on Cloudflare Workers AI. There are two ways to reach it:

| Route | Who pays | Limit |
|---|---|---|
| **Shared Workers AI binding** (`AI` in `wrangler.jsonc`) | Site owner | **2 requests per IP per UTC day**, tracked in KV |
| **Visitor's own Cloudflare account** (Settings → *Decision model (Jev)*) | Visitor | None |

To use your own account, save your **Cloudflare account ID** and an **API token with Workers AI permission** in Settings. They're stored under `design-companion-v2:cloudflare-settings` with the same rules as the LLM key.

> **Account requirement:** Jev is a partner model billed through Cloudflare's AI credits. If the account has none, Jev answers `2021: Insufficient AI Gateway credits` and V2 falls back to the next provider with a visible notice. Add credits in the Cloudflare dashboard; no code change is needed.

### 3. Cloudflare bindings

Configured in [wrangler.jsonc](wrangler.jsonc):

| Binding | Type | Purpose |
|---|---|---|
| `AI` | Workers AI (`remote: true`) | Jev decision model |
| `JEV_QUOTA` | KV namespace `f798c432b66e46a7a3681912d267fbc8` | Per-IP daily quota counters |
| `ASSETS` | Static assets | OpenNext static output |

`next.config.ts` calls `initOpenNextCloudflareForDev()`, so `next dev` gets these bindings too. **KV is simulated locally**, but **Workers AI always runs remotely**, so local development makes real, very small, billed Jev calls. You need `npx wrangler login` once.

---

## Architecture

```text
Designer brief
     │
     ▼
┌──────────────┐   LLM interprets — describes, never judges
│   UX STATE   │   (validated by uxStateSchema)
└──────┬───────┘
       │  atomic, typed questions (knowledge/questions/*.json)
       ▼
┌──────────────────────────────┐
│ DECISION PROVIDER            │   Jev  →  LLM  →  Mock (fallback chain)
│ noul · choice · score        │   every result validated + normalized
└──────┬───────────────────────┘
       │  typed DecisionResults with confidence + provenance
       ▼
┌──────────────────────────────┐
│ UX POLICY                    │   rules over results + hard facts,
│                              │   §13 tier order, critical vetoes
└──────┬───────────────────────┘
       │  UXDecisions + CapabilityRequirements
       ▼
┌──────────────────────────────┐
│ DESIGN SYSTEM INTELLIGENCE   │   normalize → map capabilities →
│                              │   resolve → gaps → gap policy
└──────┬───────────────────────┘
       │  valid components + gaps (block / net-new / warn)
       ▼
┌──────────────────────────────┐
│ GENERATION           (M7)    │   per-request schema: only registry
│                              │   components, only known gap ids
└──────┬───────────────────────┘
       ▼
┌──────────────────────────────┐
│ EVALUATION           (M8)    │   atomic questions + deterministic checks
└──────┬───────────────────────┘
       ▼
   Designer (inspect · accept · override)
```

**Principles in the code:**

- **Validated contracts everywhere.** Every boundary (LLM output, decision results, knowledge files, imports, API bodies) goes through a Zod schema. An invalid value fails safely instead of propagating.
- **Knowledge lives in files, not prompts.** Questions, capabilities, recipes, alias tables, policy thresholds and the default design system are versioned JSON in `knowledge/`.
- **Provider independence.** Policy depends on the `DecisionProvider` interface, never on Jev directly.
- **Statelessness.** No database and no server sessions. Visitor settings and future session traces live in the browser. KV holds only quota counters.

---

## Core contracts

All schemas are in [src/lib/schemas/](src/lib/schemas/) and re-exported from `@/lib/schemas`.

| Schema | File | Purpose |
|---|---|---|
| Vocabulary | `vocabulary.ts` | Shared enums: expertise, frequency, device, audience, accessibility level, UI states, rule priorities and tiers, rule categories, the 12 decision slots and their options, the fact paths policy may read |
| `UXState` | `ux-state.ts` | The structured UX problem (see [The UX state](#the-ux-state)) |
| `DecisionQuestion` | `decision-question.ts` | One atomic question: `noul`, `choice` or `score`, in Jev's native `instructions` + `criteria` shape, plus mock hints |
| `DecisionResult` | `decision-result.ts` | One typed answer: `noul` probability, `choice` + probabilities, or weighted `score` + distribution. Always has `confidence`, `provider` and `model` |
| `UXRule` | `ux-rule.ts` | Externalized policy: conditions over question results or hard facts; a §13 tier and a priority; recommend / avoid / requires capabilities or states |
| `UXDecision` | `ux-decision.ts` | The application-level decision: choice, confidence band, source, evidence, rules applied, alternatives, required capabilities, override record |
| `UXPattern` | `ux-pattern.ts` | A UX structure defined by required/optional **capabilities**, required states, fit conditions and compatible decisions |
| `ComponentCapability` | `component-capability.ts` | Capability definitions, component claims (`full` / `partial`, source, confidence, missing criteria), composition recipes |
| `Component` | `component.ts` | A design-system component described by its capability claims, states, variants, props, tokens, accessibility notes, usage guidance |
| `DesignSystem` | `design-system.ts` | Normalized design system: semver version, source, tiered tokens, components |
| `CapabilityRequirement` | `capability-requirement.ts` | What the UX needs from the design system, with inherited priority and tier and what required it |
| `DesignSystemGap` | `design-system-gap.ts` | Capability resolutions and gaps: kind, severity, affected decisions, suggested resolutions, status, recorded resolution |
| Import format + report | `design-system-import.ts` | Permissive Phase 1 import JSON, normalization report, pending mappings |
| `UXEvaluation` | `ux-evaluation.ts` | 12 evaluation categories, deterministic checks, per-category scores with evidence, issues tied to their source |
| `Generation` | `generation.ts` | Layout variants. `buildGenerationSchema()` narrows pattern, component, rule and gap ids per request |
| `KnowledgeVersions` | `versions.ts` | Versions of everything a result depends on (§30) |

### Decision slots

Policy fills each slot with exactly one option. Option ids are deliberately self-describing.

| Slot | Options |
|---|---|
| `layout` | single-page, multi-step, split-view, dashboard, detail-view |
| `navigation` | sidebar, top-nav, tabs, breadcrumb, stepper, bottom-nav, none |
| `dataPresentation` | data-table, card-grid, list, timeline, kanban, chart |
| `detailView` | side-panel, full-page, modal, inline-expand |
| `selection` | checkbox, radio, select, combobox, segmented-control, toggle |
| `search` | visible-search, global-search, none |
| `filtering` | persistent-filter-bar, filter-panel, saved-views, none |
| `bulkActions` | bulk-action-bar, none |
| `pagination` | paginated, infinite-scroll, virtualized, none |
| `actionConfirmation` | confirm-dialog, undo-toast, inline-confirm, none |
| `statusFeedback` | toast, inline-message, alert-banner |
| `formStructure` | single-page-form, wizard, inline-edit, none |

### Rule conditions

A rule's `when` has `all` / `any` / `none` lists. Each condition is one of:

```jsonc
{ "question": "data.volume.high", "is": "true" }            // noul ≥ policy threshold (0.7)
{ "question": "data.volume.high", "is": "true", "min": 0.9 } // per-condition threshold
{ "question": "decision.layout", "choice": "split-view" }    // choice result
{ "question": "risk.error-cost", "scoreGte": 1.5 }           // score thresholds
{ "fact": "context.device", "op": "eq", "value": "desktop" } // hard-constraint fact
```

Facts are limited to `user.expertise`, `user.audience`, `context.device`, `context.frequency` and `constraints.accessibility`. Anything else must come through a decision question, and a rule referencing any other fact fails validation. Ordinal facts support `gte` / `lte`.

Rules have a **tier** (accessibility > task > business > technical > design-system > visual) and a **priority** (critical > high > medium > low). The schema rejects:
- a rule that recommends an option from another decision slot;
- a rule with no effect;
- a rule that recommends or avoids without naming a slot.

---

## The UX state

[src/lib/schemas/ux-state.ts](src/lib/schemas/ux-state.ts)

The state is what every analysis question is evaluated against. The key rule: **the LLM describes, the decision model judges.** For example, `context.dataVolume` holds *"Roughly 150–300 pending expense reports per manager per week"*, not `"high"`. Jev decides whether that counts as high. Otherwise the decision model would only echo the LLM's opinion.

| Section | Fields |
|---|---|
| Source | `brief` (the designer's original words), `product`, `summary` |
| `user` | `role`, `expertise` (enum), `audience` (enum), `description` |
| `goal` | `primary`, `secondary[]`, `successCriteria[]` |
| `tasks[]` | `name`, `kind` (primary/supporting; at least one primary), `frequency` (enum), `description` |
| `actions[]` | `name`, `description` (approve, reject, export…) |
| `context` | `device` (enum), `frequency` (enum), `environment`, `dataVolume`, `timePressure`, `notes[]` |
| `data` | `entity`, `description`, `attributes[]` |
| `constraints` | `accessibility` (default WCAG-AA), `designSystem`, `business[]`, `technical[]`, `brand` |
| `ambiguities[]` | `field`, `question`, `assumption`: open questions for the designer to confirm |

The PRD's first end-to-end case, *"Design an expense-review dashboard for managers"*, is in [src/lib/ux/fixtures/expense-dashboard.ts](src/lib/ux/fixtures/expense-dashboard.ts). It is the golden test input and the canned state for demo mode.

---

## Decision-model layer

[src/lib/decision-model/](src/lib/decision-model/)

### The provider interface

```ts
interface DecisionProvider {
  readonly id: "jev" | "llm" | "mock";
  evaluate(state: DecisionState, questions: readonly DecisionQuestion[]): Promise<DecisionResult[]>;
}
```

The contract: exactly one validated result per question, in question order, tagged with provider and model. `DecisionState` is any object. Usually it's a `UXState`, but capability mapping evaluates questions against a design-system description, so the interface is wider than PRD §33's `UXState`.

### Adapters

| Adapter | File | How it works |
|---|---|---|
| **JevProvider** | `adapters/jev.ts` | Maps questions to Jev's `{ state, questions }` format and calls it through the Workers AI binding or the REST API. Question keys are identifier-safe forms of the ids (`data.volume.high` → `data_volume_high`). Jev's output is still validated: answer type must match the question type, choices must be known options, score probabilities keyed by level label or index are both accepted, and distributions are normalized over every option. A rejected token produces a clear "check Settings" error. |
| **LlmDecisionProvider** | `adapters/llm.ts` | Asks the visitor's LLM for probabilities only, with a schema built per request so every question and answer key is required. Choice, score and confidence are then computed in code, so all providers are scored identically. This exists for the PRD's provider comparison and as a fallback. |
| **MockDecisionProvider** | `adapters/mock.ts` | Deterministic. Each question's `mock` hints map answers to keywords; the answer with the most matches in the serialized state wins, otherwise its default. Matches count only at word starts ("form" doesn't hit "information"), and ambiguities are ignored. Labelled `mock-1.0.0` everywhere it surfaces. |

### Confidence

All providers report a uniform `confidence` from 0 to 1. For a noul answer it's `max(p, 1 − p)`; for choice and score it's the probability of the winning answer. [confidence.ts](src/lib/decision-model/confidence.ts) bands it using the thresholds in [knowledge/policy.json](knowledge/policy.json):

| Confidence | Band | Behavior (PRD §15) |
|---|---|---|
| ≥ 0.85 | `proceed` | Proceed automatically |
| 0.65 – 0.84 | `uncertain` | Proceed, but show the uncertainty |
| < 0.65 | `needs-review` | Ask the designer to review |

A noul result counts as *true* at 0.7 or above and *false* at 0.3 or below. Rules can override this per condition.

### Fallback chain and quota

[evaluate.ts](src/lib/decision-model/evaluate.ts) tries providers in order and returns the first success:

```text
1. Visitor's own Cloudflare account (REST)   — no quota
2. Shared Workers AI binding                 — 2 / IP / UTC day
3. Visitor's LLM (Settings key or ANTHROPIC_API_KEY)
4. Mock                                      — never fails
```

- Each skip or failure adds a plain-language **notice**, e.g. *"You've used today's 2 free Jev analyses…"* or *"Jev failed (2021: Insufficient AI Gateway credits)."*
- **Fail closed.** If the `AI` binding exists but `JEV_QUOTA` doesn't, the shared binding is never used.
- **Refund on failure.** A failed Jev call isn't billed, so it doesn't cost the visitor one of their daily requests.
- **Soft limit.** Counters are keyed `jev:<ip>:<YYYY-MM-DD>` with a 48-hour TTL. Because KV is eventually consistent, concurrent requests from different locations can occasionally slip one past the limit. That's fine for cost control; it isn't a security boundary.
- **Validation.** Results from any provider are re-validated against `decisionResultSchema` and checked against the questions before being returned.

---

## UX Policy

[src/lib/ux/](src/lib/ux/)

The policy layer turns the decision model's judgments into application decisions (PRD §11). **It calls no model.** Given the same state, results, overrides and knowledge, it always produces the same outcome. [pipeline.ts](src/lib/ux/pipeline.ts) runs it end to end:

```text
results ─► fireRules ─► decide ─► resolvePatterns ─► buildRequirements ─► detectGaps ─► resolveComponents
  (Jev)     (rules)    (policy)    (patterns)          (capabilities)       (design      (components)
                                                                             system)
```

`runPolicy({ state, questions, results, overrides?, designSystem?, rules? })` returns a `PolicyOutcome`, validated by `policyOutcomeSchema`:

| Field | Contents |
|---|---|
| `decisions` | One `UXDecision` per slot in play |
| `requirements` | Capability requirements from decisions, rules and patterns |
| `requiredStates` | States the solution must represent (from rules and patterns) |
| `patterns` | Matched patterns, primary first |
| `components` | Registry components selected, with the capabilities each serves |
| `resolutions`, `gaps`, `blocked` | Design-system resolution, gaps with their policy behavior, whether generation is blocked |
| `warnings` | e.g. an override that contradicts a critical rule |
| `rulesFired` | Every rule that matched, with its evidence |
| `versions` | Everything the outcome depends on (§30) |

### Rule engine

[rules/evaluate.ts](src/lib/ux/rules/evaluate.ts)
- `evaluateCondition()` judges one condition against the question results or hard-constraint facts. Noul results use the policy threshold or a per-condition `min`. Choices can require a minimum probability. Ordinal facts compare positions on their scale.
- **A question with no result never matches.** Absent evidence is not evidence.
- `evaluateWhen()` applies `all` / `any` / `none` and cites the evidence that made the clause match, including non-matches in `none` (e.g. "records are *not* visual").
- `fireRules()` returns every matching rule with its evidence.

### Policy engine

[policy/engine.ts](src/lib/ux/policy/engine.ts). `decide()` fills each decision slot that is **in play**: a rule speaks to it, a decision-linked choice question answered it, or the designer overrode it. Slots nothing speaks to are left undecided rather than guessed.

**Scoring.** Every option gets a score per §13 tier:

| Input | Effect |
|---|---|
| Rule recommends an option | + priority weight at the rule's tier (critical 3, high 2, medium 1, low 0.5) |
| Rule avoids an option | − priority weight at the rule's tier |
| **Critical** rule avoids an option | **Veto**: the option is ruled out entirely |
| Decision-linked choice question (prior) | + probability × 1.0 at the task tier |
| Design system can't build an option | − 0.5 (partial) or − 1 (unconfirmed / missing) per required capability, **at the design-system tier only** |

**Ranking: lexicographic by tier, with a tie tolerance.** Starting from accessibility and moving down through task, business, technical, design-system and visual, the candidates are narrowed to those within 0.25 of the best score at each tier. Remaining ties go to the higher total, then to vocabulary order. This guarantees that:
- **a lower tier can never outvote a higher one.** No number of visual-tier rules beats one accessibility rule; there's a test for this.
- **the design-system tier can only break genuine ties.** If two options are equally good for the task, the one the design system can build wins. A clear task preference still wins and is reported as a gap.

The ordering is transitive, so the full ranking of alternatives is well-defined.

**Confidence.**
- *When rules decided:* the mean confidence of the evidence behind the winning rules, multiplied by a margin factor. The factor is `min(1, 0.7 + 0.15 × margin)`, where the margin is the winner's lead over the runner-up at the first tier that separates them.
- *When only the decision model spoke:* its own probability for the winner.
- *When nothing spoke:* 0.5.
- The result is banded `proceed` / `uncertain` / `needs-review` (§15).

**Source.** `rule` if any rule contributed, `decision-model` if only the prior did, `designer` if overridden, `default` otherwise.

**Explanations.**
- **Reasons** are the reasons of the rules recommending the winner, plus the decision model's rating when it agrees.
- **Alternatives** are only options something actually argued about, never options penalized solely for being unbuildable. Each says why it lost: the veto with its rule code, the avoiding rules' reasons, "your design system can't fully build it", a lower decision-model rating, or less rule support.

**Overrides (§16).**
- The chosen option is replaced, the source becomes `designer` and confidence 1, and the system's choice moves to the top of the alternatives.
- The full override record is kept: decision id, system choice, designer choice, reason, timestamp and actor.
- **Overrides never change rules.** The rules that argued for the system's choice stay on record, and requirements are recomputed for the new choice.
- An override that picks a vetoed option is allowed, because the designer has final authority, but it produces a warning naming the critical rule. An override to an option that isn't in the slot is ignored, with a warning.

**Requirement priority.** A decision's capability requirements inherit the priority and tier of the strongest rule that recommended the chosen option. For example, `DESTRUCTIVE_PROTECTED` is critical and recommends both `confirm-dialog` and `undo-toast`, so either choice yields a critical requirement.

### Pattern resolver

[patterns/resolve.ts](src/lib/ux/patterns/resolve.ts) scores each registry pattern on two equally weighted parts:
- the fraction of its `recommendedWhen` conditions that match;
- the fraction of its `fitsDecisions` that the policy actually chose.

Patterns scoring 0.5 or more are included. The best fit is `primary`; ties go to more matched decisions, then more matched conditions. The rest are `supporting`.

### Requirements and component resolver

- [policy/requirements.ts](src/lib/ux/policy/requirements.ts) collects capability requirements from three sources:
  - **chosen decisions**, with inherited priority;
  - **fired rules' `requiresCapabilities`**;
  - **pattern `requiredCapabilities`**: high for the primary pattern, medium for supporting ones.

  Rules' `requiresStates` apply to the solution as a whole (`requiredStates`), not to each capability.
- [components/resolve.ts](src/lib/ux/components/resolve.ts) derives the component list only from capability resolutions: the strongest provider for satisfied capabilities, and one provider per part for composites. **Components are never named by an LLM.**

### Golden test: expense-review dashboard

With the mock decision provider and the default design system, *"Design an expense-review dashboard for managers"* produces:

| Decision | Choice | Confidence | Band | Key rules |
|---|---|---|---|---|
| Data presentation | data-table | 0.87 | proceed | DATA_VOLUME_HIGH, COMPARISON_REQUIRED, INFO_DENSITY_HIGH |
| Detail view | side-panel | 0.88 | proceed | CONTEXT_PRESERVATION |
| Search | visible-search | 0.88 | proceed | SEARCH_REQUIRED |
| Filtering | persistent-filter-bar | 0.88 | proceed | FILTER_REQUIRED |
| Bulk actions | bulk-action-bar | 0.88 | proceed | BULK_ACTIONS_REQUIRED |
| Pagination | paginated | 0.88 | proceed | PAGINATION_HIGH_VOLUME, REACHABLE_CONTENT (avoid infinite scroll) |
| Action confirmation | confirm-dialog | 0.87 | proceed | DESTRUCTIVE_PROTECTED (vetoes `none`), IRREVERSIBLE_CONFIRM, HIGH_ERROR_COST |
| Layout | split-view | 0.83 | uncertain | LIST_DETAIL_WORKFLOW + decision-model prior |
| Status feedback | toast | 0.81 | uncertain | ASYNC_OUTCOME, BULK_RESULT_SUMMARY |
| Navigation | none | 0.61 | needs-review | SINGLE_SCREEN (one low-priority rule) |

- **Patterns:** Data Table (primary), with Filtering, Search, Detail Page and Empty State supporting.
- **Components:** DataTable, Drawer, SearchField, Select, Button, Pagination, Dialog, Toast, Badge, EmptyState.
- **Design system:** zero gaps, not blocked.
- **Against the Acme design system:** blocked on destructive confirmation. A designer override to `undo-toast` unblocks it.

Two things to notice:
- The system chose **split-view**, not "dashboard", even though the brief says *dashboard*: the evidence is about reviewing records, not monitoring metrics.
- The thinly supported navigation decision is correctly flagged for review.

With real Jev confidences (e.g. 0.97 / 0.91) the data-table decision lands around the PRD's example of 94%.

---

## Design System Intelligence

[src/lib/design-system/](src/lib/design-system/)

This layer answers *"what can the user's design system actually build?"* All knowledge references **capabilities**, never component ids, so the same rules and patterns work against any imported design system.

### Import pipeline

```text
Raw JSON (Phase 1 format)
  │  rawDesignSystemSchema — permissive input
  ▼
normalizeComponents()        names · states · variants · props · declared claims
normalizeTokens()            flatten · resolve refs · tier · category
inferClaims()                name / variant / prop hints → inferred claims
  ▼
designSystemSchema.parse()   strict canonical DesignSystem
  +
NormalizationReport          every mapping: mapped / ambiguous / unknown
  +
pending mappings             inferred claims below 0.85 confidence
```

`importDesignSystem(input, source)` in [import.ts](src/lib/design-system/import.ts) runs the whole pipeline. The **bundled default design system goes through the same function**, so the import path runs on every build.

#### The Phase 1 import format

The format is deliberately forgiving:

```jsonc
{
  "name": "Acme DS",
  "version": "2.4.0",
  "tokens": {                                   // nested tree; leaves are values,
    "color": { "blue": { "500": { "$value": "#3b82f6", "$type": "color" } } },
    "sys":   { "primary": "{color.blue.500}" }, // {references} are resolved
    "button": { "bg": "{sys.primary}" }         // groups named after a component = component tokens
  },
  "components": [
    {
      "name": "Btn",                            // aliases → canonical "button"
      "variants": ["primary", "danger"],        // "danger" → "destructive"
      "states": ["rest", "hovered", "busy"],    // → default, hover, loading
      "props": { "variant": ["primary", "danger"], "onClick": "() => void" },
      "capabilities": [                         // optional declared claims
        "primary-action",
        { "capability": "row-selection", "level": "partial", "missing": ["select-all"] }
      ],
      "tokens": ["button.bg"]
    }
  ]
}
```

`props` may be an array of `{ name, type, values, required }` or a `{ name: type | values[] }` map.

#### Normalization (§21d)

[normalize.ts](src/lib/design-system/normalize.ts) and [tokens.ts](src/lib/design-system/tokens.ts):

1. **Names.** The name is compared, ignoring case and punctuation, against 40 canonical components' aliases (`Btn` → `button`, `DataGrid` → `data-table`). Unrecognized components keep a kebab-case id and are reported `unknown`. Duplicate ids get a numbered suffix and a finding.
2. **States.** 15 canonical states with aliases (`hovered` → `hover`, `isDisabled` → `disabled`, `busy` → `loading`, `indeterminate` → `partial`). Unknown states are reported and excluded from state checks. A component with no recognizable state is assumed `default` and flagged `ambiguous`.
3. **Variants.** `danger` / `critical` / `negative` → `destructive`; `tertiary` / `subtle` → `ghost`; tone variants (`success`, `warning`, `error`, `info`). Unknown variants are kept and reported.
4. **Tokens.**
   - Nested trees are flattened to dotted names.
   - `{refs}` are resolved, with cycle and dangling-reference detection.
   - Each token gets a **tier**: under a component's name → *component*; a reference or under `semantic` / `sys` / `alias` / `theme` → *semantic*; otherwise *primitive*.
   - **Category** (color, typography, spacing, radius, elevation, grid, motion) comes from `$type`, then the referenced token, then the name, then the value's shape. A referenced token takes its target's category, so `semantic.text` is a color, not typography.
   - Undeterminable categories are reported.
5. **Token layering (§21).**
   - Component tokens that skip the semantic layer are flagged `primitive-in-component`: aliasing a primitive directly, or using a literal where the system defines semantic tokens of that category.
   - Components that consume primitive tokens are flagged the same way, and references to unknown tokens are flagged.
6. **Declared capabilities.** Checked against the vocabulary. Unknown ones are dropped and reported as `unknown-capability`.

Nothing is dropped silently. Every change is in the report.

#### Capability mapping (§21e)

[capabilities.ts](src/lib/design-system/capabilities.ts). Mapping runs cheapest first, and the LLM never decides it:

| Step | Source | Confidence |
|---|---|---|
| 1. Declared in the import | `declared` | 1.0, trusted |
| 2. Inferred from canonical name or variants | `inferred` | 0.75 |
| 2. Inferred from prop hints (`sortable`, `onSort`, `selectable`, `pageSize`, `onUndo`…) | `inferred` | 0.70 |
| 2. Name **and** props agree | `inferred` | 0.85 |
| 3. Decision model confirms an ambiguous pair | `decision-model` | the noul value |
| 4. Designer confirms or rejects | `designer` | 1.0 |

- Inference never overrides a declared claim.
- Inferred claims below 0.85 become **pending mappings**.
- `buildMappingBatch()` turns them into **one bounded batch** (at most 40) of noul questions, *"Does Table provide sorting?"*, evaluated against a state describing only the components and capabilities involved. One batch means one decision-model request.
- `applyMappingResults()`: answers at 0.7 or above confirm the claim, answers at 0.3 or below remove it, and anything in between stays inferred.
- `applyDesignerReview()` records confirmations and rejections and **bumps the patch version**, so earlier traces stay reproducible.

### Resolution and gap detection (§21c)

[gaps.ts](src/lib/design-system/gaps.ts) resolves each capability requirement against a [`DesignSystemRegistry`](src/lib/design-system/registry.ts):

| Outcome | Rule |
|---|---|
| `satisfied` | A claim at or above the review threshold (0.65), `full`, with no missing criteria, from a component that has every required state (the capability's own plus the requirement's) |
| `composite` | A recipe exists for the capability and **every part** is directly satisfied (one level deep, by design) |
| `partial` | A usable claim exists but is partial, misses criteria, or misses states |
| `unconfirmed` | Only claims below the review threshold |
| `missing` | Nothing claims it |

- Requirements for the same capability are **merged**: highest priority and tier win, and states and sources add up.
- Anything other than satisfied or composite becomes a `DesignSystemGap`:
  - **Severity** comes from the requirement, so accessibility requirements produce critical gaps.
  - **Kind** is `missing`, `partial`, `missing-state` (only states missing), `accessibility` (a missing item is one of the capability's accessibility obligations), or `unconfirmed`.
  - **Suggested resolutions** are `add-component`, `extend-component`, `override-decision` or `accept-risk`, depending on the kind.

**Gap policy** comes from `knowledge/policy.json`, not prompts:

| Severity | Behavior |
|---|---|
| critical | `block`: no generation for the affected region until resolved or explicitly accepted |
| high | `mark-net-new`: generation proceeds, and the region is marked "net-new component required" |
| medium / low | `warn` |

`settleGap()` records the designer's resolution with a reason and timestamp; settled gaps never block. The schema rejects an accepted or resolved gap without a recorded resolution.

### Registry query API

`DesignSystemRegistry` is the single read interface for everything downstream:
- `component(id)` and `componentIds`;
- `providersOf(capability)`, with the strongest claim first (full before partial, then by confidence);
- `capability(id)`, `coveredCapabilities()` and `tokens(tier?)`.

### Worked example (PRD §21f)

[tests/fixtures/acme-design-system.json](tests/fixtures/acme-design-system.json) is a deliberately incomplete design system. Its Table has only partial row selection, and it has no Dialog. Run against the expense dashboard's needs:

| Requirement | Result |
|---|---|
| tabular-display, sorting | ✅ satisfied (Table, inferred from name and props) |
| filter-controls | ✅ composite: Dropdown + Btn (`dropdown-filters`) |
| row-selection | ⚠ **partial gap, high** → mark net-new. Missing the select-all criterion, plus the `selected` / `disabled` / `partial` states the Table lacks |
| pagination | ⚠ missing, medium → warn |
| destructive-confirmation | ⛔ **missing gap, critical → generation blocked** |
| …after the designer overrides `actionConfirmation` to `undo-toast` | ✅ `undo-action` composite: Toast + Btn (`undo-in-toast`) → unblocked |

The bundled default design system satisfies all of these directly or by composition.

---

## Knowledge base

Everything in [knowledge/](knowledge/) is validated at module load by [src/lib/knowledge/index.ts](src/lib/knowledge/index.ts). Workers have no runtime filesystem, so files are statically imported. An invalid file fails the build and tests, never a request.

| File | Contents |
|---|---|
| `manifest.json` | Versions: question set 1.0.0, rules 0.1.0, policy 1.2.0, patterns 0.1.0, capabilities 1.0.0, compositions 1.0.0, normalization 1.0.0, prompts 1.0.0. The evaluator stays at 0.0.0 until written; rules and patterns reach 1.0.0 after the Milestone 5 review |
| `policy.json` | Confidence thresholds (0.85 / 0.65), noul threshold (0.7), quota (2/IP/day), gap behaviors, capability-mapping confidences and question cap, and **ranking**: tie tolerance 0.25, prior weight 1, priority weights (3 / 2 / 1 / 0.5), design-system penalties, max 3 alternatives |
| `ux-rules/*.json` | **43 UX rules** in 9 files: accessibility, tables, filtering, search, layout, error-prevention, feedback, navigation, selection |
| `patterns.json` | **8 UX patterns**, defined by capabilities |
| `questions/analysis.json` | **27 analysis questions** (18 noul, 6 choice, 3 score) |
| `capabilities.json` | **50 capabilities** in 6 categories, each with acceptance criteria, required states and accessibility obligations |
| `compositions.json` | **6 composition recipes** |
| `decision-capabilities.json` | For every option of every decision slot, the capabilities it needs. Validated to cover exactly the vocabulary |
| `normalization.json` | Alias tables: 40 components (with implied capabilities), 10 variants, 15 states, 7 prop-hint groups |
| `design-systems/default.json` | The bundled default design system: **36 components**, tokens in all three tiers and seven categories |

### UX rules

| File | Rules (code: what it does) |
|---|---|
| `accessibility.json` | STATUS_NOT_COLOR_ONLY: status badges with text (SC 1.4.1) · REACHABLE_CONTENT: avoid infinite scroll (SC 2.1.1 / 2.4.1) · ERRORS_PERSISTENT: no toasts for input errors (SC 3.3.1) · TIMING_ADJUSTABLE: no auto-dismissing feedback under time pressure (SC 2.2.1) · DRAG_ALTERNATIVE: menu alternative to dragging (SC 2.5.7) · SAFE_DEFAULT_FOCUS: destructive buttons never the default focus (SC 1.4.1 / 2.4.7) |
| `tables.json` | DATA_VOLUME_HIGH, COMPARISON_REQUIRED, INFO_DENSITY_HIGH: data table · VISUAL_RECORDS: cards · STAGED_RECORDS: kanban · TIME_ORDERED_RECORDS: timeline · PAGINATION_HIGH_VOLUME: paginate · SORTED_LIST_POSITION: avoid infinite scroll · BULK_ACTIONS_REQUIRED: bulk action bar |
| `filtering.json` | FILTER_REQUIRED: persistent filter bar for frequent use · FILTER_OCCASIONAL: filter panel · FILTER_UNNECESSARY: no filters for small sets |
| `search.json` | SEARCH_REQUIRED: visible search · GLOBAL_SEARCH_DEEP_APP: global search across many sections |
| `layout.json` | CONTEXT_PRESERVATION: side panel · LIST_DETAIL_WORKFLOW: split view · AGGREGATE_MONITORING: dashboard · MULTI_STEP_TASK: multi-step · SMALL_SCREEN_SPLIT_VIEW: no split view on phones |
| `error-prevention.json` | DESTRUCTIVE_PROTECTED: confirm or undo, **vetoes `none`** (critical) · IRREVERSIBLE_CONFIRM: confirm, not undo · REVERSIBLE_UNDO: undo, not confirm · HIGH_ERROR_COST: confirm |
| `feedback.json` | ASYNC_OUTCOME: toast · BULK_RESULT_SUMMARY: toast · INLINE_VALIDATION: inline message · DATA_STATES_REQUIRED: loading / empty / error states plus an empty-state capability |
| `navigation.json` | SINGLE_SCREEN: none · PEER_SECTIONS: tabs · DEEP_APP_NAVIGATION: sidebar · MOBILE_PRIMARY_NAV: bottom nav · STEP_PROGRESS: stepper |
| `selection.json` | MULTI_SELECT_INDEPENDENT: checkbox · SINGLE_SELECT_FEW: radio · SINGLE_SELECT_MODERATE: select · SINGLE_SELECT_MANY: combobox · IMMEDIATE_SETTING: toggle |

Rules cite their sources (WCAG success criteria, NN/g, Nielsen's heuristics) where one applies.

### UX patterns

| Pattern | Required capabilities | Fits decisions |
|---|---|---|
| Data Table | tabular-display, sorting | dataPresentation = data-table |
| Filtering | filter-controls | filtering = persistent-filter-bar / filter-panel / saved-views |
| Search | search-input | search = visible-search / global-search |
| Detail Page | (none) | detailView = side-panel / full-page / modal |
| Dashboard | metric-summary | layout = dashboard |
| Form | text-input, form-validation | formStructure = single-page-form / inline-edit |
| Wizard | step-indicator, form-validation | layout = multi-step, formStructure = wizard, navigation = stepper |
| Empty State | empty-state-display | — |

Each pattern also lists optional capabilities, required states, the conditions that recommend it, the patterns it composes with, and anti-patterns.

### Analysis questions

| Area | Questions |
|---|---|
| Data | volume high? · comparison required? · filtering required? · sorting required? · search required? · information density (score) · records recognized visually? · data structure (choice) |
| Task | performed frequently? · bulk actions required? · details needed without losing place? · multi-step? · data-entry heavy? · long form? · aggregate metrics monitored? · exceptions important? · time pressure (score) |
| Actions & risk | destructive actions present? · destructive actions easily undone? · cost of error (score) |
| Interaction & context | number of sections (choice) · selection mode (choice) · option count (choice) · mobile use likely? · outcomes asynchronous? |
| Decision priors | data presentation (choice → `dataPresentation`) · overall layout (choice → `layout`) |

Choice questions with a `decision` link use that slot's option ids, so Jev's probabilities become the starting point for policy (Milestone 4).

### Capabilities

| Category | Capabilities |
|---|---|
| Actions | primary-action, secondary-action, destructive-action, icon-action, overflow-menu, bulk-action-bar |
| Data | tabular-display, sorting, row-selection, pagination, virtualized-scrolling, column-customization, inline-row-actions, card-display, list-display, timeline-display, kanban-board, data-visualization, status-badge, metric-summary, empty-state-display |
| Input | text-input, long-text-input, single-select-dropdown, searchable-select, multi-select-checkbox, single-choice-radio, segmented-choice, on-off-toggle, date-input, search-input, filter-controls, form-validation |
| Navigation | sidebar-navigation, top-navigation, tab-navigation, breadcrumb-trail, step-indicator, bottom-navigation |
| Feedback | toast-notification, inline-message, alert-banner, progress-indicator, loading-skeleton, undo-action |
| Overlay | modal-dialog, side-drawer, popover, tooltip, destructive-confirmation |

### Composition recipes

| Recipe | Provides | From |
|---|---|---|
| `confirm-in-dialog` | destructive-confirmation | modal-dialog + destructive-action |
| `undo-in-toast` | undo-action | toast-notification + secondary-action |
| `selection-toolbar` | bulk-action-bar | row-selection + secondary-action |
| `dropdown-filters` | filter-controls | single-select-dropdown + secondary-action |
| `field-with-search-icon` | search-input | text-input + icon-action |
| `message-with-action` | empty-state-display | inline-message + primary-action |

### Default design system components

Button, IconButton, Menu, TextField, Textarea, Select, Combobox, Checkbox, RadioGroup, Switch, SegmentedControl, DatePicker, SearchField, Form, DataTable, Pagination, Card, List, Chart, StatCard, Badge, EmptyState, Tabs, SidebarNav, TopNav, Breadcrumb, Stepper, Toast, InlineAlert, Banner, Progress, Skeleton, Dialog, Drawer, Popover, Tooltip.

Tokens include primitive color, spacing, radius, typography, elevation, grid and motion scales; semantic roles (primary, secondary, success, warning, error, surface, text, border, focus); and component tokens for Button, Dialog and DataTable that alias the semantic layer.

---

## API reference

All endpoints are Next.js route handlers under `src/app/api/`. Request bodies are validated. An invalid body returns `400 { error, issues: [{ path, message }] }`.

Endpoints that may call a decision model also accept optional credentials from Settings:

```jsonc
{
  "cloudflare":   { "accountId": "…", "apiToken": "…" },              // own Jev access
  "clientConfig": { "provider": "anthropic", "apiKey": "…", "model": "…" } // own LLM
}
```

### `POST /api/ux/decide`

The full pipeline: decision model (unless results are supplied), then UX policy, patterns, requirements, design-system resolution, components and gaps.

```jsonc
// request
{
  "state": { /* UXState */ },
  "results": [ /* optional: reuse an earlier run's results, so the model isn't called again */ ],
  "overrides": [
    { "decision": "actionConfirmation", "choice": "undo-toast", "reason": "Rejections are reversible within 24h" }
  ],
  "designSystem": { /* optional DesignSystem; defaults to the bundled one */ }
}

// response
{
  "state": { … }, "questions": [ … ], "results": [ … ],
  "decisionModel": { "provider": "jev", "model": "jev-1.13.0", "notices": [], "quota": { … } },
  "decisions": [
    { "id": "decision.dataPresentation", "label": "Data presentation", "result": { "choice": "data-table", "confidence": 0.94 },
      "band": "proceed", "source": "rule", "reasons": [ … ], "evidence": [ … ], "rulesApplied": [ … ],
      "alternatives": [ { "choice": "card-grid", "vetoed": false, "reasonRejected": "…" } ],
      "requiresCapabilities": ["tabular-display", "sorting"] }
  ],
  "patterns": [ { "pattern": "data-table", "role": "primary", "score": 1, … } ],
  "requirements": [ … ], "requiredStates": [ … ],
  "components": [ { "component": "data-table", "name": "DataTable", "serves": [ … ], "via": ["direct"] } ],
  "resolutions": [ … ], "gaps": [ … ], "blocked": false,
  "warnings": [], "rulesFired": [ … ], "versions": { … }
}
```

Designers re-run this endpoint with `overrides` and the earlier `results` to see the effect of a change without another Jev request.

### `POST /api/decision-model/evaluate`

Answers atomic questions against a UX state. It returns raw, typed results only; policy is applied elsewhere.

```jsonc
// request
{ "state": { /* UXState */ }, "questionIds": ["data.volume.high"] }  // questionIds optional (default: all 27)

// response
{
  "questions": [ /* the DecisionQuestions asked */ ],
  "results": [
    { "questionId": "data.volume.high", "type": "noul", "noul": 0.97, "confidence": 0.97,
      "provider": "jev", "model": "jev-1.13.0" }
  ],
  "provider": "jev", "model": "jev-1.13.0",
  "notices": [],
  "quota": { "limit": 2, "used": 1, "remaining": 1 },
  "versions": { "decisionModel": "jev-1.13.0", "questionSet": "1.0.0", "policy": "1.1.0" }
}
```

### `GET /api/decision-model/quota`

The caller's remaining shared-binding Jev requests today: `{ available: true, limit, used, remaining }`, or `{ available: false }` when the binding or KV isn't configured.

### `GET /api/design-system/capabilities`

The capability vocabulary and composition recipes, with versions.

### `GET /api/design-system/default`

The bundled default design system with its normalization report and pending mappings (none).

### `POST /api/design-system/import`

Phase 1 JSON import: ingest, normalize, infer.

```jsonc
// request
{ "designSystem": { /* Phase 1 import format */ } }

// response
{
  "designSystem": { /* normalized DesignSystem */ },
  "report": { "entries": [ /* mapped / ambiguous / unknown */ ], "findings": [ /* problems */ ] },
  "pending": [ { "component": "data-table", "capability": "sorting", "confidence": 0.7,
                 "reasons": ["prop \"sortable\"", "prop \"onSort\""] } ],
  "versions": { "capabilities": "1.0.0", "normalization": "1.0.0" }
}
```

### `POST /api/design-system/map`

Confirms ambiguous component/capability pairs through the decision model, in one bounded batch.

```jsonc
// request
{ "designSystem": { /* DesignSystem */ }, "pending": [ /* from /import */ ] }

// response
{ "designSystem": { /* claims updated */ }, "entries": [ /* confirmed / rejected / unsure */ ],
  "asked": 9, "skipped": 0, "provider": "jev", "model": "…", "notices": [], "quota": { … } }
```

### `POST /api/design-system/gaps`

Resolves capability requirements against a design system (the default if omitted).

```jsonc
// request
{
  "requirements": [
    { "capability": "destructive-confirmation", "priority": "critical", "tier": "accessibility",
      "requiredBy": { "decision": "actionConfirmation" }, "states": [] }
  ],
  "designSystem": { /* optional DesignSystem */ }
}

// response
{
  "resolutions": [ { "capability": "destructive-confirmation", "outcome": "missing", "components": [], "missing": [] } ],
  "gaps": [ { "id": "gap.destructive-confirmation", "kind": "missing", "severity": "critical",
              "behavior": "block", "suggestedResolutions": ["add-component", "override-decision", "accept-risk"],
              "status": "open", "affectedDecisions": ["actionConfirmation"], "missing": [] } ],
  "blocked": true,
  "versions": { "capabilities": "1.0.0", "compositions": "1.0.0", "policy": "1.1.0",
                "designSystem": { "id": "acme-ds", "version": "2.4.0" } }
}
```

---

## User interface

| Route | Status | What it is |
|---|---|---|
| `/` | ✅ | Home: positioning, the six-step pipeline (Understand → Decide → Constrain → Generate → Validate → Direct), entry cards |
| `/settings` | ✅ | LLM provider key and model override; **Decision model (Jev)** section with your own Cloudflare account and today's remaining shared quota |
| Header | ✅ | V2 badge, primary nav, **Open V1** link, provider status pill (Live / Demo data) |
| `/analyze`, `/evaluate`, `/copy`, `/feedback`, `/knowledge` | Milestones 6–9 | Linked from the header and home page; not built yet |
| `/design-system` | Milestone 9 | Design System Review (import, report, capability matrix, gaps); not yet linked |

Styling uses Tailwind CSS v4 with Geist fonts, light and dark, consistent with V1.

---

## Testing

```bash
npm test     # 9 suites, 164 tests
```

| Suite | Covers |
|---|---|
| `tests/contracts/schemas.test.ts` | Every contract accepts valid input and rejects the important invalid cases: no primary task, out-of-vocabulary values, forbidden fact paths, options from the wrong slot, effect-less rules, gaps accepted without a resolution, invented components and unknown gap ids in generation |
| `tests/decision-model/questions.test.ts` | Question knowledge lint: unique ids, valid mock hints, self-describing option ids, decision-prior options belong to their slot |
| `tests/decision-model/providers.test.ts` | Mock determinism and plausible expense-dashboard judgments; Jev format mapping, REST envelope, label-keyed score levels, rejected tokens, mismatched answers; LLM probability normalization |
| `tests/decision-model/evaluate.test.ts` | Confidence bands; quota per IP and day; the full fallback chain, including precedence of the visitor's token, failing closed without KV, refunds on failure, and falling through on errors |
| `tests/design-system/knowledge.test.ts` | Capability, recipe, decision-capability and alias lint; default design system imports with zero findings, correct token tiers and categories, and covers the expense dashboard |
| `tests/ux/knowledge.test.ts` | Rule and pattern lint: 30–50 rules, unique ids and codes; every condition references a real question with the right type, a real option and a reachable score; fact values are in the vocabulary; capabilities exist; accessibility rules are in the accessibility tier and cite WCAG |
| `tests/ux/rules.test.ts` | Condition evaluation (noul thresholds and `min`, choices with minimum probability, scores, ordinal facts, missing results never matching) and `all` / `any` / `none` evidence |
| `tests/ux/policy.test.ts` | The expense-dashboard **golden test** (5–10 decisions, expected choices, Inspector-ready explanations, the veto, the review flag, patterns, components, no gaps, critical requirement priority, determinism); overrides (record, rules kept, requirements recomputed, warnings); the §21f example through the full pipeline; and the §13 guarantees: visual rules can't outvote accessibility, the design-system tier breaks ties but not clear preferences, priors decide alone when no rule applies |
| `tests/design-system/pipeline.test.ts` | Normalizer (names, states, variants, tokens, findings), capability mapping (declared, inferred, decision-model confirmation and rejection, designer review), and the full §21f worked example including override and accepted risk |

Tests run against the deterministic mock and fake bindings, so they need no network or credentials.

---

## Deployment

V2 deploys to Cloudflare Workers through the [OpenNext adapter](https://opennext.js.org/cloudflare), as its own Worker named **`design-companion-v2`**, separate from V1's `design-companion`.

```bash
cd v2
npx wrangler login     # once
npm run deploy         # opennextjs-cloudflare build && opennextjs-cloudflare deploy
```

Before deploying, make sure the Cloudflare account has Workers AI credits for Jev. Without them the app still works, using the fallback providers.

> V2 has not been deployed yet; deploying is part of Milestone 10.

---

## Project structure

```text
v2/
├── docs/
│   ├── PRD.md                      Product requirements v2.2
│   ├── PLAN.md                     Implementation plan, decisions, status
│   └── archive/                    PRD v2.0 and v2.1
├── knowledge/                      Versioned UX knowledge (validated at build)
│   ├── manifest.json
│   ├── ux-rules/*.json             43 rules in 9 files
│   ├── patterns.json
│   ├── policy.json
│   ├── questions/analysis.json
│   ├── capabilities.json
│   ├── compositions.json
│   ├── decision-capabilities.json
│   ├── normalization.json
│   └── design-systems/default.json
├── src/
│   ├── app/
│   │   ├── page.tsx                Home
│   │   ├── settings/page.tsx       Settings (LLM + Jev)
│   │   ├── layout.tsx              Root layout + header
│   │   └── api/
│   │       ├── decision-model/{evaluate,quota}/route.ts
│   │       ├── design-system/{capabilities,default,import,map,gaps}/route.ts
│   │       └── ux/decide/route.ts
│   ├── components/
│   │   ├── AppHeader.tsx
│   │   └── CloudflareSettings.tsx
│   └── lib/
│       ├── ai/                     LLM dispatch (from V1) + validation retry
│       ├── api.ts                  Shared request parsing and decision context
│       ├── cloudflare.ts           Worker bindings and client IP
│       ├── decision-model/         Provider interface, adapters, confidence, quota, fallback chain
│       ├── design-system/          Tokens, normalizer, capability mapping, import, registry, gaps, default
│       ├── knowledge/              Loads and validates knowledge/
│       ├── schemas/                All Zod contracts
│       ├── ux/
│       │   ├── rules/evaluate.ts        Conditions, when clauses, rule firing
│       │   ├── policy/engine.ts         Decisions: tier scoring, vetoes, priors, overrides, confidence
│       │   ├── policy/requirements.ts   Capability requirements + required states
│       │   ├── patterns/resolve.ts      Pattern matching
│       │   ├── components/resolve.ts    Component selection from resolutions
│       │   ├── pipeline.ts              runPolicy(): the deterministic pipeline
│       │   └── fixtures/                Expense-dashboard golden state
│       └── nav.ts                  Primary navigation
├── tests/                          Vitest suites + Acme design-system fixture
├── wrangler.jsonc                  Worker config: AI + KV bindings
├── next.config.ts                  Turbopack root pin + OpenNext dev bindings
└── vitest.config.mts
```

Path aliases: `@/*` → `src/*`, `@knowledge/*` → `knowledge/*`.

### Relationship to V1

- V1 is untouched apart from two lines that exclude `v2/` from its `tsconfig.json` and `eslint.config.mjs`.
- The LLM layer (`src/lib/ai/`) is copied from V1, not shared, to keep two independent OpenNext builds simple. V2's copy adds:
  - **validation-error retry:** a schema failure is fed back to the model for one more attempt;
  - an **optional mock**, so callers can choose to fail instead of returning canned data;
  - `resolveLlmConfig()`;
  - the model id in results.
- Browser storage keys use a `design-companion-v2:` prefix, and the apps run on different origins, so their settings never collide.

---

## Design decisions

| Decision | Why |
|---|---|
| **The state describes; the decision model judges** | If the LLM wrote `dataVolume: "high"`, Jev would just read the LLM's opinion back. Only hard constraints that policy reads directly are enums. |
| **Typed results instead of `value: unknown`** | Policy should never have to guess the shape of an answer. |
| **Self-describing option ids**, enforced by lint | Published research on Jev shows constrained decision heads follow the option *name* more than the rubric text bound to it. |
| **All providers re-normalized in code** | Jev, LLM and mock results are directly comparable for the PRD's benchmark, and a provider can't smuggle in an invalid value. |
| **Capabilities, not components, in knowledge** | One rule library works against any imported design system. |
| **Same pipeline for the default design system** | The import path runs on every build instead of only for users. |
| **Capability mapping cheapest-first, one batch** | Deterministic inference handles most pairs. The decision model sees only ambiguous ones in a single request, and the designer has the final word. |
| **Composites one level deep** | Keeps resolution explainable ("Toast + Btn"), with no recursive search. |
| **Gap severity inherited from requirements** | Accessibility requirements produce critical gaps without special cases. |
| **Fail-closed quota, refunds on failure** | The shared binding can't run unmetered, and visitors don't lose requests to outages they didn't cause. |
| **Thresholds and gap behaviors in `policy.json`** | Behavior is versioned configuration, not prompt text (PRD §15). |
| **Knowledge validated at module load** | Bad knowledge is a build failure, not a production surprise. |

---

## Known limitations

- **Live Jev needs account credits.** Until they're added, Jev answers with error 2021 and requests fall back to the LLM or mock.
- **Mock judgments are keyword-based.** They're plausible for demos and tests but are not real judgment, and are labelled as such.
- **Jev's real output may differ in detail.** The Jev adapter follows Cloudflare's documented output format, but hasn't yet been checked against a successful live response. Its parsing is deliberately tolerant (e.g. score levels keyed by label or index).
- **The quota is a soft limit** because KV is eventually consistent.
- **Composite resolution is one level deep.** A recipe part can't itself be a composite. Composites are checked against each part's own required states, not extra states a requirement adds.
- **The rules and patterns are a first draft.** They are UX knowledge and need a designer's review, which is planned for Milestone 5.
- **Mock judgments shape the golden test.** With real Jev answers, confidences and some close calls (layout, status feedback, navigation) may differ.
- **Only the JSON import exists.** Token files, Storybook, repository and Figma import (§37 phases 2–5) are later work.
- **No designer-facing screens yet** beyond Home and Settings.
- **PRD §33 types the provider's state as `UXState`;** the implementation accepts any object. The architecture doc will reflect this.

---

## Roadmap

**Milestone 5, Knowledge (next):**
- Bring the pattern registry to 14: Checkout, Onboarding, Authentication, Settings, Comparison and CRUD.
- Add forms, content and responsive rules.
- Review every rule and pattern with a designer, then version rules and patterns 1.0.0.

**Then:**
- Milestone 6: UX Analyze with the Decision Inspector, overrides and an exportable trace.
- Milestone 7: constrained Layout Brainstorm (Task first / Exception first / Overview first).
- Milestone 8: evaluation and Compare Solutions.
- Milestone 9: UI Copy, Feedback Summary and Design System Review.
- Milestone 10: the three-system benchmark, architecture docs and deployment.
