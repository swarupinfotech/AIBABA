import { prisma } from "@/lib/database/prisma";
import { jsonOk } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireUser } from "@/lib/auth/session";
import { parseDraft } from "@/modules/life-reading/service";
import { parseReport, summaryView } from "@/modules/life-reading/views";
import { audit } from "@/lib/audit";

export async function GET(request: Request) {
  return runApi(null, async () => {
    const user = await requireUser();
    limit(request, "privacy:export", 3, 60 * 60_000);

    const [account, profile, readings, consents, conversations] = await Promise.all([
      prisma.user.findUnique({ where: { id: user.id } }),
      prisma.userProfile.findUnique({ where: { userId: user.id } }),
      prisma.completeReading.findMany({
        where: { userId: user.id },
        include: { reports: { orderBy: { version: "desc" } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.consentRecord.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
      prisma.aIConversation.findMany({
        where: { userId: user.id },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      }),
    ]);

    await audit({
      actorUserId: user.id,
      action: "ACCOUNT_DATA_EXPORTED",
      resourceType: "User",
      resourceId: user.id,
    });

    return jsonOk(
      {
        exportedAt: new Date().toISOString(),
        formatVersion: 1,
        account: account
          ? {
              id: account.id,
              email: account.email,
              name: account.name,
              createdAt: account.createdAt.toISOString(),
              preferredLanguage: account.preferredLanguage,
            }
          : null,
        profile,
        readings: readings.map((reading) => ({
          ...summaryView(reading),
          draft: parseDraft(reading),
          reports: reading.reports.map((report) => ({
            id: report.id,
            version: report.version,
            createdAt: report.createdAt.toISOString(),
            document: parseReport(report).document,
            metadata: parseReport(report).metadata,
          })),
        })),
        consents: consents.map((consent) => ({
          purpose: consent.purpose,
          granted: consent.granted,
          version: consent.consentVersion,
          readingId: consent.readingId,
          grantedAt: consent.grantedAt?.toISOString() ?? null,
          withdrawnAt: consent.withdrawnAt?.toISOString() ?? null,
        })),
        conversations: conversations.map((conversation) => ({
          id: conversation.id,
          readingId: conversation.readingId,
          title: conversation.title,
          messages: conversation.messages.map((message) => ({
            role: message.role,
            content: message.content,
            createdAt: message.createdAt.toISOString(),
          })),
        })),
      },
      {
        headers: {
          "Content-Disposition": `attachment; filename="aibaba-export-${new Date().toISOString().slice(0, 10)}.json"`,
        },
      },
    );
  });
}
