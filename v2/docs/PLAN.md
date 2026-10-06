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
3. **Design System Intelligence** — capability vocabulary, composition recipes, default design system JSON, normalizer, capability mapping, resolution + gap detection + gap policy, registry query APIs.
4. **UX Policy** — rule engine, policy engine, pattern resolver, component resolver. Golden test: expense dashboard via Mock provider.
5. **Knowledge base** — 30–50 rules, ~30 questions, 14 patterns, 13+ components with claims.
6. **UX Analyze** — state extraction + editing, questions/results, Decision Inspector, overrides, trace in localStorage.
7. **Layout Brainstorm V2** — constrained generation of 3 directions with gap placeholders.
8. **Evaluation** — atomic evaluation questions + deterministic checks, aggregated in code; Compare view.
9. **Migration** — UI Copy and Feedback Summary on the shared layers; Design System Review page.
10. **Benchmark & ship** — LLM-only vs LLM+DS vs decision-guided, Jev vs LLM provider; docs (UX-MODEL, DECISION-MODEL, UX-POLICY, DESIGN-SYSTEM, ARCHITECTURE); deploy.

## Needs from the owner (Milestone 2)

- Workers AI enabled on the Cloudflare account; `wrangler login` locally (the AI binding always runs remotely, so local dev incurs real, tiny charges).
- Approval to create the KV namespace for the quota.

## Status notes

- **Milestone 2:** Workers AI binding and KV namespace (`JEV_QUOTA`, id `f798c432…`) are configured in `wrangler.jsonc`. The live smoke test reached Jev through the binding; Jev returned `2021: Insufficient AI Gateway credits`, and the request fell back to the mock with visible notices. **Action for the owner:** add Workers AI / AI Gateway credits to the Cloudflare account; no code change needed.
- Failed binding calls refund the visitor's quota (failures aren't billed).
