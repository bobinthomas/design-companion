"use client";

import { useEffect, useState } from "react";
import {
  clearCloudflareSettings,
  loadCloudflareSettings,
  saveCloudflareSettings,
} from "@/lib/ai/clientSettings";

interface QuotaResponse {
  available: boolean;
  limit?: number;
  remaining?: number;
}

const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500";

export function CloudflareSettings() {
  const [accountId, setAccountId] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [quota, setQuota] = useState<QuotaResponse | null>(null);

  useEffect(() => {
    const existing = loadCloudflareSettings();
    if (existing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage after mount, not derived render state
      setAccountId(existing.accountId);
      setApiToken(existing.apiToken);
      setSaved(true);
    }
    fetch("/api/decision-model/quota")
      .then((res) => (res.ok ? (res.json() as Promise<QuotaResponse>) : null))
      .then(setQuota)
      .catch(() => setQuota(null));
  }, []);

  function handleSave() {
    if (!accountId.trim() || !apiToken.trim()) return;
    saveCloudflareSettings({ accountId: accountId.trim(), apiToken: apiToken.trim() });
    setSaved(true);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }

  function handleClear() {
    clearCloudflareSettings();
    setAccountId("");
    setApiToken("");
    setSaved(false);
  }

  const status = saved
    ? "Jev runs on your own Cloudflare account — no daily limit."
    : quota?.available
      ? `Shared Jev access: ${quota.remaining} of ${quota.limit} free analyses left today.`
      : "Shared Jev access isn't available here — decisions use your LLM key or demo judgments.";

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Decision model (Jev)</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          UX judgments are answered by TypeSafe&apos;s Jev on Cloudflare Workers AI. Add your own
          Cloudflare account to skip the shared daily limit.
        </p>
        <p
          className={`mt-1 text-sm ${saved ? "text-emerald-700 dark:text-emerald-300" : "text-zinc-600 dark:text-zinc-400"}`}
        >
          {status}
        </p>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          Cloudflare account ID
        </span>
        <input
          type="text"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          placeholder="32-character account ID"
          autoComplete="off"
          spellCheck={false}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          API token <span className="normal-case text-zinc-400">(Workers AI read permission)</span>
        </span>
        <div className="flex items-center gap-2">
          <input
            type={showToken ? "text" : "password"}
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => setShowToken((v) => !v)}
            className="shrink-0 rounded-lg border border-zinc-200 px-3 py-2.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            {showToken ? "Hide" : "Show"}
          </button>
        </div>
        <a
          href="https://dash.cloudflare.com/profile/api-tokens"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-violet-700 underline decoration-violet-200 underline-offset-2 hover:decoration-violet-400 dark:text-violet-300 dark:decoration-violet-800"
        >
          Create a Cloudflare API token →
        </a>
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!accountId.trim() || !apiToken.trim()}
          className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {justSaved ? "Saved" : "Save"}
        </button>
        {saved ? (
          <button
            type="button"
            onClick={handleClear}
            className="text-sm text-zinc-500 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-700 dark:text-zinc-400 dark:decoration-zinc-700 dark:hover:text-zinc-200"
          >
            Remove saved account
          </button>
        ) : null}
      </div>
    </section>
  );
}
