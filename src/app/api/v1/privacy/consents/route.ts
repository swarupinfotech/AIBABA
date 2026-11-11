import { z } from "zod";
import { prisma } from "@/lib/database/prisma";
import { AppError, ERROR_CODES, jsonOk, readJson } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireUser } from "@/lib/auth/session";
import { CONSENT_PURPOSES, CONSENT_VERSION } from "@/lib/validation/reading";
import { toJson } from "@/lib/json";
import { audit } from "@/lib/audit";

export async function GET(request: Request) {
  return runApi(null, async () => {
    const user = await requireUser();
    limit(request, "privacy:consents:get", 60);
    const consents = await prisma.consentRecord.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return jsonOk({
      version: CONSENT_VERSION,
      purposes: CONSENT_PURPOSES,
      consents: consents.map((consent) => ({
        purpose: consent.purpose,
        granted: consent.granted,
        version: consent.consentVersion,
        readingId: consent.readingId,
        grantedAt: consent.grantedAt?.toISOString() ?? null,
        withdrawnAt: consent.withdrawnAt?.toISOString() ?? null,
      })),
    });
  });
}

const PatchSchema = z.object({
  purpose: z.enum(CONSENT_PURPOSES),
  granted: z.boolean(),
});

export async function PATCH(request: Request) {
  return runApi(request, async () => {
    const user = await requireUser();
    limit(request, "privacy:consents:patch", 30);
    const body = await readJson(request, PatchSchema);

    if (!body.granted && ["PERSONAL_DATA_PROCESSING", "SAVE_HISTORY"].includes(body.purpose)) {
      throw new AppError(
        ERROR_CODES.INVALID_STATE,
        "This consent is required while your account is active. Delete your account or reading instead.",
        409,
      );
    }

    const existing = await prisma.consentRecord.findFirst({
      where: { userId: user.id, purpose: body.purpose, withdrawnAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (body.granted) {
      if (existing?.granted) return jsonOk({ purpose: body.purpose, granted: true });
      await prisma.consentRecord.create({
        data: {
          userId: user.id,
          purpose: body.purpose,
          consentVersion: CONSENT_VERSION,
          granted: true,
          grantedAt: new Date(),
          metadata: toJson({ source: "settings" }),
        },
      });
    } else {
      await prisma.consentRecord.updateMany({
        where: { userId: user.id, purpose: body.purpose, withdrawnAt: null },
        data: { withdrawnAt: new Date() },
      });
    }

    await audit({
      actorUserId: user.id,
      action: body.granted ? "CONSENT_GRANTED" : "CONSENT_WITHDRAWN",
      resourceType: "ConsentRecord",
      metadata: { purpose: body.purpose },
    });
    return jsonOk({ purpose: body.purpose, granted: body.granted });
  });
}
