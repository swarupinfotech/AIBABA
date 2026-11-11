"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

interface StatusPayload {
  reading: {
    id: string;
    status: string;
    modules: string[];
    reportId: string | null;
    errorCode: string | null;
  };
  components: { palm: string | null; numerology: string | null; astrology: string | null };
  jobs: Array<{ id: string; type: string; status: string; attempt: number; maxAttempts: number; errorCode: string | null }>;
}

const MODULE_LABEL: Record<string, string> = {
  PALMISTRY: "Palm observation",
  NUMEROLOGY: "Numerology",
  ASTROLOGY: "Vedic astrology",
};

const JOB_LABEL: Record<string, string> = {
  PALM_IMAGE_ANALYZE: "Assessing palm photographs",
  NUMEROLOGY_CALCULATE: "Calculating your numbers",
  ASTROLOGY_CALCULATE: "Computing the sidereal chart",
  LIFE_REPORT_SYNTHESIS: "Composing the combined report",
  PDF_GENERATE: "Rendering the PDF",
  ASSET_DELETE: "Removing an asset",
};

function statusBadge(status: string | null | undefined) {
  if (status === "COMPLETED") return "badge-success";
  if (status === "LIMITED") return "badge-warn";
  if (status === "FAILED") return "badge-danger";
  return "badge-muted";
}

function statusText(status: string | null | undefined) {
  if (status === "COMPLETED") return "Complete";
  if (status === "LIMITED") return "Limited";
  if (status === "FAILED") return "Unavailable";
  if (status === "PENDING") return "Queued";
  if (status === "VALIDATING") return "In progress";
  return "Waiting";
}

