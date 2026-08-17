const TONES = {
  neutral: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  accent: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  positive: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  negative: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
} as const;

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONES;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
