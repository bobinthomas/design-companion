"use client";

export function InputPanel({
  value,
  onChange,
  onSubmit,
  placeholder,
  isLoading,
  submitLabel = "Generate",
  extraFields,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  isLoading: boolean;
  submitLabel?: string;
  extraFields?: React.ReactNode;
}) {
  const tooShort = value.trim().length > 0 && value.trim().length < 8;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!isLoading && value.trim().length >= 8) onSubmit();
      }}
      className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Describe the screen or flow…"}
        rows={4}
        className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500"
      />
      {extraFields}
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs text-amber-600 dark:text-amber-400">
          {tooShort ? "Add a bit more detail so I can give you something useful." : ""}
        </span>
        <button
          type="submit"
          disabled={isLoading || value.trim().length < 8}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isLoading ? "Working on it…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
