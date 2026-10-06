import type { UXStateInput } from "@/lib/schemas";

/**
 * Second golden scenario, chosen to exercise different knowledge than the
 * expense dashboard: consumer, mobile-first, payment, plan comparison,
 * sign-up and formatted input.
 */
export const SUBSCRIPTION_SIGNUP_BRIEF =
  "Design the sign-up and checkout flow for a meal-kit subscription app, mostly used on phones.";

export const subscriptionSignupState: UXStateInput = {
  brief: SUBSCRIPTION_SIGNUP_BRIEF,
  product: "Meal-kit subscription",
  summary:
    "New customers choose a plan, sign up and subscribe with a credit card in one checkout flow, mostly on the mobile app.",
  user: {
    role: "Prospective customer",
    expertise: "novice",
    audience: "consumer",
    description: "Busy households trying the service for the first time, often on the go.",
  },
  goal: {
    primary: "Subscribe to a meal-kit plan",
    secondary: ["Choose a plan", "Create an account", "Enter delivery details"],
    successCriteria: ["Checkout completed in under three minutes", "Few abandoned checkouts"],
  },
  tasks: [
    { name: "Choose a plan by comparing plans", kind: "primary", frequency: "rare" },
    { name: "Sign up for an account", kind: "supporting", frequency: "rare" },
    { name: "Fill in delivery details and pay", kind: "supporting", frequency: "rare" },
  ],
  actions: [
    { name: "Subscribe", description: "Start a paid subscription with a credit card." },
    { name: "Apply promo code", description: "Apply a discount code before paying." },
  ],
  context: {
    device: "mobile",
    frequency: "rare",
    environment: "On the go, often one-handed",
    dataVolume: "Three or four plans",
    timePressure: "Low",
    notes: ["Checkout happens in steps: plan, account, delivery, payment"],
  },
  data: {
    entity: "subscription plan",
    description: "A plan defines meals per week, servings and price.",
    attributes: ["meals per week", "servings", "price per serving"],
  },
  constraints: {
    accessibility: "WCAG-AA",
    designSystem: "default",
    business: ["Show the total price before payment"],
    technical: [],
  },
  ambiguities: [],
};
