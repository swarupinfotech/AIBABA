"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CONSENT_LABELS, CONSENT_PURPOSES, type ConsentPurpose } from "@/lib/validation/reading";

export function SettingsClient({
  email,
  initial,
  consents: initialConsents,
  counts,
}: {
  email: string;
  initial: { displayName: string; country: string; timezone: string; preferredLanguage: string };
  consents: Record<ConsentPurpose, boolean>;
  counts: { readings: number; reports: number; conversations: number };
}) {
  const router = useRouter();
  const [profile, setProfile] = useState({
    displayName: initial.displayName,
    country: initial.country,
    timezone: initial.timezone,
    preferredLanguage: initial.preferredLanguage as "en" | "hi",
  });
  const [consents, setConsents] = useState(initialConsents);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setBusy("profile");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.error?.message ?? "Your profile could not be saved.");
        return;
      }
      setMessage("Profile saved.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function toggleConsent(purpose: ConsentPurpose, granted: boolean) {
    setBusy(purpose);
    setError(null);
    setMessage(null);
    const previous = consents[purpose];
    setConsents({ ...consents, [purpose]: granted });
    try {
      const response = await fetch("/api/v1/privacy/consents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose, granted }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setConsents({ ...consents, [purpose]: previous });
        setError(payload?.error?.message ?? "The consent could not be updated.");
        return;
      }
      setMessage(granted ? "Consent recorded." : "Consent withdrawn.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount() {
    setBusy("delete");
    setError(null);
    try {
      const response = await fetch("/api/v1/privacy/deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE", password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.error?.message ?? "The account could not be deleted.");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const locked: ConsentPurpose[] = ["PERSONAL_DATA_PROCESSING", "SAVE_HISTORY"];

  return (
    <div className="stack">
      {message && <p className="rounded-xl border border-[#c6e3cd] bg-[#edf7ef] px-4 py-3 text-[0.8rem] text-[#2c6b3f]">{message}</p>}
      {error && (
        <p className="rounded-xl border border-[#f2c9c1] bg-[#fff4f2] px-4 py-3 text-[0.8rem] text-[#9a3223]" role="alert">
          {error}
        </p>
      )}

      <section className="card card-pad">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Account</p>
            <h2 className="mt-2 text-xl font-semibold text-[#10152b]">Your profile</h2>
            <p className="mt-1 text-[0.8rem] text-[#6b6785]">Signed in as {email}</p>
          </div>
          <div className="flex gap-4 text-center">
            <div>
              <p className="font-serif text-2xl text-[#22205a]">{counts.readings}</p>
              <p className="text-[0.62rem] uppercase tracking-[0.1em] text-[#8a86a0]">Readings</p>
            </div>
            <div>
              <p className="font-serif text-2xl text-[#22205a]">{counts.reports}</p>
              <p className="text-[0.62rem] uppercase tracking-[0.1em] text-[#8a86a0]">Reports</p>
            </div>
            <div>
              <p className="font-serif text-2xl text-[#22205a]">{counts.conversations}</p>
              <p className="text-[0.62rem] uppercase tracking-[0.1em] text-[#8a86a0]">Chats</p>
            </div>
          </div>
        </div>

        <form onSubmit={saveProfile} className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="field">
            <label className="label" htmlFor="displayName">
              Preferred name
            </label>
            <input
              id="displayName"
              className="input"
              value={profile.displayName}
              maxLength={60}
              onChange={(event) => setProfile({ ...profile, displayName: event.target.value })}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="country">
              Country
            </label>
            <input
              id="country"
              className="input"
              value={profile.country}
              maxLength={120}
              onChange={(event) => setProfile({ ...profile, country: event.target.value })}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="timezone">
              Timezone
            </label>
            <input
              id="timezone"
              className="input"
              placeholder="Asia/Kolkata"
              value={profile.timezone}
              maxLength={80}
              onChange={(event) => setProfile({ ...profile, timezone: event.target.value })}
            />
            <p className="hint">IANA timezone, used for display and future features.</p>
          </div>
          <div className="field">
            <label className="label">Report language</label>
            <div className="flex gap-2 pt-1">
              {[
                { value: "en", label: "English" },
                { value: "hi", label: "हिन्दी" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`btn btn-sm ${profile.preferredLanguage === option.value ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setProfile({ ...profile, preferredLanguage: option.value as "en" | "hi" })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn btn-primary" disabled={busy !== null}>
              {busy === "profile" ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>
      </section>

      <section className="card card-pad">
        <p className="eyebrow">Consent</p>
        <h2 className="mt-2 text-xl font-semibold text-[#10152b]">Purpose by purpose</h2>
        <p className="mt-1 max-w-2xl text-[0.8rem] leading-relaxed text-[#6b6785]">
          You can withdraw optional consent at any time. Withdrawal stops future processing but does not
          erase data already included in a published report — delete the reading for that.
        </p>
        <div className="mt-5 grid gap-2">
          {CONSENT_PURPOSES.map((purpose) => {
            const isLocked = locked.includes(purpose);
            return (
              <div key={purpose} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white/60 px-4 py-3">
                <div>
                  <p className="text-[0.82rem] font-medium text-[#2f2c47]">{CONSENT_LABELS[purpose]}</p>
                  <p className="mt-0.5 text-[0.66rem] text-[#8a86a0]">
                    {isLocked ? "Required while your account is active" : "Optional"}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={consents[purpose]}
                  aria-label={CONSENT_LABELS[purpose]}
                  disabled={isLocked || busy !== null}
                  onClick={() => void toggleConsent(purpose, !consents[purpose])}
                  className={`relative h-7 w-12 rounded-full transition-colors ${consents[purpose] ? "bg-[#6746c8]" : "bg-[#d9d4e5]"}`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${consents[purpose] ? "left-6" : "left-1"}`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card card-pad">
        <p className="eyebrow">Your data</p>
        <h2 className="mt-2 text-xl font-semibold text-[#10152b]">Export, delete, leave.</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="/api/v1/privacy/export" className="btn btn-secondary">
            Download my data (JSON)
          </a>
          <a href="/history" className="btn btn-secondary">
            Delete individual readings
          </a>
          <button type="button" className="btn btn-danger" onClick={() => setDeleteOpen(true)}>
            Delete my account
          </button>
        </div>
        <p className="mt-3 max-w-2xl text-[0.72rem] leading-relaxed text-[#8a86a0]">
          Account deletion removes every reading, report, calculation, palm photograph, conversation and
          notification, then anonymises the account record. A minimal audit record is retained without
          personal content.
        </p>
      </section>

      {deleteOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(16,21,43,.55)] p-4 backdrop-blur-sm">
          <div className="card card-solid w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-[#10152b]">Delete your account?</h3>
            <p className="mt-2 text-[0.8rem] leading-relaxed text-[#6b6785]">
              This is immediate and cannot be undone. Type <strong>DELETE</strong> and enter your password to
              confirm.
            </p>
            <div className="mt-4 space-y-3">
              <input
                className="input"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="DELETE"
                aria-label="Type DELETE to confirm"
              />
              <input
                className="input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Your password"
                aria-label="Password"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={confirm !== "DELETE" || !password || busy === "delete"}
                onClick={() => void deleteAccount()}
              >
                {busy === "delete" ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
