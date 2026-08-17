# Design Companion

**Live demo:** https://design-companion.bobinthomas.workers.dev (runs on demo data — see below)

A prototype AI co-pilot for product designers with three focused modes:

- **Layout Brainstorm** — 2–3 structured, genuinely distinct layout directions for a screen or flow
- **UI Copy** — first-draft microcopy (buttons, headlines, empty/error states) in a chosen tone
- **Feedback Summary** — raw usability feedback turned into themes, prioritized issues, and next steps

See [docs/PRD.md](docs/PRD.md) for the full product spec this prototype implements.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app works immediately with **no setup** — every mode falls back to realistic canned demo data (transcribed from the PRD) when no API key is configured. A "Demo data" badge appears on generated output whenever this fallback is active.

## Enabling live Claude generation

1. Copy `.env.local.example` to `.env.local`.
2. Set `ANTHROPIC_API_KEY` to a real Anthropic API key.
3. Restart the dev server. Generation now calls Claude directly; the mock fallback only kicks back in if the key is removed or a request fails.

## Deployment

Hosted on Cloudflare Workers via the [OpenNext adapter](https://opennext.js.org/cloudflare):

```bash
npm run deploy   # opennextjs-cloudflare build && opennextjs-cloudflare deploy
```

The live deployment intentionally has no `ANTHROPIC_API_KEY` set, so it always serves demo data — safe for anyone to open without incurring API cost. To enable live generation on the deployed Worker instead, set the secret before deploying:

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

## How it works

- Each mode has a Next.js API route under `src/app/api/generate/<mode>/route.ts` that builds a prompt (`src/lib/prompts/`), calls Claude via `src/lib/anthropic.ts`, and validates the JSON response against a Zod schema (`src/lib/types.ts`) before it ever reaches the UI — malformed or hallucinated output fails safely into an error state instead of breaking the page.
- The app is intentionally stateless (per the PRD's non-goals): no database, no auth, no cross-session memory. Each mode page keeps its input/output in local React state, plus a "Refine" bar that resubmits with the prior output as context so you can iterate without starting over.
- The persistent header, tone selector, "Copy all" buttons, and layout-divergence prompt instructions directly address the four prioritized issues from the PRD's own feedback-summary demo (Section 10.C).

## Project structure

```
src/
  app/
    page.tsx                    home screen (mode selector)
    layout-mode/page.tsx        Layout Brainstorm mode
    copy-mode/page.tsx          UI Copy mode
    feedback-mode/page.tsx      Feedback Summary mode
    api/generate/{layout,copy,feedback}/route.ts
  components/                   shared UI (InputPanel, output renderers, states)
  lib/
    anthropic.ts                Claude client + mock fallback
    prompts/                    system + user prompt builders per mode
    mocks/                      canned demo responses per mode
    types.ts                    shared types + Zod schemas
docs/PRD.md                     full product requirements doc
```
