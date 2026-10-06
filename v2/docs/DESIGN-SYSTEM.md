# Design system intelligence

This layer answers *"what can this design system actually build?"* Knowledge (rules, patterns, decisions) speaks only in **capabilities**, never component names, so the same library works against any imported system. Code: [src/lib/design-system/](../src/lib/design-system/). Screen: `/design-system`.

## Capabilities

`knowledge/capabilities.json` holds 50 capabilities in 6 categories (actions, data, input, navigation, feedback, overlay). Each has:
- **acceptance criteria**, which a claim must meet;
- **required states**;
- **accessibility obligations**.

`knowledge/decision-capabilities.json` maps every option of every decision slot to the capabilities it needs; a test checks it covers the vocabulary exactly. `knowledge/compositions.json` defines 6 **recipes** that build a capability from parts, e.g. `confirm-in-dialog` = modal-dialog + destructive-action.

## Import pipeline (PRD §21d)

```text
Phase 1 JSON ─► normalizeComponents ─► normalizeTokens ─► inferClaims ─► designSystemSchema
                 names, states,          flatten, refs,      names, variants,     + NormalizationReport
                 variants, props,        tier, category,     prop hints           + pending mappings
                 declared claims         layering checks
```

**Normalization:**
- **Names:** aliases for 40 canonical components (`Btn` → button, `DataGrid` → data-table).
- **States:** 15 canonical states (`hovered` → hover, `busy` → loading).
- **Variants:** `danger` → destructive, plus tone variants.

**Tokens:**
- dotted names, with `{refs}` resolved and cycles detected;
- each token gets a **tier** (primitive, semantic, component) and a **category**;
- layering violations (a component token aliasing a primitive) are reported.

Nothing is dropped silently; everything is in the report.

**The bundled default system** (36 components) goes through the same function on every build, so the import path is always exercised. **The Acme example** (`knowledge/design-systems/acme-example.json`) is the PRD §21f system, incomplete on purpose.

## Capability mapping (PRD §21e)

Mapping runs cheapest first, and the LLM never decides it:

| Step | Source | Confidence |
|---|---|---|
| Declared in the import | declared | 1.0 |
| Inferred from name or variants | inferred | 0.75 |
| Inferred from prop hints (`sortable`, `onSort`, `selectable`…) | inferred | 0.70 |
| Name and props agree | inferred | 0.85 |
| Decision model confirms an ambiguous pair | decision-model | its probability |
| Designer confirms or rejects | designer | 1.0 |

**Pending mappings.** Inferred claims under 0.85 become pending mappings. On `/design-system` the designer answers them directly (`POST /api/design-system/review`), producing a **new patch version** so old traces stay reproducible. Or the designer asks the decision model about all of them in one request (`POST /api/design-system/map`).

## Resolution and gaps (PRD §21c)

[gaps.ts](../src/lib/design-system/gaps.ts) resolves each requirement:

| Outcome | When |
|---|---|
| satisfied | A full claim, at or above the review threshold, with nothing missing, from a component with every required state |
| composite | A recipe whose every part is directly satisfied (one level deep, by design) |
| partial | A usable claim that is partial, misses criteria, or misses states |
| unconfirmed | Only low-confidence claims |
| missing | Nothing claims it |

Anything else becomes a **gap**:
- **Severity** is inherited from the requirement, so accessibility needs make critical gaps.
- **Kind** is missing, partial, missing-state, accessibility or unconfirmed.
- **Suggested resolutions** are add-component, extend-component, override-decision or accept-risk.

**Gap policy**, from `knowledge/policy.json`:

| Severity | Behavior |
|---|---|
| critical | **block**: no layout generation until resolved, accepted or avoided by an override |
| high | **mark-net-new**: generation proceeds; every direction must show a placeholder |
| medium, low | **warn** |

Designers settle gaps with a recorded reason. Settled gaps never block.

## The active design system

Imported systems are saved in the browser. One can be made **active**: Analyze, layouts, evaluation and copy then send it with every request, and every result records the system id and version it used. The server falls back to the bundled default when none is sent.

## Worked example (PRD §21f)

On Acme, the expense dashboard:
- **blocks** on destructive confirmation (there's no Dialog);
- **marks** row selection, bulk actions, search, pagination and the side drawer net-new.

**After the designer overrides** action confirmation to undo-toast:
- it resolves through Toast + Btn (`undo-in-toast`);
- generation is unblocked;
- every layout direction shows the five net-new placeholders.

This scenario runs in the tests ([tests/design-system/pipeline.test.ts](../tests/design-system/pipeline.test.ts), [tests/ux/layouts.test.ts](../tests/ux/layouts.test.ts)) and on screen.

## Not yet

Only the JSON import exists. Token files, Storybook, repository and Figma import are PRD §37 phases 2–5.
