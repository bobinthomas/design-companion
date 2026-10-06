# Design Companion V2 — Product Requirements Document

**Product:** Design Companion  
**Version:** V2.0  
**Status:** Product Requirements Document  
**Primary audience:** Product Designers, UX Designers, Design Systems teams, UX Researchers, Product Managers  
**Platform:** Web application  
**Repository:** https://github.com/bobinthomas/design-companion

---

## 1. Executive Summary

Design Companion V2 evolves the existing AI design copilot into a **decision-guided UX intelligence system**.

The current product uses LLMs to assist designers with:

- Layout brainstorming
- UI copy generation
- UX feedback summarization

V2 introduces a new architectural layer between the user's intent and AI-generated output:

> **The UX Decision Model.**

Instead of asking an LLM to directly invent an interface, Design Companion first interprets the user's goal, models the task and context, applies explicit UX rules and constraints, selects appropriate patterns and components, and only then uses generative AI for exploration, content and implementation.

The resulting architecture is:

```text
User Intent
     ↓
LLM Interpretation
     ↓
UX Intent Model
     ↓
UX Decision Engine
     ↓
UX Pattern
     ↓
Component Registry
     ↓
LLM Generation
     ↓
UX Evaluation
     ↓
Refinement
```

This creates a system that is:

- More predictable
- More explainable
- More consistent
- More design-system compliant
- More controllable
- Easier to evaluate
- Less dependent on unrestricted LLM creativity

The central product thesis is:

> **LLMs should interpret, synthesize and explore. UX decision models should determine, constrain and validate.**

---

# 2. Product Vision

## Vision

Build an AI design companion that doesn't merely generate interfaces but **understands why a particular UX solution should exist**.

Design Companion should help designers answer four questions:

1. What is the user trying to accomplish?
2. What UX pattern best supports that task?
3. Why is that pattern appropriate?
4. How can generative AI explore solutions within those constraints?

---

# 3. Problem Statement

Current AI UI-generation systems often follow:

```text
Prompt
 ↓
LLM
 ↓
UI
```

This creates several problems.

### 3.1 Inconsistent UX decisions

Two identical prompts can produce different interaction models.

Example:

> "Create a product selection interface."

One generation may use:

- Cards
- Dropdown
- Table
- Radio buttons

There may be no explicit reasoning behind the choice.

### 3.2 LLMs are poor at enforcing design constraints

LLMs can understand design systems but may still:

- Invent components
- Invent tokens
- Ignore states
- Use inconsistent spacing
- Create inaccessible interactions
- Break established interaction patterns

### 3.3 Generation is not the same as UX reasoning

An attractive UI does not necessarily mean:

- The task is easy
- Information hierarchy is correct
- Interaction is appropriate
- Errors are prevented
- Accessibility is satisfied
- The design scales

### 3.4 Designers need explanations, not just output

Designers need to understand:

> "Why did the system choose a table?"

rather than simply receiving:

> "Here's a table."

---

# 4. Product Opportunity

Design Companion can occupy the space between traditional UX tools and generative AI tools.

### Traditional UX

```text
Human reasoning
+
Manual design
```

### Generative AI

```text
Prompt
+
LLM
=
Generated UI
```

### Design Companion V2

```text
Human intent
+
UX knowledge
+
Decision models
+
Design system
+
LLM
=
Decision-guided UX
```

---

# 5. Product Principles

## Principle 1 — Reason before generating

The system must understand the problem before generating the interface.

## Principle 2 — Separate decisions from generation

The LLM should not be responsible for every UX decision.

## Principle 3 — Use explicit UX knowledge

Important UX decisions should be represented as:

- Rules
- Constraints
- Patterns
- Heuristics
- Decision models

## Principle 4 — Generate within a design space

AI should explore valid solutions rather than invent arbitrary ones.

## Principle 5 — Explain every significant UX decision

Designers should be able to inspect:

