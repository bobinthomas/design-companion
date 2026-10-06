import type { UXStateInput } from "@/lib/schemas";

/**
 * The PRD's first end-to-end test case (§41): "Design an expense-review
 * dashboard for managers." Used as the golden pipeline input and as the
 * canned state when no LLM key is configured.
 *
 * Note the state describes rather than judges: it says how much data there
 * is, not that volume is "high" — the decision model makes that call.
 */
export const EXPENSE_DASHBOARD_BRIEF = "Design an expense-review dashboard for managers.";

export const expenseDashboardState: UXStateInput = {
  brief: EXPENSE_DASHBOARD_BRIEF,
  product: "Expense Management",
  summary: "Managers review, approve or reject employee expense submissions every day.",
  user: {
    role: "Manager",
    expertise: "intermediate",
    audience: "internal",
    description: "Line managers with 5–30 direct reports; not finance specialists.",
  },
  goal: {
    primary: "Review employee expenses",
    secondary: ["Search expenses", "Filter expenses", "Approve expenses", "Reject expenses"],
    successCriteria: [
      "Pending expenses are cleared within the review cycle",
      "Policy violations are caught before approval",
    ],
  },
  tasks: [
    { name: "Review and approve expenses", kind: "primary", frequency: "daily" },
    {
      name: "Approve or reject several expenses at once",
      kind: "supporting",
      frequency: "daily",
    },
    { name: "Find a specific expense", kind: "supporting", frequency: "weekly" },
    { name: "Inspect receipt and line items", kind: "supporting", frequency: "daily" },
  ],
  actions: [
    { name: "Approve", description: "Approve an expense for reimbursement." },
    {
      name: "Reject",
      description: "Reject an expense with a reason; the employee must resubmit.",
    },
    { name: "Export", description: "Export filtered expenses to CSV for finance." },
  ],
  context: {
    device: "desktop",
    frequency: "daily",
    environment: "Office, between meetings",
    dataVolume: "Roughly 150–300 pending expense reports per manager per week",
    timePressure: "Moderate; reimbursements are due at month end",
    notes: ["Managers compare amounts and categories across employees"],
  },
  data: {
    entity: "expense report",
    description: "One submission per trip or purchase, with receipts and line items.",
    attributes: ["employee", "amount", "category", "date", "status", "policy flags"],
  },
  constraints: {
    accessibility: "WCAG-AA",
    designSystem: "default",
    business: ["Rejections must include a reason"],
    technical: [],
  },
  ambiguities: [
    {
      field: "context.device",
      question: "Do managers ever approve expenses from their phone?",
      assumption: "Desktop-first; mobile is out of scope for this screen.",
    },
  ],
};
