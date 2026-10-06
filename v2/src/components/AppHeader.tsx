"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SETTINGS_CHANGED_EVENT, loadSettings } from "@/lib/ai/clientSettings";
import { PROVIDER_LABELS, type Provider } from "@/lib/ai/providers";
import { NAV_ITEMS, V1_URL } from "@/lib/nav";

export function AppHeader() {
  const pathname = usePathname();
  const [activeProvider, setActiveProvider] = useState<Provider | null>(null);

  useEffect(() => {
    const refresh = () => setActiveProvider(loadSettings()?.provider ?? null);
    refresh();
    window.addEventListener(SETTINGS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, refresh);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-black/80">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          Design Companion
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
            V2
          </span>
        </Link>

        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "font-medium text-violet-700 dark:text-violet-300"
                    : "text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 text-xs">
          <a
            href={V1_URL}
            className="text-zinc-400 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-600 dark:text-zinc-500 dark:decoration-zinc-700 dark:hover:text-zinc-300"
          >
            Open V1
          </a>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1 font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${activeProvider ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"}`}
            />
            {activeProvider ? `Live · ${PROVIDER_LABELS[activeProvider]}` : "Demo data"}
          </Link>
        </div>
      </div>
    </header>
  );
}
