import type { FeedbackOutput } from "@/lib/types";

export const mockFeedbackOutput: FeedbackOutput = {
  themes: [
    {
      name: "High value on Feedback Summarizer",
      strength: "strong-positive",
      evidence: [
        "\"Feedback summary saved me at least 45 minutes. Love the severity ratings.\"",
      ],
    },
    {
      name: "Layout quality is solid but needs more distinctiveness and easier mobile control",
      strength: "mixed",
      evidence: [
        "\"The layout suggestions were actually useful, but I wished I could ask for a mobile-only version more easily.\"",
        "\"Sometimes the layout ideas felt too similar to each other.\"",
      ],
    },
    {
      name: "Copy requires more tone control / less generic output",
      strength: "mixed",
      evidence: ["\"Copy was good but sometimes a bit generic. I had to tweak the tone a lot.\""],
    },
    {
      name: "Mode awareness & navigation",
      strength: "negative",
      evidence: ["\"I got confused which mode I was in after a few messages.\""],
    },
    {
      name: "Desire for persistence",
      strength: "mixed",
      evidence: ["\"Would be nice to save outputs or export to Notion.\""],
    },
  ],
  prioritizedIssues: [
    {
      priority: "P0",
      issue: "Mode context can get lost",
      severity: "Medium-High",
      recommendation: "Persistent mode indicator + clear \"Switch mode\" control",
    },
    {
      priority: "P1",
      issue: "Layout variations sometimes too similar",
      severity: "Medium",
      recommendation:
        "Explicitly generate more divergent directions + \"More distinct options\" button",
    },
    {
      priority: "P1",
      issue: "Copy tone control is weak",
      severity: "Medium",
      recommendation: "Add a tone selector (or free-text tone) + \"Make it more X\" quick actions",
    },
    {
      priority: "P2",
      issue: "No save/export",
      severity: "Medium",
      recommendation: "Simple \"Copy all\" now, future \"Save to library\"",
    },
  ],
  positiveSignals: [
    "Feedback summarizer is the strongest delight",
    "Home screen mode selection is clear",
    "Overall usefulness is recognized",
  ],
  nextSteps: [
    "Add persistent mode chip / header",
    "Improve layout divergence prompt",
    "Introduce lightweight tone controls for copy mode",
    "Prototype a minimal \"Save output\" action",
  ],
};

export const SAMPLE_FEEDBACK_INPUT = `"The layout suggestions were actually useful, but I wished I could ask for a mobile-only version more easily."
"Copy was good but sometimes a bit generic. I had to tweak the tone a lot."
"Feedback summary saved me at least 45 minutes. Love the severity ratings."
"I got confused which mode I was in after a few messages."
"Would be nice to save outputs or export to Notion."
"The three options on the home screen felt clear."
"Sometimes the layout ideas felt too similar to each other."`;
