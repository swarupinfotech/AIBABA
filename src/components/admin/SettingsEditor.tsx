"use client";

import { useState } from "react";

interface SettingEntry {
  key: string;
  value: Record<string, unknown>;
  updatedAt: string;
}

const LABELS: Record<string, string> = {
  ai: "AI provider",
  astrology: "Astrology engine",
  numerology: "Numerology engine",
  storage: "Private storage",
  reports: "Reports & sharing",
  features: "Feature flags",
  consent: "Consent policy",
  retention: "Retention policy",
  pdf: "PDF rendering",
};

export function SettingsEditor({ entries, canEdit }: { entries: SettingEntry[]; canEdit: boolean }) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(entries.map((entry) => [entry.key, JSON.stringify(entry.value, null, 2)])),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, { kind: "ok" | "error"; text: string }>>({});

  return (
    <div className="grid gap-4">
      {entries.length === 0 && <p className="text-[0.8rem] text-[#8a86a0]">No settings records found.</p>}
      {entries.map((entry) => {
        const message = messages[entry.key];
        return (
          <div key={entry.key} className="card card-pad">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-[#10152b]">{LABELS[entry.key] ?? entry.key}</h3>
                <p className="font-mono text-[0.64rem] text-[#8a86a0]">setting: {entry.key}</p>
              </div>
              <p className="text-[0.64rem] text-[#8a86a0]">
                updated {new Date(entry.updatedAt).toLocaleString()}
              </p>
            </div>
            <textarea
              className="textarea mt-3 min-h-40 font-mono text-[0.72rem]"
              value={drafts[entry.key] ?? ""}
              spellCheck={false}
              readOnly={!canEdit}
              aria-label={`${entry.key} setting JSON`}
              onChange={(event) => setDrafts((current) => ({ ...current, [entry.key]: event.target.value }))}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {canEdit ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={busy === entry.key}
                  onClick={async () => {
                    setBusy(entry.key);
                    setMessages((current) => ({ ...current, [entry.key]: { kind: "ok", text: "" } }));
                    let parsed: Record<string, unknown>;
                    try {
                      const value = JSON.parse(drafts[entry.key] ?? "{}");
                      if (typeof value !== "object" || value === null || Array.isArray(value)) {
                        throw new Error("Value must be a JSON object.");
                      }
                      parsed = value as Record<string, unknown>;
                    } catch (error) {
                      setBusy(null);
                      setMessages((current) => ({
                        ...current,
                        [entry.key]: {
                          kind: "error",
                          text: error instanceof Error ? error.message : "Invalid JSON.",
                        },
                      }));
                      return;
                    }
                    try {
                      const response = await fetch("/api/v1/admin/settings", {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ key: entry.key, value: parsed }),
                      });
                      const payload = await response.json().catch(() => ({}));
                      if (!response.ok) {
                        setMessages((current) => ({
                          ...current,
                          [entry.key]: { kind: "error", text: payload?.error?.message ?? "Save failed." },
                        }));
                        return;
                      }
                      setDrafts((current) => ({ ...current, [entry.key]: JSON.stringify(parsed, null, 2) }));
                      setMessages((current) => ({
                        ...current,
                        [entry.key]: { kind: "ok", text: "Saved. Changes apply to new jobs." },
                      }));
                    } catch {
                      setMessages((current) => ({
                        ...current,
                        [entry.key]: { kind: "error", text: "Network error. Please try again." },
                      }));
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  {busy === entry.key ? "Saving…" : "Save setting"}
                </button>
              ) : (
                <p className="text-[0.68rem] text-[#8a86a0]">Read-only. Operations admin access is required to edit.</p>
              )}
              {message?.text && (
                <p className={`text-[0.7rem] ${message.kind === "ok" ? "text-[#2f6b4f]" : "text-[#9a3223]"}`}>
                  {message.text}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
