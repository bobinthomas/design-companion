export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 py-10 text-center dark:border-rose-900 dark:bg-rose-950/40">
      <p className="text-sm text-rose-700 dark:text-rose-300">
        {message ?? "Something went wrong. Try again in a moment."}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full border border-rose-300 px-4 py-1.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900/40"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