> Decision → Evidence → Rule → Recommendation.

## Principle 6 — Preserve designer control

AI recommendations should be editable, inspectable and overridable.

## Principle 7 — Design-system compliance is structural

The system should use the design system as a component vocabulary rather than simply describing it to an LLM.

---

# 6. Target Users

## Primary

### Product Designers

Need help with:

- Exploring layouts
- Making UX decisions
- Validating designs
- Understanding trade-offs

### UX Designers

Need help with:

- Applying UX principles
- Selecting patterns
- Evaluating workflows
- Converting research into design decisions

### Design Systems Designers

Need help with:

- Ensuring generated experiences use approved components
- Defining component capabilities
- Encoding design rules

## Secondary

### Product Managers

Need help with:

- Translating requirements into UX
- Understanding UX trade-offs
- Reviewing design decisions

### UX Researchers

Need help with:

- Turning research feedback into actionable design changes
- Connecting findings to UX decisions

---

# 7. V2 Product Architecture

```text
                         DESIGNER
                            │
                            ▼
                    ┌──────────────┐
                    │     LLM      │
                    │              │
                    │ Interpret    │
                    │ Synthesize   │
                    │ Explore      │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  UX INTENT   │
                    │    MODEL     │
                    └──────┬───────┘
                           │
                           ▼
                 ┌──────────────────┐
                 │ UX DECISION      │
                 │ ENGINE           │
                 │                  │
                 │ Rules            │
                 │ Heuristics       │
                 │ Constraints      │
                 │ Context          │
                 └────────┬─────────┘
                          │
                          ▼
                 ┌──────────────────┐
                 │ PATTERN REGISTRY │
                 └────────┬─────────┘
                          │
                          ▼
                 ┌──────────────────┐
                 │ COMPONENT        │
                 │ REGISTRY         │
                 └────────┬─────────┘
                          │
                          ▼
                    ┌──────────────┐
                    │     LLM      │
                    │ Generation   │
                    └──────┬───────┘
                           │
                           ▼
                    GENERATED UX
                           │
                           ▼
                    ┌──────────────┐
                    │ UX EVALUATOR │
                    └──────┬───────┘
                           │
                           ▼
                       REFINEMENT
```

---

# 8. Core V2 Modules

V2 consists of seven major modules:

1. UX Intent
2. UX Decision Engine
3. UX Rule Library
4. Pattern Registry
5. Design System Registry
6. Generative UX Layer
7. UX Evaluation Engine

Existing features become consumers of these shared services.

---

# 9. Module 1 — UX Intent Model

## Objective

Convert natural-language requirements into a structured representation of the UX problem.

The LLM is responsible for interpretation.

It must not immediately generate UI.

