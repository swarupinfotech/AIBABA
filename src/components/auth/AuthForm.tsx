"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AuthForm({ mode, redirectTo }: { mode: "login" | "register"; redirectTo?: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", acceptTerms: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";
  const safeRedirect = redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/new";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isRegister
            ? { name: form.name, email: form.email, password: form.password, acceptTerms: form.acceptTerms }
            : { email: form.email, password: form.password },
        ),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.error?.message ?? "Something went wrong. Please try again.");
        return;
      }
      router.push(safeRedirect);
      router.refresh();
    } catch {
      setError("The network did not respond. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="stack">
      {isRegister && (
        <div className="field">
          <label className="label" htmlFor="name">
            Your name
          </label>
          <input
            id="name"
            className="input"
            autoComplete="name"
            required
            minLength={2}
            maxLength={120}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Aarav Sharma"
          />
        </div>
      )}

      <div className="field">
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="input"
          autoComplete="email"
          required
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          placeholder="you@example.com"
        />
      </div>

      <div className="field">
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          className="input"
          autoComplete={isRegister ? "new-password" : "current-password"}
          required
          minLength={isRegister ? 10 : 1}
          maxLength={200}
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          placeholder={isRegister ? "At least 10 characters" : "Your password"}
        />
        {isRegister && <p className="hint">Use at least 10 characters. A passphrase is easier to remember.</p>}
      </div>

      {isRegister && (
        <label className="check">
          <input
            type="checkbox"
            checked={form.acceptTerms}
            onChange={(event) => setForm({ ...form, acceptTerms: event.target.checked })}
            required
          />
          <span className="text-[0.82rem] leading-relaxed text-[#4b4866]">
            I agree to the{" "}
            <Link href="/terms" className="font-semibold text-[#6746c8] underline underline-offset-2">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-semibold text-[#6746c8] underline underline-offset-2">
              privacy policy
            </Link>
            . I understand this is a traditional reflection, not medical, legal or financial advice.
          </span>
        </label>
      )}

      {error && (
        <div className="rounded-xl border border-[#f2c9c1] bg-[#fff4f2] px-4 py-3 text-[0.82rem] text-[#9a3223]" role="alert">
          {error}
        </div>
      )}

      <button type="submit" className="btn btn-primary w-full" disabled={busy}>
        {busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
      </button>

      <p className="text-center text-[0.8rem] text-[#6b6785]">
        {isRegister ? "Already have an account? " : "New to AIBABA? "}
        <Link href={isRegister ? "/login" : "/register"} className="font-semibold text-[#6746c8]">
          {isRegister ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
