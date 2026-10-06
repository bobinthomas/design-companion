# Design Companion V2 — Corrected Product Requirements Document

**Status:** Proposed  
**Version:** 2.2  
**Changes in 2.2:** Specifies the Design System Intelligence layer (§21a–21f: capability vocabulary, capability requirements, resolution and gap detection, normalizer, capability mapping, Design System Review); adds design-system contracts and APIs; promotes override, confidence handling and versioning to Must; fixes the §48 flow; completes versioning and trace. Earlier versions: `docs/archive/`.  
**Product:** Design Companion  
**Repository:** `bobinthomas/design-companion`  
**Core thesis:** **LLMs interpret and generate. Decision models make bounded UX judgments. Code and UX policy enforce decisions. Designers retain authority.**

---

## 1. Executive Summary

Design Companion V2 is a **decision-guided generative UX system**.

The product should not behave like a conventional AI UI generator where a large language model is asked to decide everything and then produce an interface.

Instead, Design Companion separates the UX workflow into distinct responsibilities:

1. **LLM** — interprets natural-language briefs, extracts context, synthesizes information, generates copy and explores alternatives.
2. **Decision Model** — evaluates small, explicit UX questions against a structured UX state.
3. **UX Policy / Rules Engine** — combines judgments with deterministic rules, constraints, accessibility requirements, business requirements, and design-system rules.
4. **Pattern Resolver** — selects appropriate UX patterns.
5. **Design System Registry** — constrains component and token choices.
6. **LLM Generation Layer** — generates interface directions within the valid solution space.
7. **UX Evaluation Layer** — evaluates the resulting solution against the original intent and constraints.
8. **Designer** — can inspect, accept, reject, override, or refine every important decision.

The architectural principle is:

> **LLMs generate possibilities. Decision models make bounded judgments. Code and UX rules enforce policy.**

This distinction is informed by TypeSafe's Jev approach: state is evaluated through typed, atomic questions that return structured results such as choices, scores, probabilities, confidence, and truth-like values, rather than relying on generated text that must be parsed into decisions.

---

# 2. Product Vision

### Current paradigm

> "Tell the AI what UI to make."

### Design Companion V2 paradigm

> **"Help me understand the UX problem, make defensible UX decisions, explore valid solutions, and explain why they work."**

### Positioning

Possible positioning statements:

- **AI that reasons about UX before generating it.**
- **A decision-guided generative UX system.**
- **Don't just generate UI. Understand the UX.**
- **UX decisions first. UI generation second.**

---

# 3. Problem Statement

Generative UI systems are good at producing plausible interfaces but have fundamental weaknesses when the model is responsible for making all UX decisions.

Common problems:

- inconsistent interaction patterns
- arbitrary component selection
- weak information architecture
- poor handling of edge cases
- inaccessible interaction choices
- design-system drift
- inconsistent reasoning across generations
- difficulty explaining why a decision was made
- difficulty testing or benchmarking UX decisions
- inability to deterministically change decision priorities
- hidden assumptions inside prompts
- difficult auditing and versioning

A designer should be able to ask:

> Why did the system choose a table?

and receive:

- the question that was evaluated
- the state used
- the decision
- confidence/probabilities where available
- deterministic rules that were applied
- constraints that affected the decision
- alternatives considered
- why alternatives were rejected
- the final component/pattern mapping
- the ability to override the result

---

# 4. Core Architectural Insight

## 4.1 Do not make the LLM the decision engine

Avoid:

```text
Prompt
  ↓
LLM
  ↓
"DataTable because..."
  ↓
UI
```

Instead:

```text
User Brief
    ↓
LLM
    ↓
UX Intent / State
    ↓
Atomic Decision Questions
    ↓
Decision Model
    ↓
Structured Judgments
    ↓
Deterministic UX Policy
    ↓
Pattern
    ↓
Components
    ↓
LLM Generation
    ↓
Evaluation
```

---

# 5. Decision Model vs LLM

| Responsibility | LLM | Decision Model | Code / Rules | Designer |
|---|---:|---:|---:|---:|
| Natural-language understanding | ✓ | | | |
| Requirements extraction | ✓ | | | |
| Ambiguity detection | ✓ | | | ✓ |
| UX state construction | ✓ | | | ✓ |
| Atomic UX judgment | | ✓ | | |
| Choice evaluation | | ✓ | | |
| Scoring | | ✓ | | |
| Truth / likelihood evaluation | | ✓ | | |
| Probability/confidence | | ✓ | | |
| Combine multiple judgments | | | ✓ | |
| Accessibility policy | | | ✓ | ✓ |
| Business constraints | | | ✓ | ✓ |
| Component availability | | | ✓ | |
| Design-system ingest & normalization | | | ✓ | ✓ |
| Component → capability mapping | | ✓ (ambiguous pairs only) | ✓ (declared / inferred) | ✓ (confirms) |
| Capability requirements | | | ✓ | |
| Design-system gap detection | | | ✓ | |
| Gap resolution | | | | ✓ |
| Design-system compliance | | | ✓ | |
| Generate copy | ✓ | | | |
| Generate UI alternatives | ✓ | | | |
| Explain decisions | ✓ | | | ✓ |
| Final approval | | | | ✓ |

---

# 6. Role of Jev / System-One Decision Models

Jev should **not** be treated as the complete Design Companion UX knowledge base.

Instead, it is the **decision-model mechanism** used to answer bounded questions.

Conceptually:

```text
                    UX STATE
                       │
                       ▼
              ┌─────────────────┐
              │ Decision Model  │
              │                 │
              │ Choice          │
              │ Score           │
              │ Noul            │
              └────────┬────────┘
                       │
                       ▼
              Structured Results
                       │
                       ▼
              UX Policy / Rules
                       │
                       ▼
                  UX Decision
```

TypeSafe describes Jev as evaluating typed questions against state and returning structured results directly. Its documented primitives are Choice, Score, and Noul; questions should be atomic and composable in application code.

Design Companion should adopt this architectural principle while keeping the UX policy layer independent from the decision-model provider.

### Important abstraction

The application should define its own interface:

```ts
interface DecisionProvider {
  evaluate(
    state: UXState,
    questions: DecisionQuestion[]
  ): Promise<DecisionResult[]>
}
```

A Jev adapter can implement this interface.

This prevents Design Companion from coupling its entire architecture to a single model provider.

---

# 7. UX State / Intent Model

The LLM converts the user's brief into a structured UX state.

Example:

```json
{
  "product": "Expense Management",
  "user": {
    "role": "Manager",
    "expertise": "Intermediate"
  },
  "goal": {
    "primary": "Review employee expenses",
    "secondary": [
      "Search expenses",
      "Filter expenses",
      "Approve expenses",
      "Reject expenses"
    ]
  },
  "tasks": {
    "primary": "Review and approve expenses",
    "frequency": "Daily",
    "bulkActionRequired": true
  },
  "context": {
    "device": "Desktop",
    "dataVolume": "High",
    "timePressure": "Medium"
  },
  "constraints": {
    "accessibility": "WCAG-AA",
    "designSystem": "Default"
  }
}
```

The state should be validated before it enters the decision layer.

---

# 8. UX Decision Questions

The system should avoid asking broad questions such as:

> "What is the best UX?"

Instead, decompose the problem into atomic questions.

### Example

```text
Q1
Is the expected data volume high?

Q2
Is comparison between records important?

Q3
Is filtering required?

Q4
Is sorting required?

Q5
Are bulk actions required?

Q6
Is the primary task performed frequently?

Q7
Is error prevention particularly important?

Q8
How important is information density?

Q9
Which data presentation pattern is most appropriate?
```

The first questions provide evidence for the later policy.

---

# 9. Decision Question Types

Design Companion should support three conceptual question types.

## 9.1 Choice

Choose one option from a defined set.

```json
{
  "id": "dataPresentation",
  "type": "choice",
  "options": [
    "dataTable",
    "cardGrid",
    "list",
    "kanban"
  ]
}
```

Expected result:

```json
{
  "choice": "dataTable",
  "probabilities": {
    "dataTable": 0.91,
    "cardGrid": 0.04,
    "list": 0.04,
    "kanban": 0.01
  },
  "confidence": 0.91
}
```

## 9.2 Score

Evaluate a state against a defined rubric.

Example:

```text
Information density required:
0–100
```

## 9.3 Noul / Truth-like judgment

Evaluate whether a statement is true.

Example:

```text
"Users need to compare multiple records simultaneously."
```

Result:

```json
{
  "noul": 0.93
}
```

---

# 10. Atomic Questions

Decision questions should follow these rules:

1. Ask one specific question.
2. Avoid mixing unrelated dimensions.
3. Use explicit state.
4. Define the output type.
5. Keep answer options bounded where possible.
6. Let application code combine results.
7. Avoid embedding final UX policy inside the model question.

Bad:

> "What dashboard layout should we use considering data volume, user expertise, task frequency, accessibility, and business requirements?"

Good:

```text
Is data volume high?
Is comparison important?
Is filtering required?
Is bulk action required?
How frequently is this task performed?
```

Then combine the results deterministically.

---

# 11. UX Policy Engine

The decision model produces judgments.

The **UX Policy Engine** turns those judgments into application decisions.

This distinction is critical.

```text
Decision Model
    ↓
"What is likely true?"
"What is appropriate?"
"What option has the strongest fit?"
    ↓
UX Policy
    ↓
"What should Design Companion do?"
```

Example:

```ts
if (
  dataVolumeHigh &&
  comparisonRequired &&
  filteringRequired
) {
  pattern = "data-table";
}
```

The model does not own this policy.

The application does.

---

# 12. UX Rules

Rules should be externalized from prompts.

Directory:

```text
knowledge/
  ux-rules/
    selection/
    navigation/
    forms/
    tables/
    search/
    filters/
    dialogs/
    feedback/
    accessibility/
    responsive/
    error-prevention/
```

Example:

```json
{
  "id": "selection.multiple.visible",
  "category": "selection",
  "when": {
    "selection": "multiple",
    "optionsVisibility": "visible"
  },
  "recommend": "checkbox",
  "avoid": ["radio"],
  "reason": "Multiple independent selections are required.",
  "priority": "high"
}
```

---

# 13. Rule Priority

```text
Critical
High
Medium
Low
```

Global priority:

```text
Accessibility
      ↓
Task requirements
      ↓
Business constraints
      ↓
Technical constraints
      ↓
Design system
      ↓
Visual preference
```

The system must never allow a low-priority visual preference to override an accessibility or critical task requirement.

---

# 14. Decision Object

The final application-level decision should be different from the raw model result.

Example:

```json
{
  "id": "decision.dataPresentation",
  "question": "Which data presentation pattern best fits the task?",
  "result": {
    "choice": "dataTable",
    "confidence": 0.94
  },
  "evidence": [
    {
      "questionId": "dataVolume.high",
      "value": true,
      "confidence": 0.97
    },
    {
      "questionId": "comparison.required",
      "value": true,
      "confidence": 0.91
    },
    {
      "questionId": "filter.required",
      "value": true,
      "confidence": 0.96
    }
  ],
  "rulesApplied": [
    "DATA_VOLUME_HIGH",
    "COMPARISON_REQUIRED",
    "FILTER_REQUIRED"
  ],
  "alternatives": [
    {
      "choice": "cardGrid",
      "reasonRejected": "Weak for high-volume comparison."
    }
  ],
  "source": "decision-model"
}
```

---

# 15. Confidence Handling

Confidence must affect system behavior.

Example policy:

```text
confidence >= 0.85
    → proceed automatically

0.65–0.84
    → proceed but expose uncertainty

< 0.65
    → request clarification or designer review
```

These thresholds must be configurable rather than hard-coded into prompts.

Important:

> Confidence is a signal, not proof of correctness.

---

# 16. Human Override

Designers must be able to override decisions.

Example:

```text
System:
DataTable recommended
Confidence: 94%

Reason:
High data volume + comparison + filtering

Designer:
Use CardGrid

Reason:
Records are visually distinct and each record contains
a small amount of information.
```

The system records:

```json
{
  "decisionId": "decision.dataPresentation",
  "systemChoice": "dataTable",
  "designerChoice": "cardGrid",
  "overrideReason": "...",
  "timestamp": "...",
  "actor": "designer"
}
```

Overrides should not silently alter the underlying rule.

---

# 17. Decision Inspector

Every major UX decision should be inspectable.

### Inspector structure

```text
DECISION
Data presentation

RECOMMENDATION
DataTable

CONFIDENCE
94%

WHY
• High data volume
• Comparison required
• Filtering required

QUESTIONS
✓ Is data volume high?
✓ Is comparison important?
✓ Is filtering required?

RULES
• DATA_VOLUME_HIGH
• COMPARISON_REQUIRED
• FILTER_REQUIRED

ALTERNATIVES
CardGrid
Why rejected:
Poor for high-volume comparison.

[Accept] [Override]
```

This becomes one of the product's core differentiators.

---

# 18. Pattern Registry

Patterns represent reusable UX structures.

Initial patterns:

- Dashboard
- Data Table
- Search
- Filtering
- Checkout
- Onboarding
- Authentication
- Settings
- Comparison
- CRUD
- Form
- Wizard
- Detail Page
- Empty State

Example:

```json
{
  "id": "data-table",
  "purpose": "Review and manipulate large structured datasets",
  "supports": [
    "search",
    "filter",
    "sort",
    "pagination",
    "bulk-actions"
  ],
  "requiredStates": [
    "loading",
    "empty",
    "error",
    "populated"
  ],
  "recommendedFor": [
    "high-data-volume",
    "comparison",
    "record-management"
  ]
}
```

---

# 19. Pattern Resolution

Pattern selection should not be a pure LLM decision.

```text
UX State
   ↓
Decision Results
   ↓
UX Rules
   ↓
Pattern Compatibility
   ↓
Candidate Patterns
   ↓
Policy Ranking
   ↓
Recommended Pattern
```

The LLM may explain or explore alternatives but must not bypass hard constraints.

---

# 20. Design System Registry

The design system becomes a first-class constraint.

## Primitives

- Color
- Typography
- Spacing
- Radius
- Elevation
- Grid
- Motion

## Semantic tokens

- Primary
- Secondary
- Success
- Warning
- Error
- Surface
- Text
- Border
- Focus

## Components

- Button
- Input
- Select
- Checkbox
- Radio
- Tabs
- Table
- Card
- Dialog
- Drawer
- Alert
- Badge
- Pagination

Example:

```json
{
  "component": "Button",
  "supports": [
    "primary-action",
    "secondary-action",
    "destructive-action"
  ],
  "states": [
    "default",
    "hover",
    "focus",
    "disabled",
    "loading"
  ],
  "variants": [
    "primary",
    "secondary",
    "destructive",
    "ghost"
  ]
}
```

---

# 21. Design-System Scoping

The Design Companion architecture should explicitly distinguish:

```text
Primitive
   ↓
Semantic token
   ↓
Component token
   ↓
Component
   ↓
Pattern
   ↓
Page / Experience
```

All generated interfaces should reference the registry.

The generator should not invent arbitrary:

- colors
- spacing
- typography
- radii
- component variants
- interaction states

when a design system is available.

---

# 21a. Capability Vocabulary

Rules, patterns, policy and design systems share a single **closed, versioned capability vocabulary** (`knowledge/capabilities.json`). Knowledge never references component ids directly — it references capabilities — so the same rule library works against any imported design system.

Each capability defines what a component must do to claim it:

```json
{
  "id": "row-selection",
  "category": "data",
  "description": "Select one or more rows in a tabular view",
  "acceptanceCriteria": [
    "keyboard toggle per row",
    "select-all with indeterminate state"
  ],
  "requiredStates": ["selected", "disabled"],
  "accessibility": [
    "checkbox semantics",
    "selection changes announced to assistive technology"
  ]
}
```

Initial vocabulary: ~40 capabilities across six categories — **actions, data, input, navigation, feedback, overlay**.

A component **claims** a capability:

```json
{
  "component": "data-grid",
  "capability": "row-selection",
  "level": "full",
  "source": "declared",
  "confidence": 1.0,
  "missing": []
}
```

- `level`: `full` | `partial`
- `source`: `declared` | `inferred` | `decision-model` | `designer`
- `missing`: acceptance criteria, states or accessibility obligations not met

---