## UX Intent Schema

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
  "context": {
    "frequency": "Daily",
    "device": "Desktop",
    "dataVolume": "High"
  },
  "constraints": {
    "accessibility": "WCAG-AA",
    "designSystem": "Default"
  }
}
```

## Required Intent Attributes

### User

- Role
- Expertise
- Primary user type

### Goal

- Primary goal
- Secondary goals
- Success criteria

### Tasks

- Primary task
- Supporting tasks
- Task frequency

### Context

- Device
- Environment
- Frequency
- Data volume
- Time pressure

### Constraints

- Accessibility
- Business rules
- Technical constraints
- Design system
- Brand

---

# 10. Module 2 — UX Decision Engine

This is the primary differentiator of V2.

## Objective

Determine UX solutions using explicit decision logic rather than unrestricted generation.

## Decision Types

### Layout decisions

- Single page
- Multi-step
- Split view
- Dashboard
- Detail view

### Interaction decisions

- Checkbox
- Radio
- Select
- Search
- Filter
- Tabs
- Accordion

### Navigation decisions

- Sidebar
- Tabs
- Breadcrumb
- Back navigation
- Stepper

### Data decisions

- Table
- Cards
- List
- Grid
- Timeline

### Feedback decisions

- Toast
- Inline message
- Alert
- Dialog
- Confirmation

### State decisions

Every major component should consider:

- Default
- Loading
- Empty
- Error
- Disabled
- Success
- Partial
- Permission restricted

---

# 11. Decision Object

Each decision should be represented as structured data.

Example:

```json
{
  "decision": "dataPresentation",
  "choice": "DataTable",
  "confidence": 0.94,
  "reasons": [
    "High data volume",
    "Users need comparison",
    "Sorting is required",
    "Filtering is required"
  ],
  "rulesApplied": [
    "DATA_VOLUME_HIGH",
    "COMPARISON_REQUIRED",
    "FILTER_REQUIRED"
  ],
  "alternatives": [
    {
      "choice": "CardGrid",
      "reasonRejected": "Poor for high-volume comparison"
    }
  ]
}
```

---

# 12. Decision Transparency

Every significant decision must support:

### What?

> Use a Data Table.

### Why?

> Users need to compare many expense records and perform sorting and filtering.

### Rules applied

```text
DATA_VOLUME_HIGH
COMPARISON_REQUIRED
FILTER_REQUIRED
```

### Alternative

> Card layout was rejected because it reduces comparison efficiency at high data volume.

---

# 13. Module 3 — UX Rule Library

UX rules must be externalized rather than buried inside prompts.

Directory:

```text
knowledge/ux-rules/
```

Initial rule categories:

```text
selection
navigation
forms
tables
search
filtering
dialogs
feedback
content
responsive
accessibility
error-prevention
```

## Example Rule

```json
{
  "id": "selection.multiple.visible",
  "category": "selection",
  "when": {
    "selection": "multiple",
    "optionsVisibility": "visible"
  },
  "recommend": "checkbox",
  "avoid": [
    "radio"
  ],
  "reason": "Multiple independent selections are required."
}
```

---

# 14. Rule Priority

Rules must support priority.

```text
Critical
High
Medium
Low
```

Example:

Accessibility rules should override visual preferences.

```text
Accessibility
    ↓
Task requirements
    ↓
Business constraints
    ↓
Design system
    ↓
Visual preference
```

---

# 15. Module 4 — UX Pattern Registry

The Pattern Registry defines known UX solutions.

Initial patterns:

```text
Dashboard
Data Table
Search
Filtering
Checkout
Onboarding
Authentication
Settings
Comparison
CRUD
Form
Wizard
Detail Page
Empty State
```

## Pattern Definition

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

# 16. Pattern Selection

The decision engine should select patterns based on:

```text
User
+
Goal
+
Task
+
Context
+
Data
+
Constraints
```

Not simply:

```text
Prompt
→ LLM opinion
```

---

# 17. Module 5 — Design System Registry

The Design System becomes a structured capability registry.

## Primitives

- Color
- Typography
- Spacing
- Radius
- Elevation
- Grid

## Semantic tokens

- Primary
- Secondary
- Success
- Warning
- Error
- Surface
- Text

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

---

# 18. Component Capability Model

Components should expose semantic capabilities.

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

The LLM should select from this registry rather than inventing components.

---

# 19. Module 6 — Generative UX Layer

The LLM remains essential.

However, it operates after decisions have been established.

## LLM responsibilities

### Interpretation

Understand ambiguous requirements.

### Synthesis

Combine user research, requirements and context.

### Exploration

Generate multiple valid solutions.

### Content

Generate:

- Labels
- Microcopy
- Empty states
- Errors
- Help text
- Descriptions

### Explanation

Explain decisions and trade-offs.

## LLM must not independently control

- Design tokens
- Accessibility requirements
- Component availability
- Critical interaction rules
- Required states
- Business constraints
- Design-system compliance

---

# 20. Module 7 — UX Evaluation Engine

Generated UX must be evaluated.

Evaluation categories:

### Task effectiveness

Can users accomplish the intended task?

### Cognitive load

Is unnecessary information or complexity introduced?

### Consistency

Does the solution follow established patterns?

### Accessibility

Are required accessibility considerations present?

### Error prevention

Does the interface prevent common mistakes?

### Feedback

Does the system communicate state changes?

### Design-system compliance

Are approved components and tokens used?

---

# 21. Evaluation Output

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

Scores should be accompanied by evidence and rules.

---

# 22. Existing Feature — Layout Brainstorm V2

The existing Layout Brainstorm feature should be retained but rebuilt on the new architecture.

## Existing

```text
Prompt
 ↓
