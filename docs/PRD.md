# Product Requirements Document (PRD)

**Product:** Design Companion
**Version:** 1.0 (Prototype)
**Author:** Product Design Candidate
**Date:** August 17, 2026
**Status:** Draft for Product Designer Interview / Take-Home Test

---

## 1. Overview

**Design Companion** is an AI-powered assistant that helps product designers and UX teams accelerate early-stage design work. It focuses on three high-leverage activities:

1. Brainstorming screen layouts and information architecture
2. Generating high-quality UI microcopy
3. Summarizing and prioritizing usability feedback

The tool is intended as a lightweight prototype (web-based or chat-based) that demonstrates core value quickly, with clear paths to a full product.

## 2. Problem Statement

Designers spend significant time on repetitive or early-stage tasks:
- Creating initial layout options and exploring structure
- Writing and iterating on UI copy (labels, empty states, errors, onboarding)
- Digesting large volumes of raw usability feedback into actionable insights

These activities are valuable but time-consuming. Existing tools (Figma AI features, ChatGPT, Dovetail, etc.) are either too general, too fragmented, or require heavy context switching. Design Companion aims to be a focused, designer-first companion that lives in the early discovery and definition stages.

## 3. Goals & Success Metrics

**Primary Goals**
- Reduce time spent on initial layout exploration and copy drafting by ≥ 40%
- Improve consistency and quality of microcopy across a product
- Turn raw usability feedback into prioritized, actionable insights in minutes instead of hours

**Success Metrics (Prototype Stage)**
- Time-to-first-useful-output < 30 seconds for each of the three modes
- User-rated usefulness ≥ 4.2 / 5 on generated layouts, copy, and summaries
- At least 3 meaningful iterations completed per session (layout or copy)
- Qualitative feedback: "This would actually save me time on real projects"

## 4. Target Users

**Primary**
- Product Designers (mid-level to senior) working on digital products
- UX Writers / Content Designers who collaborate closely with product design

**Secondary**
- Product Managers who need quick design direction or feedback synthesis
- Design Systems / UX Research teams who want consistent starting points

**User Jobs-to-be-Done**
- "Help me explore layout options before I open Figma"
- "Give me solid first-draft microcopy so I'm not starting from a blank page"
- "Turn this pile of user comments into clear themes and priorities"

## 5. Core Features (Must-Have for Prototype)

### 5.1 Layout Brainstorm Mode
**Description**
User describes a screen, flow, or feature. The system returns 2–3 structured layout options with:
- Overall hierarchy and component placement
- Key sections and their purpose
- Responsive considerations (mobile-first notes)
- Suggested interaction patterns
- Open questions / assumptions to validate

**Acceptance Criteria**
- Output is structured (not free-form paragraphs)
- Includes at least one mobile and one desktop consideration when relevant
- Clearly labels assumptions
- Offers 2–3 distinct directions (not minor variations)

### 5.2 UI Copy Generator Mode
**Description**
User provides context (screen/flow + tone + constraints). System generates:
- Primary and secondary button labels
- Headlines / subheads
- Empty states
- Error / success / warning messages
- Helper text and microcopy
- Optional variations (more formal, more playful, shorter, etc.)

**Acceptance Criteria**
- Copy is concise and follows modern UX writing principles
- Tone matches the requested voice
- Includes edge cases (errors, empty states) when relevant
- Offers 1–2 alternative phrasings for key strings

### 5.3 Usability Feedback Summarizer Mode
**Description**
User pastes raw feedback (interview notes, survey responses, support tickets, usability test observations). System returns:
- Key themes (with frequency/strength indicators)
- Prioritized list of issues (severity + impact)
- Positive signals / delighters
- Actionable recommendations
- Suggested next research questions

**Acceptance Criteria**
- Themes are clearly named and supported by evidence snippets
- Prioritization uses a simple severity × frequency logic
- Recommendations are specific and design-oriented
- Summary is scannable (bullets, not long prose)

## 6. User Flow (Happy Path)

1. User lands on Design Companion and chooses a mode (or starts with free-form prompt).
2. User provides input (description, context + tone, or raw feedback).
3. System returns structured output within seconds.
4. User can:
   - Request variations ("make it more minimal", "shorter copy", "focus on mobile")
   - Ask follow-up questions
   - Switch modes while keeping context
5. User copies useful parts into Figma / Notion / documentation.

## 7. Non-Goals / Out of Scope (v1 Prototype)

- Real-time collaboration or multiplayer
- Direct Figma plugin or design-token export
- Image/wireframe generation (text-based layouts only)
- Long-term memory across sessions (stateless for prototype)
- Advanced research synthesis (affinity mapping of 100+ interviews)
- Accessibility audit or WCAG scoring

## 8. Design Principles for the Product Itself