# 21b. Capability Requirements

The UX Policy Engine outputs **capability requirements** alongside decisions. They are the bridge between "what the UX needs" and "what the design system can build".

Sources of requirements:

- **Decision options** map to capabilities (e.g. `dataPresentation = data-table` → `tabular-display`, `sorting`, `pagination`).
- **Rules** may declare `requiresCapabilities`.
- **Patterns** declare `requiredCapabilities` and `optionalCapabilities` (not component lists).

```json
{
  "capability": "destructive-confirmation",
  "priority": "critical",
  "requiredBy": {
    "decision": "actionConfirmation",
    "rule": "error-prevention.destructive.confirm"
  },
  "states": ["focus", "loading"]
}
```

A requirement inherits the priority of the rule or decision that produced it.

---

# 21c. Capability Resolution and Gap Detection

Every requirement is resolved against the active design system:

| Resolution | Meaning |
|---|---|
| `satisfied` | A confirmed component fully claims the capability |
| `composite` | Achievable by combining existing components via a known composition recipe (e.g. confirmation = `dialog` + `button[destructive]`) |
| `partial` | A claim exists but misses required states, variants or accessibility criteria |
| `unconfirmed` | Only an inferred claim with confidence below the review threshold (default 0.65) |
| `missing` | No component provides it |

Composition recipes are knowledge, stored and versioned in `knowledge/compositions/`.

Anything other than `satisfied` or `composite` becomes a **Design System Gap**:

```json
{
  "id": "gap.row-selection",
  "capability": "row-selection",
  "kind": "partial",
  "severity": "high",
  "affectedDecisions": ["bulkActions"],
  "missing": ["indeterminate state"],
  "suggestedResolutions": ["extend-component", "override-decision", "accept-risk"],
  "status": "open"
}
```

- `kind`: `missing` | `partial` | `missing-state` | `missing-variant` | `accessibility` | `unconfirmed` | `token`
- `severity`: inherited from the requirement's priority — accessibility gaps are therefore critical
- `suggestedResolutions`: `use-composite` | `extend-component` | `add-component` | `override-decision` | `accept-risk`
- `status`: `open` | `accepted` | `resolved`

## Gap policy

Behavior is configurable policy, never prompt text:

| Severity | Behavior |
|---|---|
| Critical | Generation is **blocked** for the affected region until the designer resolves the gap or explicitly accepts the risk with a recorded reason |
| High | Generation proceeds; the region is marked **"net-new component required"** and the evaluator penalizes design-system compliance |
| Medium / Low | Warning only |

**The generator never fills a gap by inventing a component.** The generation schema permits a typed placeholder (`{ "gap": "gap.row-selection" }`) instead.

## Design-system-aware ranking

Design system is already a tier in the §13 priority order. A missing capability therefore penalizes an option **only at the design-system tier**: a strong task requirement still wins (and the gap is reported), while a close call can tip toward what the design system can actually implement. UX remains first; implementation reality is not ignored.

---

# 21d. Design System Normalizer

Ingest adapters (JSON, tokens, Storybook, repository, Figma) produce a raw model. The normalizer converts it into the canonical `DesignSystem`:

1. **Names** — alias table to canonical ids (`Btn`, `PrimaryButton` → `button`; `DataGrid` → `data-table`).
2. **States** — `hovered` → `hover`, `isDisabled` → `disabled`, `busy` → `loading`.
3. **Variants** — `danger`, `critical`, `destructive` → `destructive`.
4. **Tokens** — resolve references (`{color.blue.500}`), classify each token's tier (primitive / semantic / component, §21), and flag components that consume primitives directly.
5. **Prop hints** — props such as `selectable`, `onSort`, `pageSize` become capability hints.

Output: the normalized design system plus a **normalization report** listing every mapping with provenance — `mapped`, `ambiguous`, `unknown`. Nothing is dropped silently.

---

# 21e. Capability Mapping

Mapping a component to capabilities runs cheapest-first. The LLM does not decide it.

1. **Declared** — capabilities stated in the import are trusted.
2. **Inferred** — deterministic alias and prop-hint matching (confidence 0.6–0.8).
3. **Decision model** — Noul questions for ambiguous pairs only, bounded (default ≤ 40 per import):
   > "Given this component's props and documentation, does it meet the acceptance criteria for row-selection?"
4. **Designer** — confirms or rejects claims in Design System Review. Confirmed claims are saved into a new version of the imported design system.

---

# 21f. Design System Review

A dedicated surface (`/design-system`):

```text
Import JSON
    ↓
Normalization report
    ↓
Capability matrix (components × capabilities, provenance badges)
    ↓
Gap list with resolution actions
    ↓
Save as new design-system version
```

The bundled default design system (`knowledge/design-systems/default.json`) is imported through the **same pipeline** as a user's system, so the import path is exercised from day one.

## Worked example

The expense dashboard (§41) requires `tabular-display`, `sorting`, `row-selection`, `bulk-action-bar`, `filter-bar`, `pagination` and `destructive-confirmation` (critical — rejecting an expense is destructive).

An imported design system has a `Table` without row selection and no `Dialog`:

- `row-selection` → **partial gap, high** → layout generates; the bulk-actions region is marked net-new.
- `destructive-confirmation` → **missing gap, critical** → generation blocked.
- The designer overrides `actionConfirmation` from `confirm-dialog` to `undo-toast`, which resolves via the existing Toast and a composite recipe. The override and reason are recorded.
- The evaluator scores design-system compliance against capabilities, not component names.

This scenario is the second golden end-to-end test, after the default-design-system run.

