import { prisma } from "@/lib/database/prisma";
import { pageRole } from "@/lib/auth/page";
import { hasRole } from "@/lib/permissions/rbac";
import { parseJson } from "@/lib/json";
import { providerStatus } from "@/services/ai";
import { pdfAvailable } from "@/services/pdf";
import { SettingsEditor } from "@/components/admin/SettingsEditor";

export const metadata = { title: "Admin settings" };

const SETTING_KEYS = ["ai", "astrology", "numerology", "storage", "reports", "features", "consent", "retention", "pdf"];

export default async function AdminSettingsPage() {
  const admin = await pageRole("/admin/settings", "SUPPORT");
  const canEdit = hasRole(admin.role, "OPERATIONS_ADMIN");
  const [rows, ai, pdf] = await Promise.all([
    prisma.appSetting.findMany({ where: { key: { in: SETTING_KEYS } }, orderBy: { key: "asc" } }),
    providerStatus(),
    pdfAvailable(),
  ]);

  const entries = rows.map((row) => ({
    key: row.key,
    value: parseJson<Record<string, unknown>>(row.value, {}),
    updatedAt: row.updatedAt.toISOString(),
  }));

  return (
    <div className="stack">
      <div>
        <h2 className="text-xl font-semibold text-[#10152b]">AI & settings</h2>
        <p className="mt-1 max-w-2xl text-[0.78rem] leading-relaxed text-[#6b6785]">
          Operational configuration only. Secrets stay in environment variables and are never rendered here.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card p-4">
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[#8a86a0]">AI provider</p>
          <p className="mt-1.5 text-[0.82rem] font-medium text-[#2f2c47]">
            {ai.config.provider} · {ai.config.model || "no model"}
          </p>
          <p className="mt-1 text-[0.68rem] text-[#8a86a0]">
            Budget ${ai.config.monthlyBudgetUsd.toFixed(2)} / month · {ai.available ? "available" : "unavailable"}
          </p>
          {!ai.available && ai.reason && <p className="mt-1 text-[0.68rem] text-[#9a3223]">{ai.reason}</p>}
        </div>
        <div className="card p-4">
          <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[#8a86a0]">PDF renderer</p>
          <p className="mt-1.5 text-[0.82rem] font-medium text-[#2f2c47]">
            {pdf ? "Chrome/Edge detected" : "Not available"}
          </p>
          <p className="mt-1 text-[0.68rem] text-[#8a86a0]">
            {pdf ? "Unicode PDF export is enabled." : "Set CHROMIUM_EXECUTABLE_PATH to enable PDF export."}
          </p>
        </div>
      </div>

      <SettingsEditor entries={entries} canEdit={canEdit} />
    </div>
  );
}
