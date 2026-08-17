import Link from "next/link";

export function ModeCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-6 text-left transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg hover:shadow-violet-100 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-violet-800 dark:hover:shadow-none"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{description}</p>
      <span className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-violet-700 dark:text-violet-300">
        Start
        <span className="transition-transform group-hover:translate-x-0.5">→</span>
      </span>
    </Link>
  );
}