---

# 22. LLM Generation Layer

The LLM becomes a **constrained generator**.

Inputs:

```text
UX State
+
UX Decisions
+
Pattern
+
Design System
+
Content requirements
```

Outputs:

```text
Layout alternatives
Copy
Content hierarchy
Interaction descriptions
Component composition
Design rationale
```

The LLM should explore the valid solution space rather than define that space itself.

---

# 23. Layout Brainstorm V2

### V1

```text
Prompt
 ↓
LLM
 ↓
3 layouts
```

### V2

```text
Prompt
 ↓
UX State
 ↓
Decision Questions
 ↓
Decision Model
 ↓
UX Policy
 ↓
Valid Pattern Space
 ↓
Design System
 ↓
LLM
 ↓
3 layout directions
 ↓
UX Evaluation
```

Example:

### Direction A — Task First

Prioritizes the primary review task.

### Direction B — Exception First

Prioritizes problematic or unusual expenses.

### Direction C — Overview First

Prioritizes high-level summary before detailed review.

Each direction should expose:

- UX rationale
- supporting decisions
- applicable rules
- components
- advantages
- trade-offs
- confidence
- evaluation score

---

# 24. UI Copy V2

Copy generation should become context-aware.

Inputs:

```text
Component
+
Action
+
Risk
+
User context
+
Tone
+
UX state
```

Example:

A destructive "Reject Expense" action should produce copy based on:

- action severity
- reversibility
- user role
- consequence
- confirmation requirement

The LLM generates language; policy determines interaction requirements.

---

# 25. Feedback Summary V2

Pipeline:

```text
Raw Feedback
    ↓
LLM Clustering
    ↓
UX Issue Model
    ↓
Atomic Decision Questions
    ↓
Decision Model
    ↓
UX Policy
    ↓
Recommended UX Changes
```

Example issue:

> "Users can't find the export function."

Possible judgments:

```text
Is export discoverability low?
Is export a frequent task?
Is export a primary task?
Is the current action location consistent?
```

Then the policy layer determines possible UX changes.

---

# 26. UX Analyze

New V2 feature.

Input:

> "Users are struggling to approve expenses quickly."

Output:

```text
UX Intent
↓
Key UX Questions
↓
Decision Results
↓
UX Decisions
↓
Recommended Pattern
↓
Components
↓
Risks
↓
Alternatives
```

The user should be able to inspect every step.

---

# 27. UX Evaluate

The evaluator should assess:

- Task effectiveness
- Task clarity
- Information architecture
- Interaction quality
- Cognitive load
- Accessibility
- Error prevention
- Feedback
- Consistency
- Design-system compliance — measured against capability resolution and open gaps (§21c), not merely "approved component names"
- Required states
- Responsive behavior

Example:

```json
{
  "overallScore": 82,
  "categories": {
    "taskClarity": 90,
    "informationArchitecture": 85,
    "interaction": 78,
    "accessibility": 74,
    "consistency": 91
  },
  "issues": [
    {
      "severity": "high",
      "issue": "Reject action lacks confirmation",
      "recommendation": "Add confirmation dialog"
    }
  ]
}
```

---

# 28. Evaluation Architecture

Evaluation should also be decomposed.

Avoid:

> "Is this UX good?"

Instead:

```text
Is the primary task clear?
Is the primary action discoverable?
Is the information hierarchy appropriate?
Are destructive actions protected?
Are required states represented?
Does the UI comply with the design system?
Are keyboard interactions supported?
Are focus states represented?
```

Then combine results in code.

---

# 29. Decision Trace

Every generated solution should maintain a trace:

```text
Original Brief
      ↓
UX State
      ↓
Decision Questions
      ↓
Raw Decision Results
      ↓
UX Rules
      ↓
Policy Decisions
      ↓
Capability Requirements
      ↓
Pattern
      ↓
Capability Resolution
      ↓
Design System Gaps
      ↓
Gap Decisions
      ↓
Components
      ↓
Generation
      ↓
Evaluation
      ↓
Designer Overrides
```

This enables:

- explainability
- debugging
- auditing
- research
- benchmarking
- reproducibility
- versioning

---

# 30. Versioning

Version the following independently:

```text
Decision Model
Question Set
UX Rules
UX Policy (thresholds, gap policy)
Patterns
Capability Vocabulary
Composition Recipes
Design System (each imported system carries its own version)
Evaluator
Generation prompts
```

Every generated solution should record the versions used.

Example:

```json
{
  "decisionModelVersion": "jev-1.13.0",
  "questionSetVersion": "1.0.0",
  "uxRulesVersion": "1.3.0",
  "policyVersion": "1.0.0",
  "patternRegistryVersion": "1.1.0",
  "capabilityVocabularyVersion": "1.0.0",
  "designSystem": { "id": "acme-ds", "version": "2.4.0" },
  "evaluatorVersion": "1.0.0",
  "promptsVersion": "1.0.0"
}
```

---

# 31. Architecture

