import type { Prisma } from "@prisma/client";
import { parseJson } from "@/lib/json";
import { ReportDocumentSchema, type ReportDocument } from "@/services/ai/schemas";
import type { ImageQuality } from "@/services/image-analysis/validate";
import { READING_INCLUDE, parseDraft } from "@/modules/life-reading/service";
import { assetView } from "@/modules/uploads/service";

export type ReadingWithRelations = Prisma.CompleteReadingGetPayload<{
  include: typeof READING_INCLUDE;
}>;

export type ReportRow = ReadingWithRelations["reports"][number];

export function parseReport(report: ReportRow | null | undefined): {
  document: ReportDocument | null;
  metadata: Record<string, unknown> | null;
} {
  if (!report) return { document: null, metadata: null };
  const raw = parseJson<unknown>(report.reportContent, null);
  const parsed = ReportDocumentSchema.safeParse(raw);
  return {
    document: parsed.success ? parsed.data : null,
    metadata: parseJson<Record<string, unknown> | null>(report.synthesisMetadata, null),
  };
}

export function reportView(report: ReportRow) {
  const { document, metadata } = parseReport(report);
  return {
    id: report.id,
    version: report.version,
    status: report.status,
    aiModel: report.aiModel,
    promptVersion: report.promptVersion,
    createdAt: report.createdAt.toISOString(),
    document,
    metadata,
    pdfUrl: `/api/v1/life-readings/${report.readingId}/report/${report.id}/pdf`,
  };
}

export async function readingDetailView(reading: ReadingWithRelations, userId: string) {
  const assets = await Promise.all(
    reading.assets
      .filter((asset) => asset.assetType === "PALM_LEFT" || asset.assetType === "PALM_RIGHT")
      .map((asset) => assetView(asset.id, userId)),
  );

  const numerologyCalculation = parseJson<Record<string, unknown> | null>(
    reading.numerology?.calculationResults ?? null,
    null,
  );

  return {
    id: reading.id,
    status: reading.status,
    language: reading.language,
    currentStep: reading.currentStep,
    selectedModules: parseJson<string[]>(reading.selectedModules, []),
    inputSnapshotVersion: reading.inputSnapshotVersion,
    createdAt: reading.createdAt.toISOString(),
    submittedAt: reading.submittedAt?.toISOString() ?? null,
    completedAt: reading.completedAt?.toISOString() ?? null,
    reportVersion: reading.reportVersion,
    errorCode: reading.errorCode,
    draft: parseDraft(reading),
    birth: reading.birthProfile
      ? {
          birthplaceName: reading.birthProfile.birthplaceName,
          birthTime: reading.birthProfile.birthTime,
          birthTimeAccuracy: reading.birthProfile.birthTimeAccuracy,
          timezone: reading.birthProfile.timezone,
        }
      : null,
    assets,
    components: {
      palm:
        reading.selectedModules.includes("PALMISTRY") || reading.palmAnalysis
          ? {
              status: reading.palmAnalysis?.status ?? "PENDING",
              dominantHand: reading.palmAnalysis?.dominantHand ?? null,
              quality: parseJson<ImageQuality | null>(reading.palmAnalysis?.imageQuality ?? null, null),
              observation: parseJson<Record<string, unknown> | null>(
                reading.palmAnalysis?.structuredObservations ?? null,
                null,
              ),
              interpretation: parseJson<Record<string, unknown> | null>(
                reading.palmAnalysis?.interpretation ?? null,
                null,
              ),
              confidence: parseJson<Record<string, unknown> | null>(
                reading.palmAnalysis?.confidenceMetadata ?? null,
                null,
              ),
              errorCode: reading.palmAnalysis?.errorCode ?? null,
            }
          : null,
      numerology:
        reading.numerology || reading.selectedModules.includes("NUMEROLOGY")
          ? {
              status: reading.numerology?.status ?? "PENDING",
              system: reading.numerology?.system ?? null,
              mappingVersion: reading.numerology?.mappingVersion ?? null,
              calculation: numerologyCalculation,
              steps: parseJson<unknown[] | null>(reading.numerology?.calculationSteps ?? null, null),
              interpretation: parseJson<Record<string, unknown> | null>(
                reading.numerology?.interpretation ?? null,
                null,
              ),
              errorCode: reading.numerology?.errorCode ?? null,
            }
          : null,
      astrology:
        reading.astrology || reading.selectedModules.includes("ASTROLOGY")
          ? {
              status: reading.astrology?.calculationStatus ?? "PENDING",
              provider: reading.astrology?.provider ?? null,
              providerVersion: reading.astrology?.providerVersion ?? null,
              birthTimeAccuracy: reading.astrology?.birthTimeAccuracy ?? null,
              settings: parseJson<Record<string, unknown> | null>(
                reading.astrology?.calculationSettings ?? null,
                null,
              ),
              chart: parseJson<Record<string, unknown> | null>(reading.astrology?.chartData ?? null, null),
              dasha: parseJson<unknown>(reading.astrology?.dashaData ?? null, null),
              transits: parseJson<unknown>(reading.astrology?.transitData ?? null, null),
              uncertainty: parseJson<Record<string, unknown> | null>(
                reading.astrology?.uncertaintyMetadata ?? null,
                null,
              ),
              interpretation: parseJson<Record<string, unknown> | null>(
                reading.astrology?.interpretation ?? null,
                null,
              ),
              errorCode: reading.astrology?.errorCode ?? null,
            }
          : null,
    },
    jobs: reading.jobs.map((job) => ({
      id: job.id,
      type: job.jobType,
      status: job.status,
      attemptCount: job.attemptCount,
      maxAttempts: job.maxAttempts,
      errorCode: job.errorCode,
      availableAt: job.availableAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
    })),
    consents: reading.consents.map((consent) => ({
      purpose: consent.purpose,
      granted: consent.granted,
      version: consent.consentVersion,
      grantedAt: consent.grantedAt?.toISOString() ?? null,
      withdrawnAt: consent.withdrawnAt?.toISOString() ?? null,
    })),
    report: reading.reports[0] ? reportView(reading.reports[0]) : null,
  };
}

export function summaryView(reading: {
  id: string;
  status: string;
  selectedModules: string;
  language: string;
  reportVersion: number;
  createdAt: Date;
  completedAt: Date | null;
  errorCode: string | null;
  reports: Array<{ id: string; version: number; createdAt: Date }>;
}) {
  return {
    id: reading.id,
    status: reading.status,
    modules: parseJson<string[]>(reading.selectedModules, []),
    language: reading.language,
    reportVersion: reading.reportVersion,
    createdAt: reading.createdAt.toISOString(),
    completedAt: reading.completedAt?.toISOString() ?? null,
    errorCode: reading.errorCode,
    reportId: reading.reports[0]?.id ?? null,
  };
}
