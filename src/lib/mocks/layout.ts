import type { LayoutOutput } from "@/lib/types";

export const mockLayoutOutput: LayoutOutput = {
  directions: [
    {
      title: "Card-based Mode Selector",
      recommended: true,
      hierarchy: [
        "Logo + short tagline",
        "Three mode cards (Layout, Copy, Feedback)",
        "Recent sessions (collapsed)",
        "Light settings",
      ],
      sections: [
        {
          name: "Header",
          purpose: "Simple logo + short tagline (\"Your AI design co-pilot\")",
        },
        {
          name: "Mode cards",
          purpose:
            "Three large tappable cards — Layout Brainstorm, UI Copy Generator, Feedback Summarizer — each with icon, title, one-sentence description, and a subtle \"Start →\"",
        },
        {
          name: "Recent sessions",
          purpose: "Collapsed by default; gives returning users a quick re-entry point",
        },
        {
          name: "Empty state",
          purpose: "Short onboarding tip shown under the cards for new users",
        },
      ],
      interactionPatterns: [
        "Tap/click a card to enter that mode",
        "Cards stack vertically on mobile, sit side-by-side on desktop",
      ],
      mobileNotes: ["Cards stack vertically for a single-column, thumb-friendly layout"],
      desktopNotes: ["Cards sit side-by-side to make all three options visible at once"],
    },
    {
      title: "Conversational First",
      hierarchy: [
        "Large prompt input",
        "Quick-action chips (Layout / Copy / Feedback)",
        "Chat + structured output panel once a mode is chosen",
      ],
      sections: [
        {
          name: "Prompt input",
          purpose: "\"What do you need help with today?\" — free-form entry point",
        },
        {
          name: "Quick-action chips",
          purpose: "Layout • Copy • Feedback — lets users skip straight to a mode",
        },
        {
          name: "Focused chat panel",
          purpose:
            "Once a mode is chosen, the interface transforms into a focused chat + structured output panel",
        },
      ],
      interactionPatterns: [
        "Type freely or tap a chip to jump into a mode",
        "Interface transitions from open-ended to focused once a mode is set",
      ],
      mobileNotes: ["Prompt input and chips remain full-width and thumb-reachable"],
      desktopNotes: ["Chat and structured output panel can sit side-by-side"],
    },
  ],
  assumptions: [
    "Users prefer speed over exploration on first visit",
    "Mobile usage will be significant",
  ],
};
