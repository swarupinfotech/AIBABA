import { redirect } from "next/navigation";
import { pageUser } from "@/lib/auth/page";
import { loadWizard } from "@/modules/life-reading/wizard";
import { ReadingWizard } from "@/components/reading/ReadingWizard";

export const metadata = { title: "Numerology" };

export default async function NumerologyStepPage({
  searchParams,
}: {
  searchParams: Promise<{ reading?: string }>;
}) {
  const user = await pageUser("/numerology");
  const { reading } = await searchParams;
  if (!reading) redirect("/onboarding");
  const initial = await loadWizard(reading, user.id);
  return (
    <div className="container-page py-10 md:py-16">
      <ReadingWizard initial={initial} step={3} />
    </div>
  );
}
