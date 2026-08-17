"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SETTINGS_CHANGED_EVENT, loadSettings } from "@/lib/clientSettings";
import { PROVIDER_LABELS, type Provider } from "@/lib/providers";

const MODES = [
  { href: "/layout-mode", label: "Layout Brainstorm" },
  { href: "/copy-mode", label: "UI Copy" },
  { href: "/feedback-mode", label: "Feedback Summary" },
] as const;

export function ModeHeader() {
  const pathname = usePathname();
  const currentMode = MODES.find((m) => m.href === pathname);
  const [activeProvider, setActiveProvider] = useState<Provider | null>(null);

  useEffect(() => {
    const refresh = () => setActiveProvider(loadSettings()?.provider ?? null);
    refresh();
    window.addEventListener(SETTINGS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, refresh);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-black/80">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Design Companion
        </Link>

        <div className="flex items-center gap-3 text-sm">
          {currentMode ? (
            <nav className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                {currentMode.label}
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
              {MODES.filter((m) => m.href !== currentMode.href).map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  className="text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  {m.label}
                </Link>
              ))}
              <Link
                href="/"
                className="text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                Home
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
            </nav>
          ) : (
            <span className="text-zinc-500 dark:text-zinc-400">Your AI design co-pilot</span>
          )}

          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
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
