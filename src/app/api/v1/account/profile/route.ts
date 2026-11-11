import { z } from "zod";
import { prisma } from "@/lib/database/prisma";
import { AppError, ERROR_CODES, jsonOk, readJson } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireUser } from "@/lib/auth/session";
import { isValidTimezone } from "@/lib/validation/reading";
import { audit } from "@/lib/audit";

const ProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  country: z.string().trim().max(120).optional().default(""),
  timezone: z.string().max(80).optional().default(""),
  preferredLanguage: z.enum(["en", "hi"]),
});

export async function PATCH(request: Request) {
  return runApi(request, async () => {
    const user = await requireUser();
    limit(request, "account:profile", 30);
    const body = await readJson(request, ProfileSchema);
    if (body.timezone && !isValidTimezone(body.timezone)) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, "That timezone is not recognised.", 422);
    }

    const [profile, account] = await prisma.$transaction([
      prisma.userProfile.upsert({
        where: { userId: user.id },
        update: {
          displayName: body.displayName,
          country: body.country || null,
          timezone: body.timezone || null,
        },
        create: {
          userId: user.id,
          displayName: body.displayName,
          country: body.country || null,
          timezone: body.timezone || null,
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { preferredLanguage: body.preferredLanguage },
      }),
    ]);

    await audit({
      actorUserId: user.id,
      action: "ACCOUNT_PROFILE_UPDATED",
      resourceType: "User",
      resourceId: user.id,
    });

    return jsonOk({
      displayName: profile.displayName,
      country: profile.country,
      timezone: profile.timezone,
      preferredLanguage: account.preferredLanguage,
    });
  });
}
