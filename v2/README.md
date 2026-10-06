# Design Companion V2

**AI that reasons about UX before it generates it.** A decision-guided generative UX system: the LLM interprets and generates, a decision model (TypeSafe's Jev) makes bounded UX judgments, code and UX policy enforce decisions, and the designer stays in charge.

This is a separate app from V1 (repo root), deployed as its own Cloudflare Worker so both stay usable.

- Product spec: [docs/PRD.md](docs/PRD.md) (v2.2)
- Implementation plan and status: [docs/PLAN.md](docs/PLAN.md)

## Getting started

```bash
cd v2
npm install
npm run dev     # http://localhost:3002 (V1 uses 3000)
npm test        # contract and engine tests (Vitest)
```

## Project structure

```
src/
  app/                  routes (analyze, evaluate, copy, feedback, knowledge, design-system, settings)
  components/           shared UI
  lib/
    ai/                 LLM provider dispatch (copied from V1, adds validation retry)
    schemas/            Zod contracts — every intermediate representation is validated
    ux/fixtures/        golden test inputs (expense-review dashboard)
knowledge/              versioned UX knowledge: questions, rules, patterns, capabilities, design systems
tests/                  Vitest suites
docs/                   PRD, plan, archived PRD versions
```

## Deployment

```bash
npm run deploy   # opennextjs-cloudflare build && opennextjs-cloudflare deploy
```
