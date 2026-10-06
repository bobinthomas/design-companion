# Design Companion V2 — Implementation Plan

Implements [PRD.md](PRD.md) v2.2. V2 is a separate Next.js app in `v2/`, deployed as its own Cloudflare Worker (`design-companion-v2`), so V1 keeps running unchanged.

## Decisions taken

| Topic | Decision |
|---|---|
| Separation | `v2/` folder in the V1 repo, own `package.json`, own Worker. No npm workspaces; the AI layer is copied from V1. |
| Scope | Full MVP (PRD §42), including UI Copy and Feedback Summary migration. |
| Persistence | Browser localStorage only (sessions, trace, overrides, imported design systems), exportable as JSON. Server stays stateless. |
| No-key mode | Policy, rules and design-system checks always run for real. LLM steps fall back to canned data for the expense-dashboard demo; the decision layer falls back to `MockDecisionProvider`. |
| Decision model | Jev via the Workers AI binding (`typesafe/jev`), **and** via a visitor's own Cloudflare account ID + token from Settings (takes precedence, no quota). |
| Quota | Shared binding: 2 Jev requests per IP per UTC day, tracked in KV (soft limit). On exhaustion, fall back to the next provider with a visible notice. |
| Provider fallback order | Visitor's Cloudflare token → Workers AI binding (within quota) → `LlmDecisionProvider` (BYOK LLM) → `MockDecisionProvider`. |

## Key design choices

- **UXState describes; the decision model judges.** Only hard constraints (device, frequency, expertise, audience, accessibility) are enums that policy reads directly.
- **Rules test question results** (`noul` true/false, `choice`, `score` thresholds) or hard-constraint facts. Tier order (§13) is compared lexicographically, so a lower tier can never outvote a higher one; critical avoids are vetoes.
- **Knowledge references capabilities, never component ids**, so it works against any imported design system (§21a–b).
- **Generation schemas are built per request** from the registry and gap list: invented components and unknown gaps fail validation, and the model is retried with the error.
- **Option ids are self-describing** (decision models follow the option name more than the rubric text).
- **Knowledge is bundled at build time** via static JSON imports (Workers have no runtime filesystem).

## Milestones

1. **Contracts** ✅ — all PRD §32 schemas + tests, app scaffold, Worker config.
2. **Decision infrastructure** ✅ — `DecisionProvider` + Jev (binding/REST), LLM and Mock providers; question registry; confidence bands; KV quota; live Jev smoke test.
3. **Design System Intelligence** ✅ — capability vocabulary, composition recipes, default design system JSON, normalizer, capability mapping, resolution + gap detection + gap policy, registry query APIs.
4. **UX Policy** ✅ — rule engine, policy engine, pattern resolver, component resolver. Golden test: expense dashboard via Mock provider.
5. **Knowledge base** ✅ (awaiting designer review) — patterns to 14 (Checkout, Onboarding, Authentication, Settings, Comparison, CRUD), forms/content/responsive rules, designer review of every rule and pattern → rules and patterns 1.0.0.
6. **UX Analyze** ✅ — state extraction + editing, questions/results, Decision Inspector, overrides, trace in localStorage.
7. **Layout Brainstorm V2** ✅ — constrained generation of 2–3 directions with gap placeholders, refusal when blocked, deterministic draft without an LLM.
8. **Evaluation** ✅ — atomic evaluation questions + deterministic checks, aggregated in code; Compare view; `/evaluate`.
9. **Migration** — UI Copy and Feedback Summary on the shared layers; Design System Review page.
10. **Benchmark & ship** — LLM-only vs LLM+DS vs decision-guided, Jev vs LLM provider; docs (UX-MODEL, DECISION-MODEL, UX-POLICY, DESIGN-SYSTEM, ARCHITECTURE); deploy.

## Needs from the owner (Milestone 2)

- Workers AI enabled on the Cloudflare account; `wrangler login` locally (the AI binding always runs remotely, so local dev incurs real, tiny charges).
- Approval to create the KV namespace for the quota.

## Status notes

- **Milestone 2:** Workers AI binding and KV namespace (`JEV_QUOTA`, id `f798c432…`) are configured in `wrangler.jsonc`. The live smoke test reached Jev through the binding; Jev returned `2021: Insufficient AI Gateway credits`, and the request fell back to the mock with visible notices. **Action for the owner:** add Workers AI / AI Gateway credits to the Cloudflare account; no code change needed.
- Failed binding calls refund the visitor's quota (failures aren't billed).
- **Milestone 3:** 50 capabilities, 6 composition recipes, decision-option → capability map, normalization alias tables (all versioned in `knowledge/`). The default design system (36 components, tiered tokens) imports through the same pipeline with zero findings. The PRD §21f worked example runs end to end against the `tests/fixtures/acme-design-system.json` fixture, both in tests and live over HTTP.
- **Milestone 4:** rule engine, policy engine (tier-lexicographic ranking with tie tolerance, critical vetoes, decision-model priors, design-system tier penalty, overrides), pattern and component resolvers, `POST /api/ux/decide`. 43 rules and 8 patterns were written now so the golden test is meaningful; Milestone 5 completes and reviews them. Golden test: 10 decisions for the expense dashboard, zero gaps on the default design system, blocked → unblocked on Acme via override.
- **Milestone 5:** 50 rules (forms, responsive and an input-format accessibility rule added; small-screen layout rules became critical vetoes on the hard `context.device = mobile` fact), 14 patterns (Checkout, Onboarding, Authentication, Settings, Comparison, CRUD added), 35 questions. A pattern now needs at least one matching evidence condition. Second golden scenario: mobile subscription sign-up. `docs/KNOWLEDGE.md` is the generated review copy (PRD §30 DSL). Rules and patterns stay 0.2.0 until a designer reviews them.
- **Milestone 6:** `/analyze` screen (brief → reviewable state → decision cards → Decision Inspector → overrides / acceptance → patterns, components, gaps with settlements → questions table), `/api/ux/state` and `/api/ux/analyze`, gap settlements in `runPolicy`, schema-validated session trace in localStorage with JSON export. Verified end to end in Chrome by DOM scripting; that run caught a mock payment-keyword false positive (Checkout matching the expense dashboard) and repeated rule entries in the Inspector, both fixed.
- **Milestone 7:** `/api/ux/layouts` re-runs policy server-side and refuses (409) while a critical gap blocks. The per-request generation schema now also requires every net-new gap as a placeholder in every direction, restricts cited decisions to decided slots, and requires distinct strategies; empty vocabularies mean nothing is allowed. Without an LLM, a deterministic composer drafts directions from the outcome (regions by capability, strategies by available material) under the same schema. Per-direction checks (confidence, uncovered decisions, unused components) are computed in code. Runs are kept in the session trace (last 5) with staleness detection. Prompts version 1.1.0. Verified in Chrome with screenshots, including a narrow window.
- **Milestone 8:** 15 evaluation questions (all 12 PRD §27 categories) and `evaluator.json` (issue, recommendation, severity per question; weights; caps). All subjects of one evaluation go to the decision model as a single batched request: questions copied per solution with a new optional `scope` field, which the mock honours. Deterministic checks: blocking gaps, critical-rule overrides, registry-only components, net-new placeholders, decisions shown, required data states, responsive notes. Scores are aggregated in code into 12 categories plus an overall score; critical failures cap them. `POST /api/ux/evaluate` re-runs policy and refuses stale directions (409). UI: scores and top issues on direction cards, a Compare table, full reports; `/evaluate` for described UIs against a saved analysis. Evaluation runs are kept in the session trace. Evaluator version 1.0.0. Verified in Chrome.