```text
design-companion/

src/

  app/
    analyze/
    layout-mode/
    copy-mode/
    feedback-mode/
    evaluate/
    decisions/
    design-system/
    settings/

  lib/

    ai/
      providers/
      generate.ts
      prompts/

    decision-model/
      provider.ts
      questions/
      results/
      adapters/
        jev.ts

    ux/
      intent/
      policy/
      rules/
      patterns/
      heuristics/
      evaluator/

    design-system/
      ingest/
        json/
        tokens/
        storybook/
        repository/
        figma/
      normalize/
      model/
      capabilities/
      tokens/
      components/
      states/
      registry/
      gaps/

    schemas/
      UXState.ts
      DecisionQuestion.ts
      DecisionResult.ts
      UXDecision.ts
      UXRule.ts
      UXPattern.ts
      Component.ts
      UXEvaluation.ts
      Generation.ts
      DesignSystem.ts
      ComponentCapability.ts
      CapabilityRequirement.ts
      DesignSystemGap.ts

knowledge/

  ux-rules/
    selection/
    navigation/
    forms/
    tables/
    search/
    accessibility/

  patterns/
    dashboard/
    data-table/
    checkout/
    onboarding/

  heuristics/

  questions/

  capabilities.json

  compositions/

  design-systems/
    default.json

docs/

  PRD.md
  UX-MODEL.md
  DECISION-MODEL.md
  UX-POLICY.md
  DESIGN-SYSTEM.md
  ARCHITECTURE.md

tests/

  state/
  decisions/
  policy/
  rules/
  patterns/
  evaluation/
  integration/
```

---

# 32. Core Contracts

The first implementation should establish these contracts:

```text
UXState
DecisionQuestion
DecisionResult
UXDecision
UXRule
UXPattern
Component
UXEvaluation
Generation
DesignSystem
ComponentCapability      (vocabulary entry + component claim)
CapabilityRequirement
DesignSystemGap
```

Example:

```ts
interface DecisionQuestion {
  id: string;
  type: "choice" | "score" | "noul";
  question: string;
  options?: string[];
  rubric?: Record<string, string>;
}

interface DecisionResult {
  questionId: string;
  type: "choice" | "score" | "noul";
  value: unknown;
  probabilities?: Record<string, number>;
  confidence?: number;
}

interface UXDecision {
  id: string;
  result: DecisionResult;
  evidence: DecisionResult[];
  rulesApplied: string[];
  alternatives: Alternative[];
  source: "decision-model" | "rule" | "designer";
}
```

---

# 33. Decision Provider Abstraction

Do not hard-code Jev throughout the application.

```ts
interface DecisionProvider {
  evaluate(
    state: UXState,
    questions: DecisionQuestion[]
  ): Promise<DecisionResult[]>;
}
```

Provider:

```text
DecisionProvider
      │
      ├── JevProvider
      ├── MockDecisionProvider
      └── FutureProvider
```

This allows:

- local development
- deterministic tests
- provider comparison
- future model replacement
- benchmarking

---

# 34. API Architecture

## Analyze

```http
POST /api/ux/analyze
```

Input:

```json
{
  "prompt": "Design an expense review dashboard for managers."
}
```

Output:

```json
{
  "state": {},
  "questions": [],
  "results": [],
  "decisions": [],
  "patterns": [],
  "components": []
}
```

## Generate

```http
POST /api/ux/generate
```

Input:

```json
{
  "state": {},
  "decisions": [],
  "pattern": {},
  "designSystem": {}
}
```

Output:

```json
{
  "variants": []
}
```

## Evaluate

```http
POST /api/ux/evaluate
```

Input:

```json
{
  "ux": {},
  "state": {},
  "rules": []
}
```

Output:

```json
{
  "score": 82,
  "issues": []
}
```

## Design System

The API is stateless; the active design system is sent in the request body.

```http
POST /api/design-system/import
```

Ingest → normalize → infer capabilities. Returns the normalized design system, the normalization report and the claims that still need mapping.

```http
POST /api/design-system/map
```

Runs decision-model questions for ambiguous component/capability pairs only (§21e).

```http
POST /api/design-system/gaps
```

Input: capability requirements + design system. Output: a resolution per requirement and the resulting gaps (§21c).

```http
GET /api/design-system/capabilities
```

Returns the capability vocabulary and its version.

---

# 35. Validation

All intermediate representations must be validated.

Use schemas for:

```text
UXState
DecisionQuestion
DecisionResult
UXDecision
UXRule
UXPattern
Component
UXEvaluation
Generation
DesignSystem
ComponentCapability
CapabilityRequirement
DesignSystemGap
```

Pipeline:

```text
LLM / Decision Model
        ↓
Schema validation
        ↓
Rule validation
        ↓
Policy validation
        ↓
Pattern validation
        ↓
Capability resolution / gap policy
        ↓
Component validation
        ↓
Generation
```

The system should fail safely when a required contract is invalid.

---

# 36. Knowledge Base

Initial V2 knowledge target:

- 30–50 high-quality UX rules
- 10–15 UX patterns
- 10–15 core components (in the bundled default design system)
- ~40 capabilities (§21a)
- composition recipes for common composites (§21c)
- accessibility rules
- common interaction heuristics
- common responsive rules
- error-prevention patterns

Initial rule categories:

- Forms
- Selection
- Tables
- Navigation
- Feedback
- Search
- Filtering
- Accessibility
- Responsive
- Error prevention

---

# 37. Design System Import

V2 should eventually support:

### Phase 1
Structured JSON.

### Phase 2
CSS variables / design tokens.

### Phase 3
Storybook/component metadata.

### Phase 4
Code repository (component source, prop types, exported variants).

### Phase 5
Figma design-system metadata.

Every phase feeds the same normalizer (§21d) and capability mapping (§21e).

Imported systems should populate:

```text
Primitives
Semantic tokens
Components
Variants
States
Patterns
Usage constraints
```

---

# 38. Human-in-the-Loop Learning

The system should capture:

```text
Recommended
Accepted
Rejected
Modified
Overridden
```

But designer behavior should be treated as a learning signal, not silently converted into a new rule.

