"use client";

import { useRef, useState } from "react";
import type { ImageQuality } from "@/services/image-analysis/validate";

export interface UploadedAsset {
  id: string;
  assetType: string;
  status: string;
  previewUrl: string;
  width: number | null;
  height: number | null;
  quality: ImageQuality | null;
}

interface Props {
  readingId: string;
  assets: UploadedAsset[];
  onChange: (assets: UploadedAsset[]) => void;
}

const SIDES = [
  { type: "PALM_LEFT", label: "Left palm", hint: "Palm up, fingers relaxed and slightly apart." },
  { type: "PALM_RIGHT", label: "Right palm", hint: "Even light, no filter, whole palm inside the frame." },
] as const;

export function PalmUploader({ readingId, assets, onChange }: Props) {
  const [busySide, setBusySide] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function upload(assetType: string, file: File) {
    setError(null);
    setMessage(null);
    setBusySide(assetType);
    try {
      const presign = await fetch("/api/v1/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readingId,
          assetType,
          filename: file.name,
          mimeType: file.type,
          fileSize: file.size,
        }),
      });
      const presignPayload = await presign.json().catch(() => ({}));
      if (!presign.ok) {
        setError(presignPayload?.error?.message ?? "The upload could not be prepared.");
        return;
      }

      const ticket = presignPayload.data as {
        assetId: string;
        uploadToken: string;
        expires: number;
        mode: "local" | "s3";
        uploadUrl: string;
      };

      if (ticket.mode === "s3") {
        const put = await fetch(ticket.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!put.ok) {
          setError("The private storage upload failed. Please try again.");
          return;
        }
        const form = new FormData();
        form.set("assetId", ticket.assetId);
        form.set("expires", String(ticket.expires));
        form.set("token", ticket.uploadToken);
        const complete = await fetch("/api/v1/uploads/complete", { method: "POST", body: form });
        await handleComplete(complete, assetType);
      } else {
        const form = new FormData();
        form.set("assetId", ticket.assetId);
        form.set("expires", String(ticket.expires));
        form.set("token", ticket.uploadToken);
        form.set("file", file);
        const complete = await fetch("/api/v1/uploads/complete", { method: "POST", body: form });
        await handleComplete(complete, assetType);
      }
    } catch {
      setError("The photograph could not be uploaded. Please try again.");
    } finally {
      setBusySide(null);
    }
  }

  async function handleComplete(response: Response, assetType: string) {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload?.error?.message ?? "The photograph could not be validated.");
      return;
    }
    const data = payload.data as {
      id: string;
      assetType: string;
      status: string;
      width: number;
      height: number;
      quality: ImageQuality;
      previewUrl: string;
    };
    const next: UploadedAsset = {
      id: data.id,
      assetType: data.assetType,
      status: data.status,
      previewUrl: data.previewUrl,
      width: data.width,
      height: data.height,
      quality: data.quality,
    };
    onChange([...assets.filter((asset) => asset.assetType !== assetType), next]);
    setMessage(
      data.status === "VALIDATED"
        ? "Photograph accepted. The palm area passed the quality check."
        : "The photograph was uploaded but did not pass every quality check. Retake it for a better chance of a reliable observation.",
    );
  }

  async function remove(id: string) {
    setError(null);
    setBusySide("delete");
    try {
      const response = await fetch(`/api/v1/uploads/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload?.error?.message ?? "The photograph could not be removed.");
        return;
      }
      onChange(assets.filter((asset) => asset.id !== id));
    } finally {
      setBusySide(null);
    }
  }

  return (
    <div className="stack">
      <div className="grid gap-4 sm:grid-cols-2">
        {SIDES.map((side) => {
          const asset = assets.find((item) => item.assetType === side.type);
          const busy = busySide === side.type;
          return (
            <div key={side.type} className="overflow-hidden rounded-2xl border border-[var(--line-strong)] bg-white/70">
              <div className="relative aspect-[4/3] bg-[#f3eee2]">
                {asset ? (
                  // Signed, private URL. Plain img keeps the query signature intact.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.previewUrl}
                    alt={`${side.label} photograph`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                    <span className="grid h-11 w-11 place-items-center rounded-full border border-[rgba(103,70,200,.25)] text-[#6746c8]">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M4 7h3l2-3h6l2 3h3v12H4V7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                        <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                    </span>
                    <p className="text-[0.8rem] font-semibold text-[#3b3854]">{side.label}</p>
                    <p className="text-[0.7rem] leading-relaxed text-[#8a86a0]">{side.hint}</p>
                  </div>
                )}
                {busy && (
                  <div className="absolute inset-0 grid place-items-center bg-[rgba(16,21,43,.55)]">
                    <span className="text-[0.78rem] font-medium text-white">Validating…</span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="text-[0.78rem] font-semibold text-[#22205a]">{side.label}</p>
                  {asset ? (
                    <span className={`badge ${asset.status === "VALIDATED" ? "badge-success" : "badge-warn"}`}>
                      {asset.status === "VALIDATED" ? "Quality passed" : "Retake advised"}
                    </span>
                  ) : (
                    <p className="text-[0.68rem] text-[#8a86a0]">JPEG, PNG or WebP · up to 8 MB</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {asset && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busySide !== null}
                      onClick={() => remove(asset.id)}
                    >
                      Remove
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busySide !== null}
                    onClick={() => inputs.current[side.type]?.click()}
                  >
                    {asset ? "Replace" : "Upload"}
                  </button>
                  <input
                    ref={(element) => {
                      inputs.current[side.type] = element;
                    }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void upload(side.type, file);
                      event.target.value = "";
                    }}
                  />
                </div>
              </div>
              {asset?.quality && asset.quality.issues.length > 0 && (
                <ul className="border-t border-[var(--line)] bg-[#fdf9ef] px-4 py-2.5 text-[0.7rem] leading-relaxed text-[#8a6420]">
                  {asset.quality.issues.slice(0, 4).map((issue) => (
                    <li key={issue.code}>• {issue.message}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      {message && <p className="text-[0.78rem] text-[#4b3797]">{message}</p>}
      {error && (
        <p className="rounded-xl border border-[#f2c9c1] bg-[#fff4f2] px-4 py-3 text-[0.8rem] text-[#9a3223]" role="alert">
          {error}
        </p>
      )}
      <p className="hint">
        Photographs are re-encoded to remove metadata, stored privately and served through short-lived
        signed links. Only you and the processing pipeline can access them.
      </p>
    </div>
  );
}