LLM
 ↓
3 layouts
```

## V2

```text
Prompt
 ↓
UX Intent
 ↓
Decision Engine
 ↓
Valid Pattern Space
 ↓
LLM
 ↓
3 layout directions
 ↓
Evaluator
```

## Example

User:

> Create an expense dashboard for managers.

System determines:

```text
High data volume
Frequent task
Comparison required
Filtering required
Bulk actions required
```

Then generates:

### Option 1 — Task First

Prioritize pending approvals.

### Option 2 — Exception First

Prioritize unusual or problematic expenses.

### Option 3 — Overview First

Prioritize aggregate expense metrics.

Each option includes:

- UX rationale
- Advantages
- Trade-offs
- Applicable rules
- Recommended components

---

# 23. Existing Feature — UI Copy V2

UI Copy should become context-aware.

Instead of:

```text
Generate button labels
```

the system understands:

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
```

Example:

```text
Action = destructive
Risk = high
```

The system can recommend:

> Delete account

instead of generating arbitrary alternatives.

---

# 24. Existing Feature — Feedback Summary V2

Pipeline:

```text
Raw feedback
 ↓
LLM clustering
 ↓
UX issue model
 ↓
Decision engine
 ↓
Recommended UX changes
```

Example:

### Feedback

> "I couldn't find where to change the billing date."

### Identified issue

Navigation discoverability.

### Decision

Expose billing settings within subscription context.

### Recommended pattern

Contextual settings action.

---

# 25. New Feature — UX Analyze

A new primary feature.

## User input

> "I need a dashboard for managers to review employee expenses."

System returns:

### UX Intent

```text
User: Manager
Goal: Review expenses
Frequency: Daily
Data: High volume
Device: Desktop
```

### Recommended UX

```text
Data table
Search
Filters
Bulk actions
Side-panel detail
Approval actions
```

### Decision rationale

Every recommendation can be expanded.

---

# 26. New Feature — UX Decision Inspector

Users can inspect every decision.

Example:

```text
DATA PRESENTATION

Recommended:
Data Table

Confidence:
94%

Why:
• High data volume
• Comparison required
• Sorting required
• Filtering required

Rules:
DATA_VOLUME_HIGH
COMPARISON_REQUIRED
FILTER_REQUIRED

Alternative:
Card Grid

Rejected because:
Poor comparison efficiency.
```

---

# 27. New Feature — Compare Solutions

Allow designers to compare generated UX directions.

```text
             Option A    Option B    Option C

Task speed      9            7           8
Discoverability8            9           7
Complexity     6            8           7
Scalability    9            7           8
```

The system should explain the trade-offs rather than simply declaring a winner.

---

# 28. New Feature — UX Evaluate

User provides:

- Screenshot
- UI description
- Design specification
- Generated interface

System evaluates against:

```text
Task
UX rules
Heuristics
Accessibility
Design system
Required states
```

---

# 29. New Feature — Design System Import

Future capability.

Allow importing a structured design system containing:

```text
tokens
components
variants
states
patterns
usage rules
```

Potential future sources:

- Figma
- JSON
- Storybook
- CSS variables
- Design token files

V2 should initially support a structured JSON definition.

---

# 30. UX Decision DSL

Long-term, introduce a lightweight domain-specific format.