Future learning architecture:

```text
Designer Decisions
        ↓
Decision Dataset
        ↓
Analysis
        ↓
Candidate Rule / Policy
        ↓
Human Review
        ↓
Versioned Rule
```

---

# 39. Auditability

Every important action should be traceable.

Example:

```text
Prompt
 ↓
State version
 ↓
Question set version
 ↓
Decision model version
 ↓
Raw results
 ↓
Policy version
 ↓
Pattern version
 ↓
Design system version
 ↓
Generated variant
 ↓
Evaluation
 ↓
Designer override
```

---

# 40. Benchmark / Research Experiment

The project should explicitly test whether the architecture improves generated UX.

Compare:

## A — LLM only

```text
Prompt
 ↓
LLM
 ↓
UI
```

## B — LLM + Design System

```text
Prompt
 ↓
LLM
 ↓
Design System
 ↓
UI
```

## C — Decision-guided

```text
Prompt
 ↓
LLM
 ↓
UX State
 ↓
Decision Model
 ↓
UX Policy
 ↓
Design System
 ↓
LLM
 ↓
UI
```

Evaluate:

- Task clarity
- Information architecture
- Usability
- Consistency
- Accessibility
- Design-system compliance
- Error prevention
- Decision explainability
- Repeatability across generations

### Core research question

> **Does separating UX judgment from generative interface generation improve the consistency, explainability, usability, accessibility, and design-system compliance of AI-generated interfaces?**

---

# 41. First End-to-End Test

Input:

> **"Design an expense-review dashboard for managers."**

Expected flow:

```text
Prompt
 ↓
UX State
 ↓
10–20 atomic UX questions
 ↓
Decision Model
 ↓
Structured results
 ↓
UX Policy
 ↓
5–10 UX decisions
 ↓
Pattern selection
 ↓
Component selection
 ↓
Decision Inspector
 ↓
LLM layout alternatives
 ↓
UX Evaluation
 ↓
Designer review
```

Expected important decisions may include:

```text
Data presentation → DataTable
Filtering → Persistent filter controls
Search → Visible search
Bulk actions → Supported
Pagination → Required for high volume
Approval action → Primary action
Reject action → Destructive + confirmation
Information density → High
```

These are examples of potential outputs, not hard-coded answers.

---

# 42. MVP Scope

## Must have

