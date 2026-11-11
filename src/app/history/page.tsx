import Link from "next/link";
import { pageUser } from "@/lib/auth/page";
import { listReadings } from "@/modules/life-reading/service";
import { summaryView } from "@/modules/life-reading/views";
import { HistoryList } from "@/components/history/HistoryList";

export const metadata = { title: "Your readings" };

export default async function HistoryPage() {
  const user = await pageUser("/history");
  const readings = await listReadings(user.id);
  const items = readings.map(summaryView);
  const active = items.filter((item) =>
    ["DRAFT", "AWAITING_CONSENT", "QUEUED", "PROCESSING", "READY"].includes(item.status),
  );
  const past = items.filter((item) => !active.some((entry) => entry.id === item.id));

  return (
    <div className="container-page py-12 md:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your archive</p>
          <h1 className="display mt-3 text-[clamp(2.6rem,5.6vw,4rem)] text-[#10152b]">Readings & reports.</h1>
          <p className="mt-3 max-w-xl text-[0.92rem] leading-relaxed text-[#5b5775]">
            Every reading is private to your account. Deleting one removes its report, calculations,
            photographs and follow-up conversations.
          </p>
        </div>
        <Link href="/new" className="btn btn-primary">
          New reading
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="card card-pad mt-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-[rgba(103,70,200,.25)] text-[#6746c8]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 5h16v14H4V5Z" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="mt-4 text-xl font-semibold text-[#10152b]">No readings yet.</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-[#6b6785]">
            Start with one method or all three. You can pause at any step and return to your draft here.
          </p>
          <Link href="/new" className="btn btn-primary mt-6">
            Begin your first reading
          </Link>
        </div>
      ) : (
        <div className="mt-10 space-y-10">
          {active.length > 0 && (
            <section>
              <h2 className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[#8a86a0]">In progress</h2>
              <div className="mt-4">
                <HistoryList items={active} />
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[#8a86a0]">Completed & closed</h2>
              <div className="mt-4">
                <HistoryList items={past} />
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
