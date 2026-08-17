import { ModeCard } from "@/components/ModeCard";
import { EmptyState } from "@/components/EmptyState";

const ICON_CLASS = "h-5 w-5";

function LayoutIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
      <path d="M8 4h11a1 1 0 0 1 1 1v13" />
      <rect x="4" y="7" width="12" height="14" rx="1.5" />
      <path d="M8 12h4M8 16h4" />
    </svg>
  );
}

function FeedbackIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
      <path d="M21 12a8 8 0 1 1-3.2-6.4" />
      <path d="M21 5v5h-5" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-6 py-14">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Design Companion
        </h1>
        <p className="max-w-md text-base text-zinc-600 dark:text-zinc-400">
          Layout ideas, UI copy, and feedback summaries — fast.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <ModeCard
          href="/layout-mode"
          icon={<LayoutIcon />}
          title="Layout Brainstorm"
          description="Explore structure and hierarchy before you open Figma"
        />
        <ModeCard
          href="/copy-mode"
          icon={<CopyIcon />}
          title="UI Copy"
          description="First-draft microcopy that matches your product's voice"
        />
        <ModeCard
          href="/feedback-mode"
          icon={<FeedbackIcon />}
          title="Feedback Summary"
          description="Turn raw feedback into clear themes and priorities"
        />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          Recent sessions
        </h2>
        <EmptyState tip="Pick a mode above to get your first structured output in under 30 seconds." />
      </div>
    </main>
  );
}