Example:

```text
WHEN
  user.selection = multiple
  AND options.visibility = visible

RECOMMEND
  Checkbox

BECAUSE
  independent multi-selection is required

AVOID
  Radio
```

This makes UX reasoning understandable to designers.

---

# 31. Human Override

The designer must be able to override a recommendation.

Example:

```text
System:
Use Data Table

Designer:
Use Cards instead

Reason:
Users focus on one expense at a time.
```

The system should record:

```text
System recommendation
Designer override
Override reason
```

This creates valuable future training data.

---

# 32. Learning From Designer Decisions

Future V2.x capability:

```text
System recommendation
       ↓
Designer decision
       ↓
Accepted / rejected / modified
       ↓
Decision history
```

This allows Design Companion to eventually learn:

- Team preferences
- Product-specific conventions
- Design-system conventions
- Repeated overrides

Learning should be explicit and auditable.

---

# 33. Decision Confidence

Every automated decision should expose confidence.

Example:

```text
Data Table
Confidence: 94%

Tabs
Confidence: 87%

Side Drawer
Confidence: 68%
```

Low-confidence decisions should invite designer review.

---

# 34. Explainability Model

Every recommendation should follow:

```text
DECISION
↓
EVIDENCE
↓
RULES
↓
REASONING
↓
ALTERNATIVES
↓
TRADE-OFFS
```

Example:

> **Use a side panel**

Evidence:

> Users need to inspect record details without losing their position in the list.

Rules:

```text
CONTEXT_PRESERVATION
HIGH_FREQUENCY_TASK
LIST_DETAIL_WORKFLOW
```

Alternative:

> Full-page detail

Trade-off:

> Provides more space but increases navigation cost.

---

# 35. Technical Architecture

The existing AI abstraction should remain.

Conceptually:

```text
AI Provider
    ↓
Generation Service
    ↓
UX Intent Parser
    ↓
Decision Engine
    ↓
Pattern Resolver
    ↓
Component Resolver
    ↓
Generation Service
    ↓
Evaluator
```

The system should remain provider-agnostic.

---

# 36. Suggested Repository Architecture

```text
design-companion/

src/

  app/
    analyze/
    layout-mode/
    copy-mode/
    feedback-mode/
    evaluate/
    settings/

  lib/

    ai/
      generate.ts
      providers.ts
      prompts/

    ux/
      intent/
      decisions/
      rules/
      patterns/
      heuristics/
      evaluator/

    design-system/
      tokens/
      components/
      states/
      registry/

    schemas/

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

docs/

  PRD.md
  UX-MODEL.md
  DECISION-MODEL.md
  DESIGN-SYSTEM.md
  ARCHITECTURE.md

tests/

  intent/
  decisions/
  rules/
  patterns/
  evaluation/
```

---

# 37. API Architecture

## POST `/api/ux/analyze`

Input:

```json
{
  "prompt": "Create an expense review dashboard"
}
```

Output:

```json
{
  "intent": {},
  "decisions": [],
  "patterns": [],
  "components": []
}
```

## POST `/api/ux/generate`

Input:

```json
{
  "intent": {},
  "decisions": {},
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

## POST `/api/ux/evaluate`

Input:

```json
{
  "ux": {},
  "intent": {},
  "rules": {}
}
```

Output:

```json
{
  "score": 82,
  "issues": []
}
```

---

# 38. Zod Schema Requirements

All major intermediate representations must be validated.

Required schemas:

```text
UXIntentSchema
UXDecisionSchema
UXRuleSchema
UXPatternSchema
ComponentSchema
UXEvaluationSchema
GenerationSchema
```

The system must reject invalid generated structures.

---

# 39. Deterministic vs Generative Responsibilities

This distinction should be documented as a core architectural principle.

| Responsibility | LLM | Decision Engine |
|---|---:|---:|
| Understand natural language | ✓ | |
| Extract user intent | ✓ | |
| Identify ambiguity | ✓ | |
| Generate copy | ✓ | |
| Generate alternatives | ✓ | |
| Select UX pattern | Assist | ✓ |
| Apply UX rules | | ✓ |
| Enforce constraints | | ✓ |
| Select valid component | Assist | ✓ |
| Enforce accessibility rules | | ✓ |
| Design-system compliance | | ✓ |
| Explain decisions | ✓ | |
| Evaluate evidence | ✓ | ✓ |
| Final designer decision | | Designer |

---

# 40. MVP Scope

V2 MVP should not attempt to build a complete UX knowledge engine.

The MVP should include:

## Core

- UX Intent
- UX Decision Engine
- UX Rule Library
- Pattern Registry
- Component Registry
- Decision Inspector
- UX Analyze
- Decision-guided Layout Brainstorm

## Existing

- UI Copy
- Feedback Summary

These should be migrated to the new architecture.

---

# 41. Initial UX Rules

Target:

**30–50 high-quality rules.**

Categories:

### Forms

5–8 rules

### Selection

5 rules

### Tables

5 rules

### Navigation

5 rules

### Feedback

5 rules

### Search/filter

5 rules

### Accessibility

10 rules

This is preferable to creating hundreds of weak rules.

---

# 42. Success Metrics

## Decision acceptance rate

Percentage of AI recommendations accepted by designers.

Initial target:

> >70%

## Decision override rate

Percentage of decisions overridden.

Initial target:

> <30%

This should not necessarily be minimized; overrides are valuable learning signals.

## Design-system compliance

Percentage of generated components using approved components.

Initial target:

> >95%

## UX evaluation improvement

Compare:

```text
LLM-only generation
vs
Decision-guided generation
```

Measure:

- Task clarity
- Consistency
- Accessibility
- Design-system compliance
- Usability

---

# 43. Research Experiment

One of the most important V2 experiments should compare three systems.

## A — LLM Only

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

## C — Decision-Guided

```text
Prompt
 ↓
LLM
 ↓
UX Intent
 ↓
Decision Engine
 ↓
Design System
 ↓
LLM
 ↓
UI
```

Evaluate all three.

This can become a strong empirical foundation for the product's core thesis.

---

# 44. Primary Research Question

The system should eventually answer:

> **Does separating UX decision-making from generative interface generation improve the consistency, explainability, usability and design-system compliance of AI-generated interfaces?**

This can become a paper, conference submission, case study or major portfolio piece.

---

# 45. Competitive Positioning

Design Companion should NOT position itself as:

> "Another AI UI generator."

Instead:

> **"AI that reasons about UX before generating it."**

Alternative positioning:

> **"A UX decision engine with generative AI."**

Technical positioning:

> **"A decision-guided generative UX system."**

Designer-focused positioning:

> **"Don't just generate UI. Understand the UX."**

---

# 46. V2 User Journey

```text
1. Designer describes problem
        ↓
2. Design Companion understands intent
        ↓
3. Designer reviews intent
        ↓
4. Decision engine proposes UX decisions
        ↓
5. Designer accepts/modifies decisions
        ↓
6. System selects patterns/components
        ↓
7. AI generates alternatives
        ↓
8. Designer compares alternatives
        ↓
9. UX evaluator identifies problems
        ↓
10. Designer refines
        ↓
11. Final UX specification
```

---

# 47. Critical UX Principle

The interface should make the distinction between:

### AI-generated

and

### System-determined

visible.

Example:

```text
┌─────────────────────────────────┐
│ UX DECISION                     │
│                                 │
│ Data Table                      │
│                                 │
│ Determined by UX rules          │
│ Confidence: 94%                 │
│                                 │
│ Why?                            │
│ • High data volume              │
│ • Comparison required           │
│ • Filtering required            │
│                                 │
│ [Accept] [Change] [Explore]     │
└─────────────────────────────────┘
```

This reinforces trust.

---

# 48. Security and Reliability

The system must not allow an LLM to bypass:

- Accessibility requirements
- Component restrictions
- Business constraints
- Validation
- Schema validation

All generated data must pass:

```text
LLM output
 ↓
