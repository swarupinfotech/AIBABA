import { redirect } from "next/navigation";
import { getReadingOrThrow } from "@/modules/life-reading/service";
import { readingDetailView } from "@/modules/life-reading/views";
import type { WizardInitial } from "@/components/reading/ReadingWizard";

export async function loadWizard(readingId: string, userId: string): Promise<WizardInitial> {
  const reading = await getReadingOrThrow(readingId, userId);
  if (reading.status === "DELETED") redirect("/history");
  if (!["DRAFT", "AWAITING_CONSENT"].includes(reading.status)) {
    const terminal = ["COMPLETED", "PARTIALLY_COMPLETED", "READY"].includes(reading.status);
    redirect(terminal ? `/report/${reading.id}` : `/processing/${reading.id}`);
  }
  const detail = await readingDetailView(reading, userId);
  return {
    id: detail.id,
    status: detail.status,
    draft: detail.draft,
    assets: detail.assets,
  };
}
