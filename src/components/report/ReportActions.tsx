"use client";

import Link from "next/link";
import { useState } from "react";

export function ReportActions({
  readingId,
  reportId,
  pdfUrl,
}: {
  readingId: string;
  reportId: string;
  pdfUrl: string;
}) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function share() {
    setBusy("share");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/life-readings/${readingId}/share`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.error?.message ?? "A share link could not be created.");
        return;
      }
      const full = `${window.location.origin}${payload.data.url}`;
      setShareUrl(full);
      await navigator.clipboard?.writeText(full).catch(() => undefined);
      setMessage("Share link copied. It expires in 30 days and can be revoked by deleting the reading.");
    } catch {
      setError("A share link could not be created.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadPdf() {
    setBusy("pdf");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload?.error?.message ?? "The PDF could not be generated.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `aibaba-complete-life-reading-${reportId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("The PDF could not be downloaded.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="no-print">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={downloadPdf} disabled={busy !== null}>
          {busy === "pdf" ? "Rendering…" : "Download PDF"}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={share} disabled={busy !== null}>
          {busy === "share" ? "Creating…" : "Share report"}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
          Print
        </button>
        <Link href="/history" className="btn btn-ghost btn-sm">
          All readings
        </Link>
      </div>

      {shareUrl && (
        <div className="mt-3 flex flex-wrap gap-2">
          <input className="input flex-1 text-[0.75rem]" readOnly value={shareUrl} aria-label="Share link" />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              void navigator.clipboard?.writeText(shareUrl);
              setMessage("Link copied.");
            }}
          >
            Copy
          </button>
        </div>
      )}
      {message && <p className="mt-2 text-[0.74rem] text-[#4b3797]">{message}</p>}
      {error && (
        <p className="mt-2 rounded-lg border border-[#f2c9c1] bg-[#fff4f2] px-3 py-2 text-[0.74rem] text-[#9a3223]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
