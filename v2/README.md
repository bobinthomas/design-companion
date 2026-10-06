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
9. [UX Analyze](#ux-analyze)
10. [Layout Brainstorm](#layout-brainstorm)
11. [Design System Intelligence](#design-system-intelligence)
12. [Knowledge base](#knowledge-base)
13. [API reference](#api-reference)
14. [User interface](#user-interface)
15. [Testing](#testing)
16. [Deployment](#deployment)
17. [Project structure](#project-structure)
18. [Design decisions](#design-decisions)
19. [Known limitations](#known-limitations)
20. [Roadmap](#roadmap)

---

## Status

V2 is being built in ten milestones that follow the PRD's sprint plan. **Milestones 1–7 are complete** on the `v2` branch. Milestone 5's knowledge is awaiting designer review.

| # | Milestone | Status |
|---|---|---|
| 1 | Contracts: Zod schemas for every intermediate representation, app scaffold, Worker config | ✅ Done |
| 2 | Decision infrastructure: `DecisionProvider`, Jev / LLM / mock adapters, question registry, confidence policy, quota | ✅ Done |
| 3 | Design System Intelligence: capability vocabulary, normalizer, capability mapping, gap detection, registry APIs | ✅ Done |
| 4 | UX Policy: rule engine, policy engine, pattern and component resolvers, 43 rules, 8 patterns, expense-dashboard golden test | ✅ Done |
| 5 | Knowledge base: 50 rules, 14 patterns, 35 questions, readable review document, second golden scenario | ✅ Done (awaiting designer review) |
| 6 | UX Analyze screen: state extraction and review, decision cards, Decision Inspector, overrides, gap resolution, session trace | ✅ Done |
| 7 | Decision-guided Layout Brainstorm: constrained directions, gap placeholders, refusal when blocked, deterministic checks | ✅ Done |
| 8 | UX Evaluation + Compare Solutions | Next |
| 9 | UI Copy and Feedback Summary migration; Design System Review screen | Planned |
| 10 | Benchmark (LLM-only vs LLM + design system vs decision-guided), docs, deploy | Planned |

**What works today:**
- **UX Analyze** (`/analyze`): brief → reviewable UX state → decisions you can inspect, accept or override → patterns, components and design-system gaps → **layout directions** built only from your design system, with an exportable trace.
- The full pipeline as JSON APIs (`/api/ux/state`, `/api/ux/decide`, `/api/ux/analyze`, `/api/ux/layouts`).
- The Settings screen.
- 216 passing tests.
- A designer-readable copy of all UX knowledge: [docs/KNOWLEDGE.md](docs/KNOWLEDGE.md).

The remaining screens (Evaluate, Copy, Feedback, Knowledge, Design System Review) arrive in Milestones 8–9. Until then their header links lead to 404 pages.

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
| `npm run knowledge:doc` | Regenerate [docs/KNOWLEDGE.md](docs/KNOWLEDGE.md) from `knowledge/` |

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
│ GENERATION                   │   per-request schema: only registry
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

A pattern that has evidence conditions must match **at least one** of them: being compatible with a decision (a table was chosen) doesn't make something a Comparison. Patterns scoring 0.5 or more are included. The best fit is `primary`; ties go to more matched decisions, then more matched conditions. The rest are `supporting`.

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

## UX Analyze

[src/app/analyze/page.tsx](src/app/analyze/page.tsx) · [src/components/analyze/](src/components/analyze/) · [src/lib/session/](src/lib/session/)

The first designer-facing screen. It follows the PRD §46 journey, and **the designer reviews the state before any decision-model request is spent**.

```text
1. Brief ──► /api/ux/state ──► 2. Review the UX state ──► /api/ux/decide ──► 3. Decisions
                               (edit constraints, confirm        │              (accept · inspect · override)
                                assumptions, or edit JSON)       │                     │
                                                                 ▼                     ▼
                                           4. Patterns · components · gaps   re-run policy only:
                                              (settle gaps with a reason)    earlier results reused,
                                                                             no new Jev request
```

### 1. Brief → UX state

[state/extract.ts](src/lib/ux/state/extract.ts) prompts the visitor's LLM to **describe, not judge**:
- It writes "Roughly 200 pending reports per manager per week", never "high", and never names a UI.
- It chooses only the hard constraints (device, frequency, expertise, audience, accessibility) from fixed vocabularies, quoted in the prompt.
- It records every assumption it made as an *ambiguity* for the designer to confirm.

The output is validated against `uxStateSchema`, and the designer's own words are kept as `brief` even if the model paraphrases them.

**Without an LLM key**, the closest prepared demo state is returned (expense dashboard or subscription sign-up, chosen by keywords). A notice says so plainly, including "not your brief" when the brief doesn't match the example.

### 2. State review

The state is summarized: product, users, goal, tasks, data and actions.
- **Hard constraints** are editable in place, because policy reads them directly as facts. Switching the device to *mobile*, for example, triggers the small-screen vetoes.
- **Assumptions** can be confirmed one by one.
- **Edit as JSON** opens the full state, validated before it's used.

Any edit is recorded as `state-edited` and clears derived decisions, so nothing stale survives.

### 3. Decisions

One card per decision (PRD §47) shows:
- the choice;
- confidence as a percentage and a band: *Confident*, *Uncertain* or *Needs review*;
- **who decided it**: *Determined by UX rules*, *Decision-model judgment*, *Designer decision* or *Default*;
- the top reasons and any ruled-out options;
- **Accept** and **Inspect / change**.

A banner names the decision provider (Jev, your LLM, or demo judgments), repeats the fallback notices, and shows policy warnings such as an override that contradicts a critical rule.

### 4. Decision Inspector

A slide-over dialog with focus management and Escape to close, laid out as PRD §17:

| Section | Contents |
|---|---|
| Decision / Recommendation | The question, the choice, who decided, the confidence band |
| Why | The rule reasons, plus the decision model's rating when it agrees |
| Questions (evidence) | Each question with ✓ / ✗ / ? (or the chosen option or score level), its probability and which provider answered |
| Rules | One entry per rule: code, tier and priority; what it recommends, avoids or **rules out**; its reason |
| Alternatives | Each rejected option and why, with vetoes marked |
| Needs from the design system | The capabilities this choice requires |
| Override | Choose another option and give a reason. Vetoed options are labelled, and choosing one shows the critical rule inline; it's allowed, and the conflict is recorded |

After an override, the Inspector shows *"You changed this from X to Y"*, the reason, *"the rules themselves are unchanged"*, and a button to return to the system recommendation.

### 5. Patterns, components, gaps

Three panels:
- **Patterns:** the primary pattern and its fit, plus the required states.
- **Components:** each with the capabilities it serves, and whether it's composed from parts.
- **Gaps:** each with its behavior (blocks generation / net-new component needed / warning). Generation-blocked state is announced.

Each open gap can be **resolved** (accept the risk, extend or add a component) with a recorded reason, or reopened later. Settlements go into the pipeline (`gapSettlements`), so an accepted critical gap stops blocking.

Below the panels, a collapsible table lists **all 35 questions and their raw answers**.

### Session trace (§29 / §50)

[session/session.ts](src/lib/session/session.ts) defines `AnalysisSession`, a versioned, schema-validated trace. It holds:
- the brief and the state, with its source (LLM model, demo, or edited);
- the decision-model results and provider;
- the full policy outcome, including its knowledge versions;
- overrides, acceptances and gap settlements;
- an **event log**: created, state-extracted, state-edited, decided, accepted, overridden, override-removed, gap-settled, gap-reopened, layouts-generated;
- the last 5 Layout Brainstorm runs.

Every update is a pure function. Two consistency rules:
- **Acceptances are tied to the accepted choice.** If an override or re-run changes the choice, the acceptance lapses.
- **A state edit clears everything derived from the old state.**

[session/storage.ts](src/lib/session/storage.ts) keeps the 20 most recent sessions in `localStorage` (`design-companion-v2:analysis-sessions`). Reads are defensive: invalid entries are skipped and unavailable storage is tolerated. Sessions can be reopened from the header picker, deleted, or **exported as JSON**.

### Re-running without spending Jev

The client ([client/api.ts](src/lib/client/api.ts)) sends the session's earlier `results` with every override or gap action. The server re-runs policy only and says so in a notice. Only **Re-run decisions with fresh judgments** calls the decision model again.

---

## Layout Brainstorm

[src/lib/ux/layouts/](src/lib/ux/layouts/) · [src/app/api/ux/layouts/route.ts](src/app/api/ux/layouts/route.ts) · [src/components/analyze/LayoutDirections.tsx](src/components/analyze/LayoutDirections.tsx)

PRD §22–23. The last step of UX Analyze: **2–3 layout directions** inside the space the decisions define. The LLM explores that space; it doesn't define it.

```text
policy outcome ──► blocked? ──yes──► refused (409), naming the gap and the decision to change
                      │ no
                      ▼
   generationVocabulary(outcome) ──► per-request schema
                      │
        LLM configured? ──yes──► layout prompt + the constrained space ──► validated (one retry with the error)
                      │ no
                      ▼
            composeDirections() — deterministic draft, same schema
                      │
                      ▼
       checkDirections() — confidence, decisions shown, components left out
                      │
                      ▼
            LayoutBrainstorm ──► session trace ("layouts-generated")
```

### What constrains a direction

`generationVocabulary()` turns the policy outcome into the schema the generator is held to (`buildGenerationSchema` in [generation.ts](src/lib/schemas/generation.ts)):

| Constraint | Effect |
|---|---|
| Components | Only components the registry selected. An invented or renamed component fails validation |
| Gaps | Placeholders `{ gap, purpose }` may reference only non-blocking gaps |
| Net-new gaps | **Every** `mark-net-new` gap must appear as a placeholder in **every** direction, so a missing capability is never drawn as if it existed |
| Patterns, rules | Only matched patterns and rules that fired may be cited |
| Decisions | `supportingDecisions` may cite only slots policy decided |
| Distinctness | Unique ids and a different strategy per direction |
| Empty lists | With a vocabulary, an empty list means *nothing* is allowed, not anything |

A failed validation is fed back to the model for one more attempt.
- **The prompt lists every decision** with its confidence, top reason and **ruled-out options**, so the model can't reintroduce a vetoed choice.
- **Designer steering:** an optional instruction (e.g. *"make one direction work one-handed on a phone"*) is passed through, within the same rules.

### Refusal when blocked (§21c)

The server **re-runs policy itself** from the session's state, results, overrides and gap settlements; it never trusts an outcome sent by the browser. If a critical gap blocks generation, `/api/ux/layouts` answers `409` with the blocking gaps. The screen says what's missing and which decision could be overridden instead.

### Without an LLM: the deterministic draft

[compose.ts](src/lib/ux/layouts/compose.ts) builds directions from the outcome alone; nothing is canned:

- **Regions** come from what each selected component serves: overview, navigation or progress, search and filters, the primary task (named after it), bulk actions, detail, actions, feedback and confirmation. A component appears in every region it serves, described by what it does there. For example, Button applies filters in one region and confirms a rejection in another.
- **Gap placeholders** go where their capability would have been, labelled e.g. *"Net-new component required: Row selection (missing select-all, …)"*.
- **The first work component** carries the data states policy requires (loading, empty, error…).
- **Strategies** apply only when the outcome has the material for them:

| Strategy | Applies when | Leads with |
|---|---|---|
| Task first | there is a primary-task region | the primary task |
| Exception first | search or filters plus a data presentation | "Needs attention": filters preset to problem items |
| Overview first | a metric or chart component | the summary |
| Focus first | a detail view | the open item, with a compact list beside it |
| Guidance first | progress or feedback components | progress and guidance, then the step |
| Compact | only if fewer than two others apply | the primary task, in one column |

Results for the two golden scenarios:
- **Expense dashboard:** *Task first / Exception first / Focus first*.
- **Mobile sign-up:** *Task first / Guidance first*, with phone notes and no desktop notes.

The draft passes through the same per-request schema as an LLM's output and is labelled *"Drafted without an LLM"*.

### Checks computed in code

[checks.ts](src/lib/ux/layouts/checks.ts) computes, for each direction, what no generator is trusted to report:

| Check | Meaning |
|---|---|
| `confidence` + band | Mean confidence of the decisions the direction builds on (all decisions if it cites none) |
| `uncoveredDecisions` | Decided slots whose required capabilities the direction doesn't show |
| `unusedComponents` | Selected components the direction leaves out |
| `gapPlaceholders` | Gaps it shows |

Full UX evaluation scores arrive in Milestone 8.

### On screen

Below the patterns, components and gaps panels:
- **Each direction is a card** with a top-to-bottom region wireframe. Component chips show name, purpose and states; gap placeholders are dashed amber chips.
- **Why this direction:** rationale, advantages, trade-offs, supporting decisions, rule codes, and phone and desktop notes.
- **Check notes:** "Doesn't show…" and "Leaves out…", where they apply.
- **Header line:** the source (LLM model or draft), time and design-system version. It warns when **the decisions have changed since generation** (`layoutsStale`).
- **Run history:** the last 5 runs are kept in the session, with a picker for earlier ones. Editing the state clears them.
- **When blocked**, the form is replaced by an explanation of what to resolve.

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
| `manifest.json` | Versions: question set 1.1.0, rules 0.2.0, policy 1.2.0, patterns 0.2.0, capabilities 1.0.0, compositions 1.0.0, normalization 1.0.0, prompts 1.1.0 (adds the layout prompt). The evaluator stays at 0.0.0 until written; rules and patterns become 1.0.0 once a designer has reviewed them |
| `policy.json` | Confidence thresholds (0.85 / 0.65), noul threshold (0.7), quota (2/IP/day), gap behaviors, capability-mapping confidences and question cap, and **ranking**: tie tolerance 0.25, prior weight 1, priority weights (3 / 2 / 1 / 0.5), design-system penalties, max 3 alternatives |
| `ux-rules/*.json` | **50 UX rules** in 11 files: accessibility, tables, filtering, search, layout, error-prevention, feedback, navigation, selection, forms, responsive |
| `patterns.json` | **14 UX patterns**, defined by capabilities |
| `questions/analysis.json` | **35 analysis questions** (26 noul, 6 choice, 3 score) |
| `capabilities.json` | **50 capabilities** in 6 categories, each with acceptance criteria, required states and accessibility obligations |
| `compositions.json` | **6 composition recipes** |
| `decision-capabilities.json` | For every option of every decision slot, the capabilities it needs. Validated to cover exactly the vocabulary |
| `normalization.json` | Alias tables: 40 components (with implied capabilities), 10 variants, 15 states, 7 prop-hint groups |
| `design-systems/default.json` | The bundled default design system: **36 components**, tokens in all three tiers and seven categories |

### UX rules

| File | Rules (code: what it does) |
|---|---|
| `accessibility.json` | INPUT_FORMAT_INSTRUCTIONS: format hints and fixable errors (SC 3.3.2 / 3.3.3) · STATUS_NOT_COLOR_ONLY: status badges with text (SC 1.4.1) · REACHABLE_CONTENT: avoid infinite scroll (SC 2.1.1 / 2.4.1) · ERRORS_PERSISTENT: no toasts for input errors (SC 3.3.1) · TIMING_ADJUSTABLE: no auto-dismissing feedback under time pressure (SC 2.2.1) · DRAG_ALTERNATIVE: menu alternative to dragging (SC 2.5.7) · SAFE_DEFAULT_FOCUS: destructive buttons never the default focus (SC 1.4.1 / 2.4.7) |
| `tables.json` | DATA_VOLUME_HIGH, COMPARISON_REQUIRED, INFO_DENSITY_HIGH: data table · VISUAL_RECORDS: cards · STAGED_RECORDS: kanban · TIME_ORDERED_RECORDS: timeline · PAGINATION_HIGH_VOLUME: paginate · SORTED_LIST_POSITION: avoid infinite scroll · BULK_ACTIONS_REQUIRED: bulk action bar |
| `filtering.json` | FILTER_REQUIRED: persistent filter bar for frequent use · FILTER_OCCASIONAL: filter panel · FILTER_UNNECESSARY: no filters for small sets |
| `search.json` | SEARCH_REQUIRED: visible search · GLOBAL_SEARCH_DEEP_APP: global search across many sections |
| `layout.json` | CONTEXT_PRESERVATION: side panel · LIST_DETAIL_WORKFLOW: split view · AGGREGATE_MONITORING: dashboard · MULTI_STEP_TASK: multi-step · SMALL_SCREEN_SPLIT_VIEW: **rules out** split view when `context.device` is mobile (critical) |
| `error-prevention.json` | DESTRUCTIVE_PROTECTED: confirm or undo, **vetoes `none`** (critical) · IRREVERSIBLE_CONFIRM: confirm, not undo · REVERSIBLE_UNDO: undo, not confirm · HIGH_ERROR_COST: confirm |
| `feedback.json` | ASYNC_OUTCOME: toast · BULK_RESULT_SUMMARY: toast · INLINE_VALIDATION: inline message · DATA_STATES_REQUIRED: loading / empty / error states plus an empty-state capability |
| `navigation.json` | SINGLE_SCREEN: none · PEER_SECTIONS: tabs · DEEP_APP_NAVIGATION: sidebar · MOBILE_PRIMARY_NAV: bottom nav · STEP_PROGRESS: stepper |
| `selection.json` | MULTI_SELECT_INDEPENDENT: checkbox · SINGLE_SELECT_FEW: radio · SINGLE_SELECT_MODERATE: select · SINGLE_SELECT_MANY: combobox · IMMEDIATE_SETTING: toggle |
| `forms.json` | STEPPED_DATA_ENTRY: wizard · LONG_FORM_SECTIONED: one sectioned page with validation · INLINE_EDIT_SMALL_CHANGES: inline edit · SHORT_AUTH_FORM: single-page sign-in / sign-up |
| `responsive.json` | SMALL_SCREEN_DETAIL: **rules out** side panels on phones when there's a list to keep (critical) · SMALL_SCREEN_FILTERS: filter panel when mobile use is likely |

Rules cite their sources (WCAG success criteria, NN/g, Nielsen's heuristics) where one applies.

**Hard device constraints.** "Users are on a phone" can be a judgment (`device.mobile.likely`, technical tier, a preference) or a fact (`context.device = mobile`). When it's a fact, layouts that physically can't fit are **ruled out** by critical rules rather than merely discouraged. Otherwise a task-tier rule such as CONTEXT_PRESERVATION would put a side panel on a phone.

**Review copy.** [docs/KNOWLEDGE.md](docs/KNOWLEDGE.md) renders every rule in the PRD §30 DSL (`WHEN … RECOMMEND … AVOID / RULE OUT … BECAUSE … SOURCE`), plus every pattern and question, with a reviewer's checklist. It's generated by `npm run knowledge:doc` and a test fails if it's stale. [src/lib/ux/rules/dsl.ts](src/lib/ux/rules/dsl.ts) does the rendering.

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
| Checkout | text-input, form-validation, step-indicator, primary-action | layout = multi-step / single-page, formStructure = wizard / single-page-form |
| Onboarding | step-indicator, primary-action | layout = multi-step, navigation = stepper |
| Authentication | text-input, form-validation, primary-action | formStructure = single-page-form |
| Settings | on-off-toggle, inline-message | selection = toggle / radio / select, navigation = tabs / sidebar, formStructure = inline-edit |
| Comparison | (none; table or cards optional) | dataPresentation = data-table / card-grid |
| CRUD | primary-action, destructive-action, text-input | formStructure = single-page-form / inline-edit, actionConfirmation = confirm-dialog / undo-toast |

Each pattern also lists optional capabilities, required states, the conditions that recommend it, the patterns it composes with, and anti-patterns.

### Analysis questions

| Area | Questions |
|---|---|
| Data | volume high? · comparison required? · filtering required? · sorting required? · search required? · information density (score) · records recognized visually? · data structure (choice) |
| Task | performed frequently? · bulk actions required? · details needed without losing place? · multi-step? · data-entry heavy? · long form? · aggregate metrics monitored? · exceptions important? · time pressure (score) |
| Actions & risk | destructive actions present? · destructive actions easily undone? · cost of error (score) |
| Interaction & context | number of sections (choice) · selection mode (choice) · option count (choice) · mobile use likely? · outcomes asynchronous? |
| Flows & scope | payment involved? · sign-in / sign-up? · first-use guidance needed? · settings? · comparing alternatives? · full create / edit / delete? · frequent single-field edits? · formatted input? |
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

### `POST /api/ux/state`

Brief → UX state (interpretation only). Uses `clientConfig` if given.

```jsonc
// request
{ "brief": "Design an expense-review dashboard for managers." }
// response
{ "state": { /* UXState */ }, "source": "llm" | "demo", "model": "anthropic:claude-sonnet-5", "notices": [] }
```

### `POST /api/ux/analyze`

PRD §34 one-shot analysis: prompt → state → decision model → policy → patterns → components → gaps. Takes the same `overrides`, `gapSettlements` and `designSystem` as `/decide`, and returns the `/decide` response plus `stateSource`.

```jsonc
{ "prompt": "Design an expense-review dashboard for managers." }
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
  "gapSettlements": [
    { "gapId": "gap.row-selection", "kind": "accept-risk", "reason": "Bulk select ships in v2", "timestamp": "2026-10-06T12:00:00.000Z" }
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

### `POST /api/ux/layouts`

Layout Brainstorm (PRD §23). It never calls the decision model:
1. The server re-runs policy from the analysis inputs.
2. While a critical gap blocks generation, it refuses with `409`.
3. Otherwise it generates with the visitor's LLM, or drafts deterministically when there's no key.

```jsonc
// request
{
  "state": { /* UXState */ },
  "results": [ /* required: the analysis's decision-model results */ ],
  "overrides": [], "gapSettlements": [], "designSystem": { /* optional */ },
  "instruction": "Make one direction mobile-first",            // optional, ≤ 500 chars, LLM only
  "clientConfig": { "provider": "anthropic", "apiKey": "…" }   // optional
}

// response: a LayoutBrainstorm
{
  "id": "…", "generatedAt": "2026-10-06T14:19:00.771Z",
  "source": "llm" | "draft", "model": "anthropic:claude-sonnet-5" | "draft",
  "notices": [], "basedOn": [ { "decision": "dataPresentation", "choice": "data-table" } ],
  "designSystem": { "id": "default", "version": "1.0.0" }, "prompts": "1.1.0",
  "output": { "variants": [ { "id": "task-first", "title": "Task first", "regions": [ … ], … } ], "assumptions": [ … ] },
  "checks": [ { "variantId": "task-first", "confidence": 0.84, "band": "uncertain",
                "uncoveredDecisions": [], "unusedComponents": [], "gapPlaceholders": [] } ]
}

// 409 when blocked
{ "error": "Generation is blocked by a critical design-system gap: destructive-confirmation. …",
  "blockingGaps": [ { "id": "gap.destructive-confirmation", "capability": "destructive-confirmation" } ] }
```

### `POST /api/decision-model/evaluate`

Answers atomic questions against a UX state. It returns raw, typed results only; policy is applied elsewhere.

```jsonc
// request
{ "state": { /* UXState */ }, "questionIds": ["data.volume.high"] }  // questionIds optional (default: all 35)

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
| `/analyze` | ✅ | **UX Analyze**: brief, state review, decision cards, Decision Inspector, overrides, patterns / components / gaps, **layout directions**, questions table, session picker and trace export (see [UX Analyze](#ux-analyze) and [Layout Brainstorm](#layout-brainstorm)) |
| `/evaluate`, `/copy`, `/feedback`, `/knowledge` | Milestones 8–9 | Linked from the header and home page; not built yet |
| `/design-system` | Milestone 9 | Design System Review (import, report, capability matrix, gaps); not yet linked |

Styling uses Tailwind CSS v4 with Geist fonts, light and dark, consistent with V1.

---

## Testing

```bash
npm test     # 13 suites, 216 tests
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
| `tests/ux/subscription.test.ts` | **Second golden scenario**: mobile-first subscription sign-up and checkout. Steps with progress (multi-step, stepper, wizard), split view vetoed on the phone, no detail view without a list, the wizard vs short-auth conflict surfaced as uncertain, persistent inline errors, checkout-family patterns, no gaps |
| `tests/ux/analyze.test.ts` | State extraction (the describe-don't-judge prompt, labelled demo states, the designer's brief preserved); `analyzeState` reusing results, rejecting unknown questions, applying gap settlements; the session trace (event log, schema-valid round trip, acceptances tied to choices, state edits clearing derived data) |
| `tests/ux/layouts.test.ts` | Layout Brainstorm: the draft composer's directions for both golden scenarios (distinct leads, schema-valid, every component used, every decision shown, data states carried); refusal while Acme is blocked; after the undo override, every net-new gap placed in every direction and only Acme's components used; the LLM path held to the per-request schema (invented components and hidden gaps rejected, vetoes and steering in the prompt); direction checks; runs in the session trace, staleness, and loading older sessions |
| `tests/ux/knowledge-doc.test.ts` | DSL rendering of rules (including vetoes as RULE OUT) and that `docs/KNOWLEDGE.md` matches `knowledge/` |
| `tests/design-system/pipeline.test.ts` | Normalizer (names, states, variants, tokens, findings), capability mapping (declared, inferred, decision-model confirmation and rejection, designer review), and the full §21f worked example including override and accepted risk |

Tests run against the deterministic mock and fake bindings, so they need no network or credentials.

The UX Analyze screen was also checked end to end in Chrome against `next dev`, scripted through the DOM:
- brief → demo state → 10 decisions → the Inspector (evidence, grouped rules, alternatives);
- picking a vetoed option shows the warning; an override to undo-toast is applied and recorded;
- reload, then the session is restored from the picker and Accept works;
- no console errors.

Milestone 7 was checked the same way, plus screenshots:
- brief → decisions → Brainstorm → three directions;
- the run is stored in the trace;
- an override shows the "decisions have changed" warning;
- at the narrowest window width, no horizontal scroll.

The run surfaced a hydration warning on `<html>`, caused by a browser extension editing its class. It's now suppressed for that element only.

The Milestone 6 run caught two bugs the unit tests had missed, now fixed: a Checkout pattern falsely matching the expense dashboard (a mock keyword), and rules repeated once per effect in the Inspector.

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
│   ├── KNOWLEDGE.md                Generated review copy of all rules, patterns, questions
│   └── archive/                    PRD v2.0 and v2.1
├── knowledge/                      Versioned UX knowledge (validated at build)
│   ├── manifest.json
│   ├── ux-rules/*.json             50 rules in 11 files
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
│   │   ├── analyze/page.tsx        UX Analyze
│   │   ├── settings/page.tsx       Settings (LLM + Jev)
│   │   ├── layout.tsx              Root layout + header
│   │   └── api/
│   │       ├── decision-model/{evaluate,quota}/route.ts
│   │       ├── design-system/{capabilities,default,import,map,gaps}/route.ts
│   │       └── ux/{state,decide,analyze,layouts}/route.ts
│   ├── components/
│   │   ├── AppHeader.tsx
│   │   ├── CloudflareSettings.tsx
│   │   └── analyze/                BriefForm, StateReview, DecisionCard, DecisionInspector, SolutionPanel, LayoutDirections, QuestionsTable
│   └── lib/
│       ├── ai/                     LLM dispatch (from V1) + validation retry
│       ├── api.ts                  Shared request parsing and decision context
│       ├── client/                 Browser-side API calls (credentials attached) and display formatting
│       ├── session/                Analysis session trace + localStorage persistence
│       ├── cloudflare.ts           Worker bindings and client IP
│       ├── decision-model/         Provider interface, adapters, confidence, quota, fallback chain
│       ├── design-system/          Tokens, normalizer, capability mapping, import, registry, gaps, default
│       ├── knowledge/              Loads and validates knowledge/
│       ├── schemas/                All Zod contracts
│       ├── ux/
│       │   ├── rules/evaluate.ts        Conditions, when clauses, rule firing
│       │   ├── rules/dsl.ts             PRD §30 DSL rendering
│       │   ├── knowledge-doc.ts         Builds docs/KNOWLEDGE.md
│       │   ├── policy/engine.ts         Decisions: tier scoring, vetoes, priors, overrides, confidence
│       │   ├── policy/requirements.ts   Capability requirements + required states
│       │   ├── patterns/resolve.ts      Pattern matching
│       │   ├── components/resolve.ts    Component selection from resolutions
│       │   ├── pipeline.ts              runPolicy(): the deterministic pipeline (+ gap settlements)
│       │   ├── analyze.ts               analyzeState(): decision model + policy, shared by the routes
│       │   ├── state/extract.ts         Brief → UX state (LLM prompt, demo fallback)
│       │   ├── layouts/                 Layout Brainstorm: generate (prompt, refusal), compose (draft), checks
│       │   └── fixtures/                Golden states: expense dashboard, subscription sign-up
│       └── nav.ts                  Primary navigation
├── scripts/knowledge-doc.ts        npm run knowledge:doc
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
  - the model id in results;
  - a per-call output token cap (`maxTokens`; layouts use 8,192).
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
- **The rules and patterns await designer review.** They are UX knowledge, versioned 0.2.0 until reviewed; [docs/KNOWLEDGE.md](docs/KNOWLEDGE.md) is the review copy.
- **Some slots rely on the decision model alone.** For example, no rule speaks to presenting a few plans for comparison, so the subscription scenario's data presentation comes only from the prior. With the mock that's `list`; with Jev it would be a real judgment.
- **The 50-rule ceiling** (the PRD's 30–50 target) is enforced by a test. Content and copy rules arrive with UI Copy in Milestone 9.
- **Mock judgments shape the golden test.** With real Jev answers, confidences and some close calls (layout, status feedback, navigation) may differ.
- **Only the JSON import exists.** Token files, Storybook, repository and Figma import (§37 phases 2–5) are later work.
- **Only UX Analyze (with Layout Brainstorm) is built so far** among the designer-facing screens (plus Home and Settings).
- **The phone-width check stopped at 568px**, Chrome's minimum window width. Narrower phones haven't been checked by eye.
- **Draft directions are generic.** Without an LLM, region wording comes from templates and all directions share the same decision basis, so their confidences are equal. With an LLM, directions are problem-specific.
- **Directions are not yet scored.** Evaluation scores (PRD §23) arrive with Milestone 8; today each direction shows decision confidence and coverage checks.
- **Steering starts fresh.** Layout runs aren't sent back to the LLM as prior output, so "generate again" with steering doesn't refine the previous run.
- **The state editor** offers in-place edits for hard constraints and assumptions only; everything else is edited as JSON.
- **PRD §33 types the provider's state as `UXState`;** the implementation accepts any object. The architecture doc will reflect this.

---

## Roadmap

**Milestone 8, UX Evaluation and Compare (next):**
- Atomic evaluation questions plus deterministic checks, aggregated in code into the 12 `UXEvaluation` categories.
- Scores for each layout direction, and a Compare view across directions.
- `/evaluate` for a described UI or spec.

**Then:**
- Milestone 9: UI Copy, Feedback Summary and Design System Review.
- Milestone 10: the three-system benchmark, architecture docs and deployment.
