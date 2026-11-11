import { z } from "zod";
import { prisma } from "@/lib/database/prisma";
import { AppError, ERROR_CODES, jsonOk, readJson } from "@/lib/api/response";
import { limit, runApi } from "@/lib/api/guard";
import { requireRole } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { providerStatus } from "@/services/ai";

const SETTING_KEYS = [
  "ai",
  "astrology",
  "numerology",
  "storage",
  "reports",
  "features",
  "consent",
  "retention",
  "pdf",
] as const;

const PatchSchema = z.object({
  key: z.enum(SETTING_KEYS),
  value: z.record(z.string(), z.unknown()),
});

export async function GET(request: Request) {
  return runApi(null, async () => {
    await requireRole("SUPPORT");
    limit(request, "admin:settings:get", 60);
    const [settings, ai] = await Promise.all([
      prisma.appSetting.findMany({ where: { key: { in: [...SETTING_KEYS] } }, orderBy: { key: "asc" } }),
      providerStatus(),
    ]);
    return jsonOk({
      settings: settings.map((setting) => ({
        key: setting.key,
        value: setting.value,
        updatedAt: setting.updatedAt.toISOString(),
      })),
      ai: {
        provider: ai.config.provider,
        model: ai.config.model,
        monthlyBudgetUsd: ai.config.monthlyBudgetUsd,
        available: ai.available,
        reason: ai.reason,
      },
    });
  });
}

export async function PATCH(request: Request) {
  return runApi(request, async () => {
    const admin = await requireRole("OPERATIONS_ADMIN");
    limit(request, "admin:settings:patch", 20);
    const body = await readJson(request, PatchSchema);
    const value = JSON.stringify(body.value);
    if (value.length > 20_000) {
      throw new AppError(ERROR_CODES.PAYLOAD_TOO_LARGE, "Setting value is too large.", 413);
    }
    await prisma.appSetting.upsert({
      where: { key: body.key },
      update: { value, updatedBy: admin.id },
      create: { key: body.key, value, updatedBy: admin.id },
    });
    await audit({
      actorUserId: admin.id,
      action: "ADMIN_SETTING_UPDATED",
      resourceType: "AppSetting",
      resourceId: body.key,
      metadata: { keys: Object.keys(body.value) },
    });
    return jsonOk({ key: body.key, value: body.value });
  });
}