- UX State
- DecisionQuestion schema
- DecisionResult schema
- DecisionProvider abstraction
- Jev adapter
- UX Policy Engine
- UX Rule Library
- Pattern Registry
- Component Registry
- Design System Intelligence Layer
- JSON Design System Import
- Design System Normalizer
- Capability Model
- Design System Gap Detection and gap policy
- Decision Inspector
- Human override (the Inspector's core action, §16–17)
- Decision confidence handling (§15)
- Versioning (Principle 7)
- UX Analyze
- Decision-guided Layout Brainstorm
- UX Evaluation
- Basic audit trail

## Should have

- Design System Review surface (§21f)
- Design System Gap resolution workflows
- Design-token / CSS-variable import (§37 Phase 2)
- Feedback Summary migration
- UI Copy migration

## Later

- Storybook, repository and Figma import (§37 Phases 3–5)
- Designer learning signals
- advanced benchmarking
- team collaboration
- custom decision models
- provider comparison

---

# 43. Development Plan

## Sprint 1 — Contracts

Implement:

```text
UXState
DecisionQuestion
DecisionResult
UXDecision
UXRule
UXPattern
Component
UXEvaluation
Generation
DesignSystem
ComponentCapability
CapabilityRequirement
DesignSystemGap
```

No visual generation work yet.

## Sprint 2 — Decision Infrastructure

Implement:

```text
DecisionProvider
Mock provider
Jev provider
Decision question registry
Confidence handling
```

## Sprint 3 — Design System Intelligence

Implement:

```text
Design System JSON schema
Capability vocabulary + composition recipes
Normalizer
Capability mapping (declared → inferred → decision model → designer)
Component Registry
Capability resolution + gap detection + gap policy
Registry query APIs
```

The bundled default design system is authored here as JSON and imported through this pipeline; Sprint 5 extends its content rather than creating a separate registry.

## Sprint 4 — UX Policy

Implement:

```text
Rule engine
Policy engine
Pattern resolver
Component resolver
```

## Sprint 5 — Knowledge Base

Create:

- first 30–50 rules (referencing capabilities, not component ids)
- first 10–15 patterns (with required/optional capabilities)
- first 10–15 components in the default design system, with capability claims

## Sprint 6 — UX Analyze

Build:

```text
Prompt
 ↓
State
 ↓
Questions
 ↓
Results
 ↓
Decisions
 ↓
Pattern
```

## Sprint 7 — Layout Brainstorm V2

Connect:

```text
Decision system
 ↓
LLM generation
 ↓
Multiple UX directions
```

## Sprint 8 — Evaluation

Build atomic UX evaluation questions and aggregate scores.

## Sprint 9 — Existing Feature Migration

Migrate:

- UI Copy
- Feedback Summary

## Sprint 10 — Benchmark

Run the three-system comparison:

```text
LLM
LLM + Design System
Decision-guided
```

---

# 44. Success Metrics

## Product metrics

- Percentage of decisions with traceable rationale
- Percentage of generated UI using valid components
- Percentage of decisions requiring manual correction
- Designer override rate
- Time to first acceptable UX direction
- UX evaluation score

## System metrics

- Decision latency
- Generation latency
- Invalid structured-output rate
- Rule violation rate
- Design-system violation rate
- Evaluation consistency

## Research metrics

- Inter-rater agreement with expert designers
- Repeatability across generations
- Accessibility improvement
- Task clarity improvement
- Component consistency
- Explanation usefulness

---

# 45. Non-Goals

V2 is not intended to:

- replace UX designers
- automatically make every design decision
- generate arbitrary design systems
- hide uncertainty
- treat model confidence as objective truth
- encode every UX principle into a single prompt
- make the decision provider inseparable from the application
- optimize solely for visual similarity

---

# 46. Architectural Principles

### Principle 1 — Separate judgment from generation

```text
Decision ≠ Generation
```

### Principle 2 — Prefer atomic questions

```text
Small judgments
      ↓
Code composition
      ↓
Complex decision
```

### Principle 3 — Keep policy deterministic

The model may provide evidence.

The application decides how that evidence affects product behavior.

### Principle 4 — Make decisions inspectable

Every major decision must answer:

```text
What?
Why?
Based on what?
Which rules?
What alternatives?
How confident?
Can I override it?
```

### Principle 5 — Design system is a constraint

Generation happens inside the available component and token space.

### Principle 6 — Designer remains authoritative

The system recommends.

The designer decides.

### Principle 7 — Version everything important

Rules, patterns, decision models, design systems, evaluators, and prompts must be versioned.

---

# 47. Final Architecture

```text
                         DESIGN COMPANION V2

                              USER
                               │
                               ▼
                     ┌──────────────────┐
                     │   INTERPRETATION │
                     │                  │
                     │       LLM        │
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │    UX STATE      │
                     │                  │
                     │ goals            │
                     │ users            │
                     │ tasks            │
                     │ context          │
                     │ constraints      │
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │ DECISION MODEL   │
                     │                  │
                     │ Choice           │
                     │ Score            │
                     │ Noul             │
                     │ Confidence       │
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │   UX POLICY      │
                     │                  │
                     │ Rules            │
                     │ Constraints      │
                     │ Business logic   │
                     │ Accessibility    │
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │ PATTERN RESOLVER │
                     │                  │
                     │ Valid patterns   │
                     │ Trade-offs       │
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │ DESIGN SYSTEM    │
                     │ INTELLIGENCE     │
                     │                  │
                     │ Tokens           │
                     │ Components       │
                     │ Capabilities     │
                     │ Constraints      │
                     │ Gaps             │
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │ GENERATION       │
                     │                  │
                     │       LLM        │
                     │                  │
                     │ layouts          │
                     │ copy             │
                     │ variants         │
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │ UX EVALUATION    │
                     │                  │
                     │ atomic checks    │
                     │ scores           │
                     │ issues           │
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │ DECISION         │
                     │ INSPECTOR        │
                     │                  │
                     │ Why?             │
                     │ Confidence?      │
                     │ Alternatives?    │
                     │ Override?        │
                     └────────┬─────────┘
                              │
                              ▼
                           DESIGNER
```

---

# 48. The Fundamental Product Model

Design Companion V2 should be understood as **four intelligence systems working together**, feeding constrained generation and evaluation:

```text
┌────────────────────────────────────────────────┐
│                 GENERATIVE AI                  │
│                                                │
│ Interpret • Synthesize • Explain • Generate    │
└───────────────────────┬────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────┐
│              DECISION INTELLIGENCE              │
│                                                │
│ Judge • Score • Classify • Rank • Estimate     │
└───────────────────────┬────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────┐
│                 UX POLICY                      │
│                                                │
│ Constrain • Enforce • Validate • Route         │
└───────────────────────┬────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────┐
│          DESIGN SYSTEM INTELLIGENCE            │
│                                                │
│ Ingest • Normalize • Resolve • Validate        │
└───────────────────────┬────────────────────────┘
                        │  valid components + gaps
                        ▼
┌────────────────────────────────────────────────┐
│        GENERATIVE AI (constrained)             │
│                                                │
│ Layouts • Copy • Variants                      │
└───────────────────────┬────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────┐
│               UX EVALUATION                    │
│                                                │
│ Atomic checks • Scores • Issues                │
└───────────────────────┬────────────────────────┘
                        │
                        ▼
                    DESIGNER
```

The strategic insight is:

> **The future of AI-assisted UX is not simply better UI generation. It is the separation of interpretation, judgment, policy, generation, and evaluation into composable systems.**

Design Companion V2 should be built around that separation.


---

# 49. Strategic Product Model

Design Companion V2 is therefore not simply a UX reasoning engine and not simply a UI generator.

It is a system that connects four forms of intelligence:

```text
1. GENERATIVE INTELLIGENCE
   Understand, synthesize, explain, generate.

2. DECISION INTELLIGENCE
   Judge, score, classify, rank, estimate.

3. UX POLICY INTELLIGENCE
   Constrain, enforce, validate, route.

4. DESIGN SYSTEM INTELLIGENCE
   Know what the user's design system can actually implement.
```

The resulting loop is:

```text
User Brief
   ↓
LLM
   ↓
UX State
   ↓
Decision Questions
   ↓
Decision Model
   ↓
UX Policy
   ↓
Capability Requirements
   ↓
User's Design System
   ↓
Valid Components / Patterns
   ↓
LLM Generation
   ↓
UX Evaluation
   ↓
Designer
```

The strategic differentiator is therefore:

> **Design Companion does not generate a generic UI and try to make it look like a design system. It reasons about the UX first, understands the actual capabilities of the user's design system, and generates only within the valid design space.**

This should be a foundational principle of V2.
