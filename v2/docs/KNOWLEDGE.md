# UX Knowledge — review copy

> Generated from `knowledge/` by `npm run knowledge:doc`. Do not edit by hand; change the JSON and regenerate.

Versions: questions 1.1.0 · rules 0.2.0 · patterns 0.2.0 · policy 1.2.0 · evaluator 1.0.0

**50 rules · 14 patterns · 35 analysis questions · 15 evaluation questions**

## How to read this

- **Tiers** decide which considerations win, in this order: accessibility → task → business → technical → design-system → visual. A lower tier can only break a near-tie on every higher tier.
- **Priority** is strength within a tier: critical · high · medium · low. A critical rule's `RULE OUT` is a veto, not a preference.
- **WHEN** conditions are answered by the decision model (questions) or read from hard facts in the UX state (`context.device`, …).
- A noul question "is true" means the model's probability is at least 0.7.

### What to look for when reviewing

1. Is the **BECAUSE** true, and true often enough to be a rule?
2. Is the **tier** right? (Accessibility only for genuine access needs; technical for device/platform limits.)
3. Is the **priority** right? Is anything marked critical that shouldn't be a hard veto, or vice versa?
4. Are the **WHEN** conditions too broad (fires where it shouldn't) or too narrow?
5. What's **missing**: a rule you'd apply that isn't here?

## Rules

### layout (4)

```text
RULE layout.detail-in-context.side-panel   [CONTEXT_PRESERVATION · task · high]
WHEN      Do users need record details without losing their place in the list?  is true
RECOMMEND side-panel   (Detail view)
AVOID     full-page
BECAUSE   Users inspect a record and return to the list repeatedly; a side panel keeps their place, a full page loses it.
```

```text
RULE layout.detail-in-context.split-view   [LIST_DETAIL_WORKFLOW · task · medium]
WHEN      Do users need record details without losing their place in the list?  is true
AND       Is the expected data volume high?  is true
RECOMMEND split-view   (Layout)
BECAUSE   A long list with frequent detail inspection is a list–detail workflow: list and detail side by side.
```

```text
RULE layout.monitoring.dashboard   [AGGREGATE_MONITORING · task · medium]
WHEN      Do users monitor aggregate metrics?  is true
RECOMMEND dashboard   (Layout)
BECAUSE   When totals and trends matter, users need an overview before individual records.
```

```text
RULE layout.multi-step.sequence   [MULTI_STEP_TASK · task · high]
WHEN      Is the task a multi-step process?  is true
RECOMMEND multi-step   (Layout)
AVOID     dashboard
BECAUSE   A task with ordered steps is easier to complete one step at a time with clear progress.
```

### selection (5)

```text
RULE selection.multiple.checkbox   [MULTI_SELECT_INDEPENDENT · task · high]
WHEN      How do users choose among options?  = several-independent
RECOMMEND checkbox   (Selection control)
AVOID     radio, segmented-control
BECAUSE   Multiple independent selections are required; radios and segments allow only one.
SOURCE    NN/g: Checkboxes vs. Radio Buttons
```

```text
RULE selection.single-few.radio   [SINGLE_SELECT_FEW · task · medium]
WHEN      How do users choose among options?  = one-of-several
AND       How many options do users choose from?  = two-to-five-options
RECOMMEND radio   (Selection control)
AVOID     select
BECAUSE   With few options, showing them all lets users compare without opening a menu.
```

```text
RULE selection.single-some.select   [SINGLE_SELECT_MODERATE · task · medium]
WHEN      How do users choose among options?  = one-of-several
AND       How many options do users choose from?  = six-to-fifteen-options
RECOMMEND select   (Selection control)
AVOID     radio, segmented-control
BECAUSE   Six to fifteen options take too much space as radios; a dropdown keeps them compact.
```

```text
RULE selection.single-many.combobox   [SINGLE_SELECT_MANY · task · high]
WHEN      How do users choose among options?  = one-of-several
AND       How many options do users choose from?  = more-than-fifteen-options
RECOMMEND combobox   (Selection control)
AVOID     radio, segmented-control
BECAUSE   Scrolling through more than fifteen options is slow; typing to filter finds the one users want.
```

```text
RULE selection.setting.toggle   [IMMEDIATE_SETTING · task · medium]
WHEN      How do users choose among options?  = on-off-setting
RECOMMEND toggle   (Selection control)
AVOID     checkbox
BECAUSE   A single setting that takes effect immediately is a switch; a checkbox implies a later save.
SOURCE    NN/g: Toggle-Switch Guidelines
```

### navigation (4)

```text
RULE navigation.single-screen.none   [SINGLE_SCREEN · visual · low]
WHEN      How many distinct sections does this experience have?  = single-focused-screen
AND NOT   Is the task a multi-step process?  is true
RECOMMEND none   (Navigation)
BECAUSE   A single focused screen needs no in-product navigation of its own.
```

```text
RULE navigation.few-sections.tabs   [PEER_SECTIONS · task · medium]
WHEN      How many distinct sections does this experience have?  = few-peer-sections
AND NOT   Is mobile use likely?  is true
RECOMMEND tabs   (Navigation)
BECAUSE   Two to five peer sections switched in place are what tabs are for.
```

```text
RULE navigation.many-sections.sidebar   [DEEP_APP_NAVIGATION · task · medium]
WHEN      How many distinct sections does this experience have?  = many-deep-sections
AND NOT   Is mobile use likely?  is true
RECOMMEND sidebar   (Navigation)
AVOID     tabs
BECAUSE   Many sections don't fit in tabs; a persistent sidebar scales and shows where users are.
```

```text
RULE navigation.multi-step.stepper   [STEP_PROGRESS · task · high]
WHEN      Is the task a multi-step process?  is true
RECOMMEND stepper   (Navigation)
BECAUSE   In a multi-step task, users need to see where they are, what's done and what's left.
```

### forms (4)

```text
RULE forms.multi-step-entry.wizard   [STEPPED_DATA_ENTRY · task · high]
WHEN      Is the task a multi-step process?  is true
AND       Is the task dominated by data entry?  is true
RECOMMEND wizard   (Form structure)
AVOID     single-page-form
BECAUSE   Entering information across ordered steps is easier one step at a time, with progress shown and earlier steps revisitable.
SOURCE    NN/g: Wizards: Definition and Design Recommendations
```

```text
RULE forms.long-form.single-page   [LONG_FORM_SECTIONED · task · medium]
WHEN      Does the task include a long form?  is true
AND NOT   Is the task a multi-step process?  is true
RECOMMEND single-page-form   (Form structure)
AVOID     wizard
REQUIRE   form-validation
STATES    error, validating
BECAUSE   A long form without a natural order is faster on one page in labelled sections; splitting it into steps only hides what's left.
```

```text
RULE forms.quick-edits.inline   [INLINE_EDIT_SMALL_CHANGES · task · medium]
WHEN      Do users often change one or two fields of existing records?  is true
AND NOT   Does the task include a long form?  is true
RECOMMEND inline-edit   (Form structure)
BECAUSE   Changing one field shouldn't mean opening a whole form; editing in place keeps users in their flow.
```

```text
RULE forms.authentication.single-page   [SHORT_AUTH_FORM · task · medium]
WHEN      Does the task involve signing in or signing up?  is true
RECOMMEND single-page-form   (Form structure)
AVOID     wizard
BECAUSE   Sign-in and sign-up are short and familiar; splitting them across steps adds friction at the moment users are least committed.
SOURCE    NN/g: Login Walls
```

### tables (9)

```text
RULE tables.volume-high.table   [DATA_VOLUME_HIGH · task · high]
WHEN      Is the expected data volume high?  is true
AND NOT   Are records primarily recognized visually?  is true
RECOMMEND data-table   (Data presentation)
AVOID     card-grid
BECAUSE   Many text-and-number records are scanned fastest in rows and columns; cards fit far fewer records per screen.
SOURCE    NN/g: Data Tables: Four Major User Tasks
```

```text
RULE tables.comparison.table   [COMPARISON_REQUIRED · task · high]
WHEN      Is comparison between records important?  is true
RECOMMEND data-table   (Data presentation)
AVOID     card-grid, list
BECAUSE   Comparing attributes across records needs aligned columns; cards and lists break that alignment.
SOURCE    NN/g: Comparison Tables
```

```text
RULE tables.density-high.table   [INFO_DENSITY_HIGH · task · medium]
WHEN      How much information per record must be visible at once?  score ≥ 1.5
RECOMMEND data-table   (Data presentation)
AVOID     list
BECAUSE   Six or more attributes per record at a glance need a column layout to stay readable.
```

```text
RULE tables.visual-records.cards   [VISUAL_RECORDS · task · medium]
WHEN      Are records primarily recognized visually?  is true
RECOMMEND card-grid   (Data presentation)
BECAUSE   Records recognized by images need room for a visual preview, which cards provide.
```

```text
RULE tables.staged-records.kanban   [STAGED_RECORDS · task · medium]
WHEN      How is the data structured?  = ordered-stages
RECOMMEND kanban   (Data presentation)
BECAUSE   Records that move through ordered stages are easiest to track as columns per stage.
```

```text
RULE tables.time-ordered.timeline   [TIME_ORDERED_RECORDS · task · medium]
WHEN      How is the data structured?  = time-ordered-events
RECOMMEND timeline   (Data presentation)
BECAUSE   When records matter mainly by when they happened, a timeline makes order and gaps visible.
```

```text
RULE tables.volume-high.paginate   [PAGINATION_HIGH_VOLUME · task · high]
WHEN      Is the expected data volume high?  is true
RECOMMEND paginated   (Pagination)
AVOID     none
BECAUSE   Loading every record at once is slow and disorienting at high volume; pages keep position and load time predictable.
```

```text
RULE tables.sorting.avoid-infinite-scroll   [SORTED_LIST_POSITION · task · low]
WHEN      Is sorting required?  is true
AVOID     infinite-scroll   (Pagination)
BECAUSE   With sorted records users need to return to a known position; infinite scroll loses it on reload.
```

```text
RULE tables.bulk-actions.bar   [BULK_ACTIONS_REQUIRED · task · high]
WHEN      Are bulk actions required?  is true
RECOMMEND bulk-action-bar   (Bulk actions)
AVOID     none
BECAUSE   Applying one action to many records one at a time is slow and error-prone; select-then-act is faster.
SOURCE    NN/g: Bulk Actions
```

### search (2)

```text
RULE search.lookup.visible   [SEARCH_REQUIRED · task · high]
WHEN      Do users need to search for specific records?  is true
RECOMMEND visible-search   (Search)
AVOID     none
BECAUSE   Users who look up known records need a visible search field; hiding it behind an icon adds a step to a frequent task.
SOURCE    NN/g: Search: Visible and Simple
```

```text
RULE search.many-sections.global   [GLOBAL_SEARCH_DEEP_APP · task · medium]
WHEN      Do users need to search for specific records?  is true
AND       How many distinct sections does this experience have?  = many-deep-sections
RECOMMEND global-search   (Search)
BECAUSE   Across many sections, one global search finds records without users knowing where they live.
```

### filtering (3)

```text
RULE filtering.frequent.persistent-bar   [FILTER_REQUIRED · task · high]
WHEN      Is filtering required?  is true
AND       Is the primary task performed frequently?  is true
RECOMMEND persistent-filter-bar   (Filtering)
AVOID     none
BECAUSE   Frequent users narrow records constantly; keeping filters visible saves opening a panel every time and shows what's applied.
SOURCE    NN/g: Filters vs. Facets
```

```text
RULE filtering.occasional.panel   [FILTER_OCCASIONAL · task · medium]
WHEN      Is filtering required?  is true
AND NOT   Is the primary task performed frequently?  is true
RECOMMEND filter-panel   (Filtering)
AVOID     none
BECAUSE   Occasional filtering doesn't justify permanent screen space; a panel keeps many filters available on demand.
```

```text
RULE filtering.small-set.none   [FILTER_UNNECESSARY · visual · low]
WHEN NOT  Is filtering required?  is true
AND NOT   Is the expected data volume high?  is true
RECOMMEND none   (Filtering)
BECAUSE   A small set that users don't need to narrow is clearer without filter controls.
```

### feedback (4)

```text
RULE feedback.async-outcome.toast   [ASYNC_OUTCOME · task · medium]
WHEN      Do action outcomes arrive later?  is true
RECOMMEND toast   (Status feedback)
BECAUSE   Outcomes that arrive later need a non-blocking notification wherever the user is when they finish.
```

```text
RULE feedback.bulk-result.toast   [BULK_RESULT_SUMMARY · task · low]
WHEN      Are bulk actions required?  is true
RECOMMEND toast   (Status feedback)
BECAUSE   A bulk action's result is best summarized once ("12 expenses approved") without interrupting the next task.
```

```text
RULE feedback.data-entry.inline   [INLINE_VALIDATION · task · medium]
WHEN      Is the task dominated by data entry?  is true
RECOMMEND inline-message   (Status feedback)
BECAUSE   Errors in entered data belong next to the field they concern, where users can fix them.
SOURCE    NN/g: Error-Message Guidelines
```

```text
RULE feedback.states.required   [DATA_STATES_REQUIRED · task · medium]
WHEN ANY  of:
            • Is the expected data volume high?  is true
            • Is filtering required?  is true
            • Do users need to search for specific records?  is true
REQUIRE   empty-state-display
STATES    loading, empty, error
BECAUSE   Lists that load, filter or search will be loading, empty or failing at some point; each state needs a designed response.
```

### responsive (4)

```text
RULE layout.mobile.avoid-split-view   [SMALL_SCREEN_SPLIT_VIEW · technical · critical]
WHEN      context.device is mobile
RULE OUT  split-view   (Layout)
BECAUSE   On a phone, a list and its detail cannot sit side by side; a split view would collapse into an unusable sliver.
```

```text
RULE navigation.mobile.bottom-nav   [MOBILE_PRIMARY_NAV · technical · medium]
WHEN      Is mobile use likely?  is true
AND ANY   of:
            • How many distinct sections does this experience have?  = few-peer-sections
            • How many distinct sections does this experience have?  = many-deep-sections
RECOMMEND bottom-nav   (Navigation)
AVOID     sidebar
BECAUSE   On phones, primary destinations belong within thumb reach at the bottom of the screen.
```

```text
RULE responsive.mobile.full-page-detail   [SMALL_SCREEN_DETAIL · technical · critical]
WHEN      context.device is mobile
AND ANY   of:
            • Do users need record details without losing their place in the list?  is true
            • Is the expected data volume high?  is true
RECOMMEND full-page   (Detail view)
RULE OUT  side-panel
BECAUSE   On a phone there is no room for a side panel beside the list; detail opens full-page with a clear way back.
```

```text
RULE responsive.mobile.filter-panel   [SMALL_SCREEN_FILTERS · technical · medium]
WHEN      Is mobile use likely?  is true
AND       Is filtering required?  is true
RECOMMEND filter-panel   (Filtering)
AVOID     persistent-filter-bar
BECAUSE   A persistent filter bar takes most of a phone screen; a filter panel opens on demand and shows an active-filter count.
```

### accessibility (7)

```text
RULE accessibility.status.not-color-only   [STATUS_NOT_COLOR_ONLY · accessibility · high]
WHEN      Must users spot unusual or problematic records?  is true
REQUIRE   status-badge
BECAUSE   Flags and statuses must carry a text label, not color alone, so everyone can spot problem records.
SOURCE    WCAG 2.2 SC 1.4.1 Use of Color
```

```text
RULE accessibility.infinite-scroll.keyboard   [REACHABLE_CONTENT · accessibility · medium]
WHEN      Is the expected data volume high?  is true
AVOID     infinite-scroll   (Pagination)
BECAUSE   Infinite scroll keeps pushing content away from keyboard and screen-reader users and makes the footer unreachable.
SOURCE    WCAG 2.2 SC 2.1.1 Keyboard, SC 2.4.1 Bypass Blocks
```

```text
RULE accessibility.errors.persistent   [ERRORS_PERSISTENT · accessibility · high]
WHEN      Is the task dominated by data entry?  is true
AVOID     toast   (Status feedback)
BECAUSE   Input errors must stay visible and be associated with their field; a disappearing toast fails both.
SOURCE    WCAG 2.2 SC 3.3.1 Error Identification
```

```text
RULE accessibility.time-pressure.no-auto-dismiss   [TIMING_ADJUSTABLE · accessibility · high]
WHEN      How much time pressure are users under?  score ≥ 1.5
AVOID     toast   (Status feedback)
BECAUSE   Under time pressure, messages that vanish on a timer get missed; important feedback must persist until dismissed.
SOURCE    WCAG 2.2 SC 2.2.1 Timing Adjustable
```

```text
RULE accessibility.kanban.keyboard-alternative   [DRAG_ALTERNATIVE · accessibility · high]
WHEN      How is the data structured?  = ordered-stages
REQUIRE   overflow-menu
BECAUSE   Moving cards between stages by drag alone excludes keyboard and switch users; a menu action must do the same.
SOURCE    WCAG 2.2 SC 2.5.7 Dragging Movements
```

```text
RULE accessibility.destructive.focus-safe   [SAFE_DEFAULT_FOCUS · accessibility · high]
WHEN      Does the workflow include destructive actions?  is true
REQUIRE   destructive-action
STATES    focus
BECAUSE   Destructive buttons need a distinct, non-color-only treatment and must never be the default focused action.
SOURCE    WCAG 2.2 SC 1.4.1, SC 2.4.7 Focus Visible
```

```text
RULE accessibility.input-format.instructions   [INPUT_FORMAT_INSTRUCTIONS · accessibility · high]
WHEN      Must users enter values in specific formats?  is true
REQUIRE   text-input, form-validation
STATES    error
BECAUSE   When a value must follow a format, the expected format belongs in the label or helper text, and errors must say how to fix the value.
SOURCE    WCAG 2.2 SC 3.3.2 Labels or Instructions, SC 3.3.3 Error Suggestion
```

### error-prevention (4)

```text
RULE error-prevention.destructive.protect   [DESTRUCTIVE_PROTECTED · task · critical]
WHEN      Does the workflow include destructive actions?  is true
RECOMMEND confirm-dialog or undo-toast   (Action confirmation)
RULE OUT  none
BECAUSE   Destructive actions must be either confirmed or undoable; leaving them unprotected invites costly slips.
SOURCE    Nielsen heuristic 5: Error prevention
```

```text
RULE error-prevention.irreversible.confirm   [IRREVERSIBLE_CONFIRM · task · high]
WHEN      Does the workflow include destructive actions?  is true
AND NOT   Can destructive actions be undone easily?  is true
RECOMMEND confirm-dialog   (Action confirmation)
AVOID     undo-toast
BECAUSE   When an action notifies others or triggers a process, undo can't take it back — confirm before it happens.
```

```text
RULE error-prevention.reversible.undo   [REVERSIBLE_UNDO · task · medium]
WHEN      Does the workflow include destructive actions?  is true
AND       Can destructive actions be undone easily?  is true
RECOMMEND undo-toast   (Action confirmation)
AVOID     confirm-dialog
BECAUSE   When an action can be undone cleanly, undo is faster than confirming and avoids confirmation fatigue.
SOURCE    NN/g: Confirmation Dialogs Can Prevent User Errors (if not overused)
```

```text
RULE error-prevention.high-cost.confirm   [HIGH_ERROR_COST · business · medium]
WHEN      Does the workflow include destructive actions?  is true
AND       How costly is a user error?  score ≥ 1.5
RECOMMEND confirm-dialog   (Action confirmation)
BECAUSE   Mistakes here have money, legal or trust consequences; an explicit confirmation states the consequence before it happens.
```

## Patterns

```text
PATTERN data-table   [Data Table]
PURPOSE   Review and manipulate large structured datasets
FITS WHEN Is the expected data volume high?  is true
OR        Is comparison between records important?  is true
OR        Is sorting required?  is true
MATCHES   Data presentation = data-table
NEEDS     tabular-display, sorting
MAY USE   row-selection, pagination, bulk-action-bar, inline-row-actions, column-customization
STATES    loading, empty, error, populated
WITH      filtering, search, detail-page, empty-state
AVOID     Horizontal scrolling to reach the primary action
AVOID     Truncating the column users compare on
```

```text
PATTERN filtering   [Filtering]
PURPOSE   Narrow a record set by attribute values
FITS WHEN Is filtering required?  is true
MATCHES   Filtering = persistent-filter-bar | filter-panel | saved-views
NEEDS     filter-controls
MAY USE   side-drawer, status-badge
STATES    default, active, empty
WITH      data-table, search, empty-state
AVOID     Hiding which filters are active
AVOID     Resetting filters on navigation
```

```text
PATTERN search   [Search]
PURPOSE   Find specific known records by query
FITS WHEN Do users need to search for specific records?  is true
MATCHES   Search = visible-search | global-search
NEEDS     search-input
MAY USE   searchable-select
STATES    default, loading, empty
WITH      data-table, filtering, empty-state
AVOID     Search that silently ignores active filters
```

```text
PATTERN detail-page   [Detail Page]
PURPOSE   Inspect one record in depth
FITS WHEN Do users need record details without losing their place in the list?  is true
MATCHES   Detail view = side-panel | full-page | modal
NEEDS     (no specific capability)
MAY USE   side-drawer, breadcrumb-trail, status-badge
STATES    loading, error, populated
WITH      data-table
AVOID     Losing the list position when closing the detail
```

```text
PATTERN dashboard   [Dashboard]
PURPOSE   Overview of aggregate state with entry points to detail
FITS WHEN Do users monitor aggregate metrics?  is true
MATCHES   Layout = dashboard
NEEDS     metric-summary
MAY USE   data-visualization, status-badge
STATES    loading, empty, error, populated
WITH      data-table, empty-state
AVOID     Metrics with no way to act on them
```

```text
PATTERN form   [Form]
PURPOSE   Enter or edit information with validation
FITS WHEN Is the task dominated by data entry?  is true
MATCHES   Form structure = single-page-form | inline-edit
NEEDS     text-input, form-validation
MAY USE   single-select-dropdown, multi-select-checkbox, date-input
STATES    default, error, success
WITH      wizard
AVOID     Clearing entered data on error
AVOID     Placeholder text used as the only label
```

```text
PATTERN wizard   [Wizard]
PURPOSE   Complete a long or ordered task one step at a time
FITS WHEN Is the task a multi-step process?  is true
MATCHES   Layout = multi-step
MATCHES   Form structure = wizard
MATCHES   Navigation = stepper
NEEDS     step-indicator, form-validation
MAY USE   text-input
STATES    default, error, success
WITH      form
AVOID     Steps that can't be revisited
AVOID     Unknown total number of steps
```

```text
PATTERN empty-state   [Empty State]
PURPOSE   Explain an empty view and offer the next step
FITS WHEN Is filtering required?  is true
OR        Do users need to search for specific records?  is true
NEEDS     empty-state-display
MAY USE   primary-action
STATES    empty
WITH      data-table, filtering, search
AVOID     A blank area with no explanation
```

```text
PATTERN checkout   [Checkout]
PURPOSE   Review an order and pay with confidence
FITS WHEN Does the task involve paying?  is true
MATCHES   Layout = multi-step | single-page
MATCHES   Form structure = wizard | single-page-form
NEEDS     text-input, form-validation, step-indicator, primary-action
MAY USE   single-select-dropdown, inline-message
STATES    default, loading, error, success
WITH      form, wizard, authentication
AVOID     Forcing account creation before purchase
AVOID     Revealing fees or the total only on the last step
AVOID     Clearing payment details after a validation error
```

```text
PATTERN onboarding   [Onboarding]
PURPOSE   Get new users to their first moment of value
FITS WHEN Do first-time users need guidance before they get value?  is true
MATCHES   Layout = multi-step
MATCHES   Navigation = stepper
NEEDS     step-indicator, primary-action
MAY USE   empty-state-display, tooltip, progress-indicator, secondary-action
STATES    default, success
WITH      wizard, empty-state, form
AVOID     A long product tour before any value
AVOID     No way to skip or resume later
AVOID     Asking for information that is not needed yet
```

```text
PATTERN authentication   [Authentication]
PURPOSE   Sign in, sign up and recover an account
FITS WHEN Does the task involve signing in or signing up?  is true
MATCHES   Form structure = single-page-form
NEEDS     text-input, form-validation, primary-action
MAY USE   secondary-action, inline-message
STATES    default, loading, error
WITH      form
AVOID     Blocking paste into password fields (WCAG 3.3.8)
AVOID     Cognitive tests such as puzzles without an alternative (WCAG 3.3.8)
AVOID     Error messages that reveal whether an account exists
```

```text
PATTERN settings   [Settings]
PURPOSE   Change preferences and options
FITS WHEN Do users configure preferences or settings?  is true
MATCHES   Selection control = toggle | radio | select
MATCHES   Navigation = tabs | sidebar
MATCHES   Form structure = inline-edit
NEEDS     on-off-toggle, inline-message
MAY USE   tab-navigation, sidebar-navigation, single-select-dropdown, single-choice-radio
STATES    default, success, error
WITH      form
AVOID     A Save button for settings that apply instantly
AVOID     Mixing instant and saved settings on one screen without saying which is which
```

```text
PATTERN comparison   [Comparison]
PURPOSE   Choose between a few alternatives by comparing their features
FITS WHEN Do users choose between alternatives by comparing features?  is true
MATCHES   Data presentation = data-table | card-grid
NEEDS     (no specific capability)
MAY USE   tabular-display, card-display, status-badge, primary-action
STATES    default, populated
WITH      checkout
AVOID     Comparing more than about five alternatives side by side
AVOID     Rows where every option has the same value, hiding the real differences
```

```text
PATTERN crud   [CRUD]
PURPOSE   Create, read, update and delete records
FITS WHEN Do users create, edit and delete records?  is true
MATCHES   Form structure = single-page-form | inline-edit
MATCHES   Action confirmation = confirm-dialog | undo-toast
NEEDS     primary-action, destructive-action, text-input
MAY USE   inline-row-actions, destructive-confirmation, undo-action, form-validation
STATES    loading, empty, error, populated, success
WITH      data-table, form, detail-page, empty-state
AVOID     Delete next to Save with equal emphasis
AVOID     Losing unsaved edits when navigating away
```

## Analysis questions

| Id | Type | Question | Answers |
|---|---|---|---|
| `data.volume.high` | noul | Is the expected data volume high? | true / false |
| `data.comparison.required` | noul | Is comparison between records important? | true / false |
| `data.filtering.required` | noul | Is filtering required? | true / false |
| `data.sorting.required` | noul | Is sorting required? | true / false |
| `data.search.required` | noul | Do users need to search for specific records? | true / false |
| `data.density.need` | score | How much information per record must be visible at once? | 0 / 1 / 2 (levels) |
| `data.records.visual` | noul | Are records primarily recognized visually? | true / false |
| `data.structure.kind` | choice | How is the data structured? | flat-independent-records, nested-hierarchy, ordered-stages, time-ordered-events |
| `task.frequency.high` | noul | Is the primary task performed frequently? | true / false |
| `task.bulk-actions.required` | noul | Are bulk actions required? | true / false |
| `task.detail-in-context.required` | noul | Do users need record details without losing their place in the list? | true / false |
| `task.multi-step.required` | noul | Is the task a multi-step process? | true / false |
| `task.data-entry.heavy` | noul | Is the task dominated by data entry? | true / false |
| `task.long-form.present` | noul | Does the task include a long form? | true / false |
| `task.monitoring.aggregate` | noul | Do users monitor aggregate metrics? | true / false |
| `task.exceptions.important` | noul | Must users spot unusual or problematic records? | true / false |
| `action.destructive.present` | noul | Does the workflow include destructive actions? | true / false |
| `action.destructive.reversible` | noul | Can destructive actions be undone easily? | true / false |
| `risk.error-cost` | score | How costly is a user error? | 0 / 1 / 2 (levels) |
| `task.time-pressure` | score | How much time pressure are users under? | 0 / 1 / 2 (levels) |
| `app.sections.count` | choice | How many distinct sections does this experience have? | single-focused-screen, few-peer-sections, many-deep-sections |
| `selection.mode` | choice | How do users choose among options? | no-option-selection, one-of-several, several-independent, on-off-setting |
| `selection.option-count` | choice | How many options do users choose from? | two-to-five-options, six-to-fifteen-options, more-than-fifteen-options |
| `device.mobile.likely` | noul | Is mobile use likely? | true / false |
| `feedback.outcome.async` | noul | Do action outcomes arrive later? | true / false |
| `decision.data-presentation` | choice | Which data presentation best fits the task? | data-table, card-grid, list, timeline, kanban, chart |
| `decision.layout` | choice | Which overall layout best fits the task? | single-page, multi-step, split-view, dashboard, detail-view |
| `task.payment.present` | noul | Does the task involve paying? | true / false |
| `task.authentication.present` | noul | Does the task involve signing in or signing up? | true / false |
| `task.first-use.guided` | noul | Do first-time users need guidance before they get value? | true / false |
| `task.configuration.present` | noul | Do users configure preferences or settings? | true / false |
| `task.option-comparison.required` | noul | Do users choose between alternatives by comparing features? | true / false |
| `task.record-lifecycle.present` | noul | Do users create, edit and delete records? | true / false |
| `task.quick-edits.frequent` | noul | Do users often change one or two fields of existing records? | true / false |
| `task.structured-input.required` | noul | Must users enter values in specific formats? | true / false |

## Evaluation questions

Asked once per evaluated solution. A good answer is `true` (or a high level); a poor one raises the issue shown, at its severity.

| Id | Category | Question | Severity | Issue → recommendation |
|---|---|---|---|---|
| `eval.task.primary-central` | Task effectiveness | Is the primary task at the centre of the solution? | high | The primary task isn't the focus of the screen → Give the primary task the most prominent space and make it reachable without extra steps. |
| `eval.clarity.primary-action` | Task clarity | Is the primary action easy to find? | high | The main action is hard to find → Make the main action visible and visually dominant where users need it. |
| `eval.clarity.regions-purposeful` | Task clarity | Does every area of the screen have a clear purpose? | medium | Some areas don't have a clear purpose → Give each region one clear job, and merge or remove catch-all areas. |
| `eval.ia.hierarchy` | Information architecture | Does the order of information match what users need first? | medium | Information isn't ordered by what users need first → Reorder regions so the most important information comes first and is most prominent. |
| `eval.ia.grouping` | Information architecture | Are related things grouped together? | medium | Related controls and information are scattered → Place filters with the list they filter and actions with the item they act on. |
| `eval.interaction.efficient` | Interaction quality | Are the interactions efficient for how often users do this? | medium | Interactions add steps for how often this is used → Reduce steps for frequent work, e.g. bulk actions, inline actions or shortcuts. |
| `eval.cognitive.load` | Cognitive load | How light is the mental effort the solution asks of users? | medium | The screen asks a lot of users at once → Show less at once: progressive disclosure, fewer simultaneous choices, a more predictable layout. |
| `eval.a11y.keyboard` | Accessibility | Can everything be done without a mouse or drag gestures? | critical | Some interactions need a mouse, hover or dragging → Provide keyboard and simple-pointer equivalents for every interaction (WCAG 2.1.1, 2.5.7). |
| `eval.a11y.not-color-only` | Accessibility | Is meaning conveyed by more than colour alone? | high | Some meaning is shown by colour alone → Add text labels or icons to colour-coded status and errors (WCAG 1.4.1). |
| `eval.errors.destructive-protected` | Error prevention | Are destructive or irreversible actions protected? | critical | A destructive action isn't protected → Add a confirmation for irreversible actions, or an undo for reversible ones. |
| `eval.feedback.outcomes` | Feedback | Do users learn the outcome of what they did? | high | Users may not learn the outcome of their actions → Confirm success and explain failures where users will notice, and show progress for longer operations. |
| `eval.consistency.patterns` | Consistency | Are similar things done the same way throughout? | low | Similar things are done in different ways → Use one pattern for each kind of action and information throughout. |
| `eval.ds.compliant` | Design-system compliance | Is the solution built from the design system's components? | high | The solution relies on elements outside the design system → Build from the design system's components, and mark anything missing as a net-new component. |
| `eval.states.represented` | Required states | Does the solution show its loading, empty and error states? | high | Loading, empty or error states aren't described → Describe what users see while loading, when there's nothing to show, and when something fails. |
| `eval.responsive.adapts` | Responsive behavior | Does the solution work on the devices people will use? | medium | It isn't clear how this works on the expected devices → Describe how the layout adapts to each expected device, especially phones. |