Zod validation
 ↓
Rule validation
 ↓
Decision validation
 ↓
Component validation
```

---

# 49. Versioning

UX rules, patterns and components should be versioned.

Example:

```text
UX Rules v1.2
Pattern Library v1.1
Design System v3.0
```

Generated decisions should record which versions were used.

This makes decisions reproducible.

---

# 50. Audit Trail

Each generated UX should retain:

```text
Original prompt
↓
UX Intent
↓
Rules applied
↓
Decisions
↓
Pattern
↓
Components
↓
Generated variants
↓
Evaluation
↓
Designer overrides
```

This is important for explainability and future learning.

---

# 51. Future Roadmap

## V2.1

- More UX rules
- More patterns
- Design-system import
- Decision history
- Better evaluation

## V2.2

- Figma integration
- Screenshot analysis
- Component extraction
- Design-system synchronization

## V2.3

- Designer/team preferences
- Product-specific UX rules
- Learning from overrides

## V3

Potentially:

```text
Research
 ↓
Intent
 ↓
Decision
 ↓
Pattern
 ↓
Design System
 ↓
Generation
 ↓
Prototype
 ↓
User Testing
 ↓
Evidence
 ↓
Decision Model
```

This would turn Design Companion into a **closed-loop UX intelligence system**.

---

# 52. Long-Term Vision

The long-term goal is not to automate designers.

It is to make UX knowledge executable.

Today:

```text
UX knowledge
exists in
designers' heads
```

V2 aims to represent that knowledge as:

```text
UX rules
+
patterns
+
constraints
+
decision models
+
design systems
```

LLMs then make this knowledge accessible through natural language.

The long-term system becomes:

```text
              UX KNOWLEDGE
                    │
        ┌───────────┼───────────┐
        ↓           ↓           ↓
      RULES      PATTERNS    DESIGN SYSTEM
        │           │           │
        └───────────┼───────────┘
                    ↓
             DECISION ENGINE
                    ↓
                  LLM
                    ↓
              GENERATED UX
                    ↓
                EVALUATOR
                    ↓
               HUMAN DESIGNER
                    │
                    └──────────→ New knowledge
```

---

# 53. V2 Definition of Done

Design Companion V2 is considered successful when:

- A designer can describe a UX problem in natural language.
- The system produces a structured UX Intent.
- The system identifies relevant tasks and context.
- The decision engine proposes UX decisions.
- Every major decision has an explanation.
- Decisions reference explicit rules.
- Patterns are selected from a registry.
- Components are selected from a registry.
- Generated UI stays within the defined design system.
- The LLM is used for exploration and content rather than unrestricted UX decisions.
- Designers can override decisions.
- The system evaluates generated solutions.
- The system can compare alternative solutions.
- Existing Layout Brainstorm, UI Copy and Feedback Summary work through the new architecture.
- The entire pipeline produces structured, validated outputs.

---

# 54. Core V2 Thesis

The central architectural statement of Design Companion V2 is:

> **AI should not be asked to make every UX decision.**

Instead:

```text
LLM
→ Understand

UX Decision Model
→ Decide

Design System
→ Constrain

LLM
→ Generate

Evaluator
→ Validate

Designer
→ Direct
```

This separation is the foundation of Design Companion V2.

---

# 55. Product Tagline

### Primary

**Design Companion — AI that reasons about UX before it generates it.**

### Alternative

**From prompts to UX decisions.**

### Technical

**A decision-guided generative UX system.**

### Designer-focused

**Don't just generate UI. Understand the UX.**

---

# 56. First Implementation Milestone

The first engineering milestone should NOT be visual UI generation.

Build these five contracts first:

```text
UXIntent
UXDecision
UXRule
UXPattern
Component
```

Then implement:

```text
Prompt
 ↓
