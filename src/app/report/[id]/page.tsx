import Link from "next/link";
import { redirect } from "next/navigation";
import { pageUser } from "@/lib/auth/page";
import { getReadingOrThrow } from "@/modules/life-reading/service";
import { parseReport, reportView } from "@/modules/life-reading/views";
import { parseJson } from "@/lib/json";
import { toKundliCharts } from "@/components/astrology/chart-data";
import { ReportActions } from "@/components/report/ReportActions";
import { ReportDocumentView } from "@/components/report/ReportDocumentView";
import { ChatPanel } from "@/components/report/ChatPanel";

export const metadata = { title: "Your Complete Life Reading" };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await pageUser(`/report/${id}`);
  const reading = await getReadingOrThrow(id, user.id);

  if (reading.status === "DELETED") redirect("/history");
  if (["DRAFT", "AWAITING_CONSENT"].includes(reading.status)) redirect(`/onboarding?reading=${id}`);
  const latest = reading.reports[0];
  if (!latest) {
    if (["QUEUED", "PROCESSING", "READY"].includes(reading.status)) redirect(`/processing/${id}`);
    return (
      <div className="container-page py-20">
        <div className="card card-pad mx-auto max-w-xl text-center">
          <p className="eyebrow">No report yet</p>
          <h1 className="display mt-3 text-4xl text-[#10152b]">This reading has no published report.</h1>
          <p className="mt-3 text-sm text-[#6b6785]">
            No content is shown because no validated report was saved. You can retry the reading or return
            to your history.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Link href={`/processing/${id}`} className="btn btn-primary">
              Open reading status
            </Link>
            <Link href="/history" className="btn btn-secondary">
              History
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const report = reportView(latest);
  const { document } = parseReport(latest);
  // Only stored, validated calculation data is drawn. An unknown birth time
  // yields null here, so no chart is invented.
  const chart = toKundliCharts(parseJson<unknown>(reading.astrology?.chartData ?? null, null));
  if (!document) {
    return (
      <div className="container-page py-20">
        <div className="card card-pad mx-auto max-w-xl text-center">
          <h1 className="display text-4xl text-[#10152b]">The saved report could not be read.</h1>
          <p className="mt-3 text-sm text-[#6b6785]">
            The stored document failed validation. This is a data-integrity issue, not a new reading. Please
            contact support with reading reference {id.slice(0, 8)}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-8 md:py-12">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/history" className="text-[0.78rem] font-medium text-[#6b6785] hover:text-[#6746c8]">
          ← Your readings
        </Link>
        <span className="text-[0.68rem] text-[#8a86a0]">
          Report v{report.version} · {new Date(report.createdAt).toLocaleString()}
        </span>
      </div>

      <header className="mt-6 grid gap-6 border-b border-[var(--line)] pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="eyebrow">Complete Life Reading · {report.document?.language === "hi" ? "हिन्दी" : "English"}</p>
          <h1 className="display mt-4 text-[clamp(2.6rem,6vw,4.8rem)] text-[#10152b]">
            {document.preferredName}
          </h1>
          <p className="mt-3 max-w-2xl text-[0.92rem] leading-relaxed text-[#5b5775]">
            A considered reading across {document.methods.filter((method) => method.status !== "NOT_SELECTED").length}{" "}
            method{document.methods.filter((method) => method.status !== "NOT_SELECTED").length === 1 ? "" : "s"}, with each
            tradition kept separate and its limits stated.
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
        </div>
        <ReportActions readingId={id} reportId={latest.id} pdfUrl={report.pdfUrl} />
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[240px_1fr]">
        <aside className="no-print hidden lg:block">
          <div className="sticky top-24">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[#8a86a0]">Contents</p>
            <nav className="mt-3 space-y-0.5 border-l border-[var(--line-strong)]">
              {document.sections.map((section, index) => (
                <a
                  key={`${section.id}-${index}`}
                  href={`#section-${section.id || index}`}
                  className="block border-l-2 border-transparent py-1.5 pl-3 text-[0.74rem] leading-snug text-[#6b6785] transition-colors hover:border-[#6746c8] hover:text-[#22205a]"
                >
                  <span className="mr-1.5 font-serif text-[#b0a8c8]">{String(index + 1).padStart(2, "0")}</span>
                  {section.title}
                </a>
              ))}
            </nav>
            <div className="mt-6 rounded-xl border border-[var(--line)] bg-white/60 p-3">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[#8a86a0]">Reading reference</p>
              <p className="mt-1 font-mono text-[0.68rem] text-[#4b4866]">{id.slice(0, 12)}</p>
              <p className="mt-2 text-[0.66rem] leading-relaxed text-[#8a86a0]">
                {report.aiModel}
                <br />
                {report.promptVersion}
              </p>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <ReportDocumentView document={document} chart={chart} />
        </div>
      </div>

      <div className="mt-12">
        <ChatPanel readingId={id} />
      </div>

      <div className="no-print mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white/50 px-5 py-4">
        <p className="text-[0.74rem] text-[#6b6785]">
          You can delete this report, its photographs, calculations and conversations from Settings.
        </p>
        <Link href="/settings" className="btn btn-ghost btn-sm">
          Privacy & deletion
        </Link>
      </div>
    </div>
  );
}
