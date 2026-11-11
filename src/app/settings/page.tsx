import { prisma } from "@/lib/database/prisma";
import { pageUser } from "@/lib/auth/page";
import { CONSENT_PURPOSES, type ConsentPurpose } from "@/lib/validation/reading";
import { SettingsClient } from "@/components/settings/SettingsClient";

export const metadata = { title: "Settings & privacy" };

export default async function SettingsPage() {
  const user = await pageUser("/settings");
  const [profile, consents, readings, reports, conversations] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId: user.id } }),
    prisma.consentRecord.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.completeReading.count({ where: { userId: user.id, status: { not: "DELETED" } } }),
    prisma.completeLifeReport.count({ where: { userId: user.id } }),
    prisma.aIConversation.count({ where: { userId: user.id } }),
  ]);

  const latest = new Map<string, { granted: boolean }>();
  for (const consent of consents) {
    if (!latest.has(consent.purpose)) latest.set(consent.purpose, { granted: consent.granted });
  }
  const consentState = Object.fromEntries(
    CONSENT_PURPOSES.map((purpose) => [purpose, latest.get(purpose)?.granted ?? false]),
  ) as Record<ConsentPurpose, boolean>;

  return (
    <div className="container-page py-12 md:py-16">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">Your space</p>
        <h1 className="display mt-3 text-[clamp(2.6rem,5.6vw,4rem)] text-[#10152b]">Settings & privacy.</h1>
        <p className="mt-3 max-w-xl text-[0.92rem] leading-relaxed text-[#5b5775]">
          Control how AIBABA addresses you, which processing you consent to, and what happens to your data.
        </p>
        <div className="mt-8">
          <SettingsClient
            email={user.email}
            initial={{
              displayName: profile?.displayName ?? user.displayName ?? user.name,
              country: profile?.country ?? "",
              timezone: profile?.timezone ?? "",
              preferredLanguage: user.preferredLanguage,
            }}
            consents={consentState}
            counts={{ readings, reports, conversations }}
          />
        </div>
      </div>
    </div>
  );
}