- **Speed over perfection** — First useful output in < 30 seconds
- **Structure over chat** — Prefer scannable cards, lists, and labeled sections
- **Designer language** — Use terms designers already know (hierarchy, empty state, severity, etc.)
- **Transparent assumptions** — Always surface what the AI assumed
- **Iteration-friendly** — Make it easy to refine without starting over

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Generic or low-quality output | Strong system prompt + structured templates + clear examples |
| Users treat output as final | Explicit labeling: "Starting point — refine in Figma / with team" |
| Scope creep into full design tool | Strict focus on the three modes only |
| Feedback summarizer hallucinates themes | Require evidence snippets for every theme |

---

## 10. Demonstration of the Three Capabilities

Below is a live demonstration using Design Companion on itself (meta) and on a realistic product scenario.

### A. Layout Brainstorm – Design Companion Home / Mode Selection Screen

**Input:** "Brainstorm a clean, focused home screen for Design Companion. Users should quickly choose between Layout, Copy, and Feedback modes. Mobile-first, professional but approachable."

**Output (2 directions):**

**Direction 1 – Card-based Mode Selector (Recommended)**
- Top: Simple logo + short tagline ("Your AI design co-pilot")
- Three large tappable cards stacked vertically on mobile, side-by-side on desktop:
  - Layout Brainstorm
  - UI Copy Generator
  - Feedback Summarizer
- Each card has icon, title, one-sentence description, and subtle "Start →"
- Bottom: Recent sessions (collapsed) + light settings
- Empty state for new users: short onboarding tip under the cards

**Direction 2 – Conversational First**
- Large prompt input at top ("What do you need help with today?")
- Quick-action chips below: Layout • Copy • Feedback
- Once a mode is chosen, the interface transforms into a focused chat + structured output panel

**Assumptions:** Users prefer speed over exploration on first visit. Mobile usage will be significant.

### B. UI Copy Generator – Key strings for Design Companion

**Input:** "Generate UI copy for Design Companion. Tone: professional, calm, helpful, slightly warm. Avoid hype."

**Sample Output:**

**Home / Mode Selection**
- Headline: Design Companion
- Subhead: Layout ideas, UI copy, and feedback summaries — fast.
- Card titles: Layout Brainstorm • UI Copy • Feedback Summary
- Card descriptions:
  - "Explore structure and hierarchy before you open Figma"
  - "First-draft microcopy that matches your product's voice"
  - "Turn raw feedback into clear themes and priorities"

**Empty / Loading states**
- Empty input: "Describe the screen or flow…"
- Generating: "Working on it…"
- No recent sessions: "Your recent work will appear here"

**Error states**
- Generic error: "Something went wrong. Try again in a moment."
- Input too short: "Add a bit more detail so I can give you something useful."

**Success / Confirmation**
- After generation: "Here's a starting point. Refine it with your team."

### C. Usability Feedback Summarizer – Simulated early feedback

**Raw feedback pasted (example):**
> "The layout suggestions were actually useful, but I wished I could ask for a mobile-only version more easily."
> "Copy was good but sometimes a bit generic. I had to tweak the tone a lot."
> "Feedback summary saved me at least 45 minutes. Love the severity ratings."
> "I got confused which mode I was in after a few messages."
> "Would be nice to save outputs or export to Notion."
> "The three options on the home screen felt clear."
> "Sometimes the layout ideas felt too similar to each other."

**Summary Output:**

**Key Themes**
1. **High value on Feedback Summarizer** (strong positive) – Multiple mentions of time savings and useful prioritization.
2. **Layout quality is solid but needs more distinctiveness and easier mobile control**.
3. **Copy requires more tone control / less generic output**.
4. **Mode awareness & navigation** – Users can lose track of which mode they are in during longer sessions.
5. **Desire for persistence** – Save / export is a clear request.

**Prioritized Issues**
| Priority | Issue | Severity | Recommendation |
|----------|-------|----------|----------------|
| P0 | Mode context can get lost | Medium-High | Persistent mode indicator + clear "Switch mode" control |
| P1 | Layout variations sometimes too similar | Medium | Explicitly generate more divergent directions + "More distinct options" button |
| P1 | Copy tone control is weak | Medium | Add tone selector (or free-text tone) + "Make it more X" quick actions |
| P2 | No save/export | Medium | Simple "Copy all" + future "Save to library" |

**Positive Signals**
- Feedback summarizer is the strongest delight
- Home screen mode selection is clear
- Overall usefulness is recognized

**Suggested Next Steps**
- Add persistent mode chip / header
- Improve layout divergence prompt
- Introduce lightweight tone controls for copy mode
- Prototype a minimal "Save output" action

---

## 11. Next Steps for the Prototype

1. Build a simple web interface (or chat interface) that supports the three modes with structured outputs.
2. Instrument basic metrics (time-to-output, mode usage, follow-up rate).
3. Run 5–8 moderated sessions with product designers.
4. Iterate on the highest-pain issues from the feedback summary above.
5. Decide whether to deepen one mode (likely Feedback Summarizer) or keep all three balanced.
