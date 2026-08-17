"use client";

const PRESETS = ["Professional", "Playful", "Minimal", "Formal", "Warm"];

export function ToneSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        Tone
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              value === preset
                ? "border-violet-400 bg-violet-100 text-violet-700 dark:border-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
                : "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400"
            }`}
          >
            {preset}
          </button>
        ))}
        <input
          value={PRESETS.includes(value) ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="or describe your own tone…"
          className="min-w-[160px] flex-1 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-violet-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500"
        />
      </div>
    </div>
  );
}
