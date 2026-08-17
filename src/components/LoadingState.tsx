export function LoadingState() {
  return (
    <div className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-200 py-16 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-violet-600 dark:border-zinc-700 dark:border-t-violet-400" />
      Working on it…
    </div>
  );
}
