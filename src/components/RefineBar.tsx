"use client";

export function RefineBar({
  value,
  onChange,
  onSubmit,
  isLoading,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!isLoading && value.trim()) onSubmit();
      }}
      className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white p-1.5 pl-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">Refine:</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. “make it more minimal”, “focus on mobile”, “shorter copy”"
        className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-50 dark:placeholder:text-zinc-600"
      />
      <button
        type="submit"
        disabled={isLoading || !value.trim()}
        className="shrink-0 rounded-full bg-zinc-100 px-4 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        {isLoading ? "Working on it…" : "Apply"}
      </button>
    </form>
  );
}
