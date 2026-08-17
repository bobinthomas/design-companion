export function EmptyState({ tip }: { tip: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-zinc-200 py-16 text-center dark:border-zinc-800">
      <p className="text-sm text-zinc-400 dark:text-zinc-500">Your recent work will appear here</p>
      <p className="max-w-sm text-xs text-zinc-400 dark:text-zinc-600">{tip}</p>
    </div>
  );
}
