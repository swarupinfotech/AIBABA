import Link from "next/link";
import { pageUser } from "@/lib/auth/page";
import { listReadings } from "@/modules/life-reading/service";
import { summaryView } from "@/modules/life-reading/views";
import { StartReadingButton } from "@/components/reading/StartReadingButton";

export const metadata = { title: "New reading" };

export default async function NewReadingPage() {
  const user = await pageUser("/new");
  const readings = await listReadings(user.id);
  const drafts = readings.filter((item) => ["DRAFT", "AWAITING_CONSENT"].includes(item.status));

  return (
    <div className="container-page py-14 md:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">A new chapter</p>
        <h1 className="display mt-4 text-[clamp(2.8rem,6.4vw,4.8rem)] text-[#10152b]">
          Begin a Complete
          <br />
          Life Reading.
        </h1>
        <p className="mt-5 max-w-xl text-[0.98rem] leading-relaxed text-[#5b5775]">
          Five short steps. Choose your methods, share only what is needed, and decide separately how
          your data may be used. Your draft stays private until you submit it.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <StartReadingButton />
          <Link href="/complete-life-reading" className="btn btn-secondary">
            What is included
          </Link>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {[
            ["~5 minutes", "to prepare the details"],
            ["3 methods", "choose one or all"],
            ["Full control", "pause, edit or delete"],
          ].map(([title, body]) => (
            <div key={title} className="rounded-xl border border-[var(--line)] bg-white/55 px-4 py-3.5">
              <p className="text-[0.82rem] font-semibold text-[#22205a]">{title}</p>
              <p className="mt-1 text-[0.72rem] text-[#8a86a0]">{body}</p>
            </div>
          ))}
        </div>

        {drafts.length > 0 && (
          <div className="mt-12">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[#8a86a0]">Unfinished drafts</p>
            <div className="mt-3 grid gap-2">
              {drafts.map((draft) => {
                const summary = summaryView(draft);
                return (
                  <div key={draft.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white/60 px-4 py-3">
                    <div>
                      <p className="text-[0.85rem] font-medium text-[#2f2c47]">
                        {summary.modules.length ? summary.modules.join(" · ") : "No methods chosen yet"}
                      </p>
                      <p className="mt-1 text-[0.7rem] text-[#8a86a0]">
                        Started {new Date(summary.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Link href={`/onboarding?reading=${draft.id}`} className="btn btn-secondary btn-sm">
                      Continue draft
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
