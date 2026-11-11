import Link from "next/link";
import { pageUser } from "@/lib/auth/page";
import { listReadings } from "@/modules/life-reading/service";
import { summaryView } from "@/modules/life-reading/views";
import { loadWizard } from "@/modules/life-reading/wizard";
import { ReadingWizard } from "@/components/reading/ReadingWizard";
import { StartReadingButton } from "@/components/reading/StartReadingButton";

export const metadata = { title: "Begin your reading" };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ reading?: string; step?: string }>;
}) {
  const user = await pageUser("/onboarding");
  const { reading: readingId, step } = await searchParams;

  if (readingId) {
    const initial = await loadWizard(readingId, user.id);
    return (
      <div className="container-page py-10 md:py-16">
        <ReadingWizard initial={initial} step={step === "2" ? 2 : 1} />
      </div>
    );
  }

  const readings = await listReadings(user.id);
  const drafts = readings.filter((item) => ["DRAFT", "AWAITING_CONSENT"].includes(item.status));

  return (
    <div className="container-page py-14 md:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">The beginning</p>
        <h1 className="display mt-4 text-[clamp(2.6rem,6vw,4.4rem)] text-[#10152b]">
          A reading shaped
          <br />
          around <em className="text-[#6746c8]">your choices.</em>
        </h1>
        <p className="mt-5 max-w-xl text-[0.96rem] leading-relaxed text-[#5b5775]">
          Choose one tradition or all three. You will see exactly what each method can support, and you
          can stop before submitting at any point.
        </p>
        <div className="mt-8">
          <StartReadingButton />
        </div>

        {drafts.length > 0 && (
          <div className="mt-12">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[#8a86a0]">Continue a draft</p>
            <div className="mt-3 grid gap-2">
              {drafts.map((draft) => {
                const summary = summaryView(draft);
                return (
                  <Link
                    key={draft.id}
                    href={`/onboarding?reading=${draft.id}`}
                    className="flex items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-white/60 px-4 py-3 transition-colors hover:border-[rgba(103,70,200,.35)]"
                  >
                    <div>
                      <p className="text-[0.85rem] font-medium text-[#2f2c47]">
                        {summary.modules.length ? summary.modules.join(" · ") : "No methods chosen yet"}
                      </p>
                      <p className="mt-1 text-[0.7rem] text-[#8a86a0]">
                        Started {new Date(summary.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="badge badge-royal badge-plain">Draft</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
