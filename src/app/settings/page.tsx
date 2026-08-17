"use client";

import { useEffect, useState } from "react";
import {
  PROVIDERS,
  PROVIDER_CONSOLE_URLS,
  PROVIDER_DEFAULT_MODELS,
  PROVIDER_KEY_PLACEHOLDERS,
  PROVIDER_LABELS,
  type Provider,
} from "@/lib/providers";
import { clearSettings, loadSettings, saveSettings } from "@/lib/clientSettings";

export default function SettingsPage() {
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savedProvider, setSavedProvider] = useState<Provider | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    const existing = loadSettings();
    if (existing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage after mount, not derived render state
      setProvider(existing.provider);
      setApiKey(existing.apiKey);
      setModel(existing.model ?? "");
      setSavedProvider(existing.provider);
    }
  }, []);

  function handleSave() {
    if (!apiKey.trim()) return;
    saveSettings({ provider, apiKey: apiKey.trim(), model: model.trim() || undefined });
    setSavedProvider(provider);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }

  function handleClear() {
    clearSettings();
    setApiKey("");
    setModel("");
    setSavedProvider(null);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Settings</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Add your own API key to turn on live generation for every mode.
        </p>
      </div>

      <div
        className={`rounded-2xl border p-4 text-sm ${
          savedProvider
            ? "border-emerald-200 bg-emerald-50/60 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
            : "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
        }`}
      >
        {savedProvider
          ? `Live generation is on, using ${PROVIDER_LABELS[savedProvider]}.`
          : "No key saved — every mode is running on demo data."}
      </div>

      <div className="flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Provider
          </span>
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProvider(p)}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  provider === p
                    ? "border-violet-400 bg-violet-100 text-violet-700 dark:border-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
                    : "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400"
                }`}
              >
                {PROVIDER_LABELS[p]}
              </button>
            ))}
          </div>
          <a
            href={PROVIDER_CONSOLE_URLS[provider]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-violet-700 underline decoration-violet-200 underline-offset-2 hover:decoration-violet-400 dark:text-violet-300 dark:decoration-violet-800"
          >
            Get an API key from {PROVIDER_LABELS[provider]} →
          </a>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            API key
          </span>
          <div className="flex items-center gap-2">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={PROVIDER_KEY_PLACEHOLDERS[provider]}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="shrink-0 rounded-lg border border-zinc-200 px-3 py-2.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Model <span className="normal-case text-zinc-400">(optional override)</span>
          </span>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={PROVIDER_DEFAULT_MODELS[provider]}
            spellCheck={false}
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500"
          />
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            Leave blank to use {PROVIDER_DEFAULT_MODELS[provider]}. If that model ever gets
            retired, this is where you&apos;d point to its replacement.
          </span>
        </label>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {justSaved ? "Saved" : "Save"}
          </button>
          {savedProvider ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-sm text-zinc-500 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-700 dark:text-zinc-400 dark:decoration-zinc-700 dark:hover:text-zinc-200"
            >
              Remove saved key
            </button>
          ) : null}
        </div>
      </div>

      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        Your key is stored only in this browser&apos;s local storage. It&apos;s sent directly with each
        generation request and is never saved on our server or logged anywhere. Clearing your
        browser data removes it.
      </p>
    </main>
  );
}
