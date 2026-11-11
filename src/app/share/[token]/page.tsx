import Link from "next/link";
import { prisma } from "@/lib/database/prisma";
import { sha256 } from "@/lib/security/crypto";
import { isExpired } from "@/lib/datetime";
import { parseReport } from "@/modules/life-reading/views";
import { ReportDocumentView } from "@/components/report/ReportDocumentView";

export const metadata = {
  title: "Shared Complete Life Reading",
  robots: { index: false, follow: false },
};

export default async function SharedReadingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await prisma.reportShare.findUnique({ where: { tokenHash: sha256(token) } });

  if (!share || share.revokedAt || isExpired(share.expiresAt) || share.scope !== "REPORT_VIEW") {
    return (
      <div className="container-page py-20">
        <div className="card card-pad mx-auto max-w-lg text-center">
          <p className="eyebrow">Shared link</p>
          <h1 className="display mt-3 text-4xl text-[#10152b]">This link is no longer available.</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#6b6785]">
            Shared readings expire automatically and can be revoked by their owner. Ask the person who
            shared it for a fresh link, or start your own reading.
          </p>
          <Link href="/" className="btn btn-primary mt-6">
            Return home
          </Link>
        </div>
      </div>
    );
  }

  const report = await prisma.completeLifeReport.findFirst({
    where: { readingId: share.readingId, userId: share.userId, ...(share.reportId ? { id: share.reportId } : {}) },
    orderBy: { version: "desc" },
  });
  const reportData = parseReport(report);

  if (!report || !reportData.document) {
    return (
      <div className="container-page py-20">
        <div className="card card-pad mx-auto max-w-lg text-center">
          <p className="eyebrow">Shared link</p>
          <h1 className="display mt-3 text-4xl text-[#10152b]">The shared report is unavailable.</h1>
          <p className="mt-3 text-sm text-[#6b6785]">
            The report may have been deleted by its owner, or the saved document could not be validated.
          </p>
          <Link href="/" className="btn btn-primary mt-6">
            Return home
          </Link>
        </div>
      </div>
    );
  }

  await prisma.reportShare.update({ where: { id: share.id }, data: { viewCount: { increment: 1 } } });
  const document = reportData.document;

  return (
    <div className="container-page py-8 md:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="badge badge-royal badge-plain">Shared reading · read only</span>
        <span className="text-[0.68rem] text-[#8a86a0]">
          Expires {new Date(share.expiresAt).toLocaleDateString()}
        </span>
      </div>

      <header className="mt-6 border-b border-[var(--line)] pb-8">
        <p className="eyebrow">AIBABA · Complete Life Reading</p>
        <h1 className="display mt-4 text-[clamp(2.4rem,5.5vw,4.4rem)] text-[#10152b]">{document.preferredName}</h1>
        <p className="mt-3 max-w-2xl text-[0.92rem] leading-relaxed text-[#5b5775]">
          A reading shared by its owner across{" "}
          {document.methods.filter((method) => method.status !== "NOT_SELECTED").length} method
          {document.methods.filter((method) => method.status !== "NOT_SELECTED").length === 1 ? "" : "s"}. Each
          tradition is kept separate and its limits are stated.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {document.methods
            .filter((method) => method.status !== "NOT_SELECTED")
            .map((method) => (
              <span
                key={method.module}
                className={`badge ${
                  method.status === "COMPLETED"
                    ? "badge-success"
                    : method.status === "LIMITED"
                      ? "badge-warn"
                      : method.status === "UNAVAILABLE"
                        ? "badge-danger"
                        : "badge-muted"
                }`}
              >
                {method.module} · {method.status}
              </span>
            ))}
        </div>
      </header>

      <div className="mt-10">
        <ReportDocumentView document={document} />
      </div>

      <div className="mt-12 rounded-2xl border border-[var(--line)] bg-white/60 p-6 text-center">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[#8a86a0]">Your own reading</p>
        <p className="mx-auto mt-2 max-w-lg text-[0.84rem] leading-relaxed text-[#5b5775]">
          This is a personal reflection shared for a limited time. Create your own Complete Life Reading
          with separate consents, transparent calculations and full deletion controls.
        </p>
        <Link href="/register" className="btn btn-primary mt-5">
          Create your account
        </Link>
      </div>
    </div>
  );
}