export function ProcessingWatcher({ readingId, initialState }: { readingId: string; initialState: StatusPayload }) {
  const [data, setData] = useState<StatusPayload>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const ticking = useRef(false);

  const refresh = useCallback(async (): Promise<StatusPayload | null> => {
    const response = await fetch(`/api/v1/life-readings/${readingId}/status`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok && mounted.current) {
      setData(payload.data);
      return payload.data as StatusPayload;
    }
    return null;
  }, [readingId]);

  const tick = useCallback(async () => {
    if (ticking.current) return;
    ticking.current = true;
    try {
      const response = await fetch(`/api/v1/life-readings/${readingId}/tick`, { method: "POST" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (mounted.current) setError(payload?.error?.message ?? null);
      }
    } catch {
      // The poller will retry; a transient tick failure is not fatal.
    } finally {
      ticking.current = false;
    }
  }, [readingId]);

  useEffect(() => {
    mounted.current = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function loop() {
      let latest = await refresh();
      if (!mounted.current) return;
      const current = latest?.reading.status ?? initialState.reading.status;
      if (!["COMPLETED", "PARTIALLY_COMPLETED", "FAILED", "CANCELLED", "DELETED"].includes(current)) {
        await tick();
        latest = await refresh();
      }
      if (mounted.current) timer = setTimeout(loop, 2400);
    }

    void loop();
    return () => {
      mounted.current = false;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingId]);

  const status = data.reading.status;
  const terminal = ["COMPLETED", "PARTIALLY_COMPLETED", "FAILED", "CANCELLED", "DELETED"].includes(status);
  const completed = ["COMPLETED", "PARTIALLY_COMPLETED"].includes(status);

  async function retry() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/life-readings/${readingId}/retry`, { method: "POST" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload?.error?.message ?? "The retry could not be started.");
        return;
      }
      await refresh();
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await fetch(`/api/v1/life-readings/${readingId}/cancel`, { method: "POST" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function skipPalm() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/life-readings/${readingId}/continue-without-palm`, { method: "POST" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload?.error?.message ?? "Could not continue without palmistry.");
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="panel-dark relative overflow-hidden rounded-[2rem] p-7 sm:p-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 82% 0%, rgba(214,174,99,.2), transparent 42%), radial-gradient(circle at 0% 100%, rgba(103,70,200,.42), transparent 46%)",
          }}
        />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.28em] text-[#d6ae63]">
                {terminal ? "Reading status" : "Preparing your reading"}
              </p>
              <h1 className="display mt-4 text-[clamp(2.2rem,5vw,3.6rem)] text-[#faf7f0]">
                {completed ? "The reading is ready." : status === "FAILED" ? "A component needs attention." : "Each method is reporting in."}
              </h1>
              <p className="mt-4 max-w-xl text-[0.9rem] leading-relaxed text-[rgba(250,247,240,.62)]">
                {completed
                  ? "Your report was composed only from validated component data. Open it to read the interpretation and download the PDF."
                  : status === "FAILED"
                    ? "No report was published from incomplete data. You can retry the failed work or review what completed."
                    : "Calculations and observations run separately, then a synthesis step brings them together. You can leave this page — processing continues in the background."}
              </p>
            </div>
            <StatusOrb status={status} />
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {data.reading.modules.map((module) => {
              const key = module === "PALMISTRY" ? "palm" : module === "NUMEROLOGY" ? "numerology" : "astrology";
              const componentStatus = data.components[key as keyof typeof data.components];
              return (
                <div key={module} className="rounded-2xl border border-[rgba(250,247,240,.14)] bg-[rgba(255,255,255,.04)] p-4">
                  <p className="text-[0.8rem] font-semibold text-[#faf7f0]">{MODULE_LABEL[module]}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className={`badge ${statusBadge(componentStatus)}`}>{statusText(componentStatus)}</span>
                    {!["COMPLETED", "LIMITED", "FAILED"].includes(componentStatus ?? "") && (
                      <span className="h-3 w-3 animate-pulse rounded-full bg-[#d6ae63]" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="card card-pad">
          <p className="eyebrow">Pipeline</p>
          <h2 className="mt-2 text-lg font-semibold text-[#10152b]">What is happening now</h2>
          <div className="mt-4 space-y-2">
            {data.jobs.length === 0 && <p className="text-sm text-[#8a86a0]">Waiting for the first job to be claimed…</p>}
            {data.jobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white/60 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-full text-[0.65rem] font-bold ${
                      job.status === "COMPLETED"
                        ? "bg-[#edf7ef] text-[#2c6b3f]"
                        : job.status === "RUNNING"
                          ? "bg-[rgba(103,70,200,.12)] text-[#6746c8]"
                          : job.status === "FAILED"
                            ? "bg-[#fff1ee] text-[#9a3223]"
                            : "bg-[rgba(34,32,90,.06)] text-[#6b6785]"
                    }`}
                  >
                    {job.status === "COMPLETED" ? "✓" : job.status === "FAILED" ? "!" : "·"}
                  </span>
                  <div>
                    <p className="text-[0.82rem] font-medium text-[#2f2c47]">{JOB_LABEL[job.type] ?? job.type}</p>
                    <p className="text-[0.66rem] text-[#8a86a0]">
                      {job.status.toLowerCase()} · attempt {job.attempt} of {job.maxAttempts}
                      {job.errorCode ? ` · ${job.errorCode}` : ""}
                    </p>
                  </div>
                </div>
                {job.status === "RUNNING" && <span className="h-2 w-2 animate-pulse rounded-full bg-[#6746c8]" />}
              </div>
            ))}
          </div>
        </div>

        <div className="stack">
          <div className="card card-pad">
            <p className="eyebrow">Good to know</p>
            <ul className="mt-3 space-y-2.5 text-[0.8rem] leading-relaxed text-[#5b5775]">
              <li>• Numbers are calculated deterministically; the language model cannot alter them.</li>
              <li>• A failed method is labelled, never replaced with invented content.</li>
              <li>• Photographs are processed privately and are never made public.</li>
            </ul>
          </div>

          <div className="card card-pad">
            <p className="eyebrow">Controls</p>
            <div className="mt-3 flex flex-col gap-2">
              {completed && (
                <Link href={`/report/${readingId}`} className="btn btn-primary">
                  Open your report
                </Link>
              )}
              {status === "FAILED" && (
                <button type="button" className="btn btn-primary" onClick={retry} disabled={busy}>
                  Retry failed work
                </button>
              )}
              {!terminal && (
                <button type="button" className="btn btn-secondary" onClick={cancel} disabled={busy}>
                  Cancel reading
                </button>
              )}
              {data.reading.modules.includes("PALMISTRY") &&
                ["LIMITED", "FAILED"].includes(data.components.palm ?? "") &&
                !completed && (
                  <button type="button" className="btn btn-secondary" onClick={skipPalm} disabled={busy}>
                    Continue without palmistry
                  </button>
                )}
              <Link href="/history" className="btn btn-ghost">
                Back to history
              </Link>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-[#f2c9c1] bg-[#fff4f2] px-4 py-3 text-[0.8rem] text-[#9a3223]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function StatusOrb({ status }: { status: string }) {
  if (status === "FAILED") {
    return (
      <span className="grid h-16 w-16 place-items-center rounded-full border border-[rgba(242,201,193,.4)] bg-[rgba(154,50,35,.18)] text-2xl text-[#f2c9c1]">
        !
      </span>
    );
  }
  if (["COMPLETED", "PARTIALLY_COMPLETED"].includes(status)) {
    return (
      <span className="grid h-16 w-16 place-items-center rounded-full border border-[rgba(198,227,205,.4)] bg-[rgba(44,107,63,.2)] text-2xl text-[#c6e3cd]">
        ✓
      </span>
    );
  }
  return (
    <span className="relative grid h-16 w-16 place-items-center rounded-full border border-[rgba(214,174,99,.4)]">
      <span className="absolute inset-1 animate-spin rounded-full border border-transparent border-t-[#d6ae63]" style={{ animationDuration: "2.4s" }} />
      <span className="h-2.5 w-2.5 rounded-full bg-[#d6ae63]" />
    </span>
  );
}
