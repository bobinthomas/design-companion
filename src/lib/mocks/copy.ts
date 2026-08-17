import type { CopyOutput } from "@/lib/types";

export const mockCopyOutput: CopyOutput = {
  groups: [
    {
      group: "Home / Mode Selection",
      items: [
        {
          label: "Headline",
          value: "Design Companion",
          alternatives: ["Your design co-pilot"],
        },
        {
          label: "Subhead",
          value: "Layout ideas, UI copy, and feedback summaries — fast.",
          alternatives: ["Structure, copy, and clarity for early-stage design work."],
        },
        {
          label: "Card title — Layout",
          value: "Layout Brainstorm",
          alternatives: [],
        },
        {
          label: "Card title — Copy",
          value: "UI Copy",
          alternatives: [],
        },
        {
          label: "Card title — Feedback",
          value: "Feedback Summary",
          alternatives: [],
        },
        {
          label: "Card description — Layout",
          value: "Explore structure and hierarchy before you open Figma",
          alternatives: ["See layout options before you commit to one"],
        },
        {
          label: "Card description — Copy",
          value: "First-draft microcopy that matches your product's voice",
          alternatives: ["Copy drafts so you're not starting from a blank page"],
        },
        {
          label: "Card description — Feedback",
          value: "Turn raw feedback into clear themes and priorities",
          alternatives: ["Feedback, summarized and prioritized in minutes"],
        },
      ],
    },
    {
      group: "Empty / Loading states",
      items: [
        {
          label: "Empty input",
          value: "Describe the screen or flow…",
          alternatives: [],
        },
        {
          label: "Generating",
          value: "Working on it…",
          alternatives: ["Thinking it through…"],
        },
        {
          label: "No recent sessions",
          value: "Your recent work will appear here",
          alternatives: [],
        },
      ],
    },
    {
      group: "Error states",
      items: [
        {
          label: "Generic error",
          value: "Something went wrong. Try again in a moment.",
          alternatives: [],
        },
        {
          label: "Input too short",
          value: "Add a bit more detail so I can give you something useful.",
          alternatives: [],
        },
      ],
    },
    {
      group: "Success / Confirmation",
      items: [
        {
          label: "After generation",
          value: "Here's a starting point. Refine it with your team.",
          alternatives: ["This is a first draft — make it yours."],
        },
      ],
    },
  ],
  toneNotes: "Professional, calm, helpful, and slightly warm — hype and exclamation points avoided throughout.",
};
