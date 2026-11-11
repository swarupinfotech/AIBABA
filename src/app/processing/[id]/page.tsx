import { redirect } from "next/navigation";
import { pageUser } from "@/lib/auth/page";
import { getReadingOrThrow } from "@/modules/life-reading/service";
import { readingDetailView } from "@/modules/life-reading/views";
import { ProcessingWatcher } from "@/components/reading/ProcessingWatcher";

export const metadata = { title: "Preparing your reading" };

export default async function ProcessingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await pageUser(`/processing/${id}`);
  const reading = await getReadingOrThrow(id, user.id);

  if (["DRAFT", "AWAITING_CONSENT"].includes(reading.status)) redirect(`/onboarding?reading=${id}`);
  if (reading.status === "DELETED") redirect("/history");
  if (reading.reports[0] && ["COMPLETED", "PARTIALLY_COMPLETED"].includes(reading.status)) {
    redirect(`/report/${id}`);
  }

  const detail = await readingDetailView(reading, user.id);
  const initialState = {
    reading: {
      id: detail.id,
      status: detail.status,
      modules: detail.selectedModules,
      reportId: detail.report?.id ?? null,
      errorCode: detail.errorCode,
    },
    components: {
      palm: detail.components.palm?.status ?? null,
      numerology: detail.components.numerology?.status ?? null,
      astrology: detail.components.astrology?.status ?? null,
    },
    jobs: detail.jobs.map((job) => ({
      id: job.id,
      type: job.type,
      status: job.status,
      attempt: job.attemptCount,
      maxAttempts: job.maxAttempts,
      errorCode: job.errorCode,
    })),
  };

  return (
    <div className="container-page py-10 md:py-16">
      <ProcessingWatcher readingId={id} initialState={initialState} />
    </div>
  );
}