UXIntent
 ↓
DecisionEngine
 ↓
PatternResolver
 ↓
ComponentResolver
```

Only once this pipeline works should the LLM generation layer be connected.

This ensures the project proves its core thesis independently of visual generation.

---

# 57. Recommended V2 Development Order

## Sprint 1 — Foundation

- UXIntent schema
- UXDecision schema
- Rule schema
- Pattern schema
- Component schema

## Sprint 2 — Decision Engine

- Rule evaluator
- Decision resolver
- Confidence
- Explanation generation

## Sprint 3 — Knowledge

- First 30–50 UX rules
- 10–15 patterns
- 10–15 components

## Sprint 4 — UX Analyze

- Intent extraction
- Decision visualization
- Decision Inspector

## Sprint 5 — Layout Brainstorm V2

- Decision-guided layouts
- Trade-offs
- Alternative generation

## Sprint 6 — Evaluation

- UX evaluator
- Accessibility checks
- Design-system checks

## Sprint 7 — Integration

- UI Copy
- Feedback Summary
- Shared UX intelligence layer

## Sprint 8 — Research

- LLM-only benchmark
- Design-system benchmark
- Decision-guided benchmark

---

# 58. Final Product Architecture

```text
                         DESIGN COMPANION V2

                              USER
                               │
                               ▼
                     ┌──────────────────┐
                     │   INTENT LAYER   │
                     │                  │
                     │ LLM              │
                     │ Research         │
                     │ Requirements     │
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │  DECISION LAYER  │
                     │                  │
                     │ UX Rules         │
                     │ Heuristics       │
                     │ Constraints      │
                     │ Context          │
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │ PATTERN LAYER    │
                     │                  │
                     │ Workflows        │
                     │ Interaction     │
                     │ Layout patterns  │
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │ DESIGN SYSTEM    │
                     │                  │
                     │ Primitives       │
                     │ Semantics        │
                     │ Components       │
                     │ States           │
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │ GENERATION LAYER │
                     │                  │
                     │ LLM              │
                     │ Copy             │
                     │ Variants         │
                     │ Exploration      │
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │ EVALUATION LAYER │
                     │                  │
                     │ UX               │
                     │ Accessibility    │
                     │ Consistency      │
                     │ Compliance       │
                     └────────┬─────────┘
                              │
                              ▼
                           FINAL UX
                              │
                              ▼
                         DESIGNER
                              │
                              └───────────► Feedback
```

---

# 59. Final Product Transformation

## Design Companion V1

> "Tell me what UI to make."

## Design Companion V2

> **"Help me understand the UX problem, make defensible UX decisions, explore valid solutions, and explain why they work."**

That distinction should drive the entire V2 implementation.

---

# 60. Immediate Engineering Deliverables

The first implementation package should contain:

```text
/docs
  PRD.md
  UX-MODEL.md
  DECISION-MODEL.md
  DESIGN-SYSTEM.md
  ARCHITECTURE.md

/src/lib/schemas
  ux-intent.ts
  ux-decision.ts
  ux-rule.ts
  ux-pattern.ts
  component.ts
  ux-evaluation.ts

/src/lib/ux
  intent/
  decisions/
  rules/
  patterns/
  evaluator/

/knowledge
  ux-rules/
  patterns/
  components/
```

The first end-to-end test case should be:

> **"Design an expense-review dashboard for managers."**

Expected pipeline:

```text
Prompt
 ↓
UXIntent
 ↓
Decision Engine
 ↓
5–10 UX decisions
 ↓
Pattern selection
 ↓
Component selection
 ↓
Decision explanations
 ↓
LLM-generated layout alternatives
 ↓
UX evaluation
```

This vertical slice is the proof-of-concept for the entire Design Companion V2 architecture.
