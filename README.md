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

## Enabling live generation

Open **Settings** (top right of the header) and add your own API key for **Anthropic**, **Groq**, or **OpenRouter**, plus an optional model override. The key is stored only in your browser's `localStorage` — it's sent directly with each generation request to that mode's API route, forwarded straight to the provider, and never persisted or logged server-side. Clearing your browser data removes it.

This is the recommended path for the hosted deployment, since it lets each visitor bring their own key instead of sharing (and paying for) the site owner's.

For local development, you can alternatively set `ANTHROPIC_API_KEY` in `.env.local` (copy `.env.local.example`) as a server-side fallback — a saved Settings key always takes precedence over it when present.

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

- Each mode has a Next.js API route under `src/app/api/generate/<mode>/route.ts` that builds a prompt (`src/lib/prompts/`), calls the active provider via `src/lib/generate.ts`, and validates the JSON response against a Zod schema (`src/lib/types.ts`) before it ever reaches the UI — malformed or hallucinated output fails safely into an error state instead of breaking the page.
- `src/lib/generate.ts` resolves a provider per request in this order: a client-supplied key from Settings → a server-side `ANTHROPIC_API_KEY` env var → the mock fallback. Anthropic goes through the official SDK; Groq and OpenRouter are called directly as OpenAI-compatible chat-completions endpoints (`src/lib/providers.ts` holds the per-provider defaults and key-console links).
- The app is intentionally stateless server-side (per the PRD's non-goals): no database, no cross-session memory. Each mode page keeps its input/output in local React state, plus a "Refine" bar that resubmits with the prior output as context so you can iterate without starting over. The one piece of client persistence is the Settings key, deliberately scoped to `localStorage` only.
- The persistent header, tone selector, "Copy all" buttons, and layout-divergence prompt instructions directly address the four prioritized issues from the PRD's own feedback-summary demo (Section 10.C).

## Project structure

```
src/
  app/
    page.tsx                    home screen (mode selector)
    settings/page.tsx           bring-your-own-key settings
    layout-mode/page.tsx        Layout Brainstorm mode
    copy-mode/page.tsx          UI Copy mode
    feedback-mode/page.tsx      Feedback Summary mode
    api/generate/{layout,copy,feedback}/route.ts
  components/                   shared UI (InputPanel, output renderers, states)
  lib/
    generate.ts                 provider dispatch (Anthropic / Groq / OpenRouter) + mock fallback
    providers.ts                per-provider labels, default models, key-console links
    clientSettings.ts           localStorage read/write for the Settings key
    prompts/                    system + user prompt builders per mode
    mocks/                      canned demo responses per mode
    types.ts                    shared types + Zod schemas
docs/PRD.md                     full product requirements doc
```
