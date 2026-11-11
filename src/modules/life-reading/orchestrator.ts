import { z } from "zod";
import { prisma } from "@/lib/database/prisma";
import { audit } from "@/lib/audit";
import { parseJson, toJson } from "@/lib/json";
import { AppError, ERROR_CODES } from "@/lib/api/response";
import { notify } from "@/services/notifications";
import { generateFromPrompt } from "@/services/ai";
import {
  NumerologyInterpretationSchema,
  PalmInterpretationSchema,
  PalmObservationSchema,
  ReportDocumentSchema,
  VedicInterpretationSchema,
} from "@/services/ai/schemas";
import type { SynthesisContext } from "@/services/ai/context";
import { type NumerologyCalculation } from "@/services/numerology";
import type { AstrologyResult } from "@/services/astrology";
import { decryptedBirthForReading } from "@/modules/life-reading/birth";
import { parseDraft } from "@/modules/life-reading/service";
import { CONSENT_PURPOSES, requiredConsents, type ConsentPurpose } from "@/lib/validation/reading";

type ModuleStatus = "COMPLETED" | "LIMITED" | "UNAVAILABLE" | "NOT_SELECTED";

interface ComponentStatus {
  module: "PALMISTRY" | "NUMEROLOGY" | "ASTROLOGY";
  status: ModuleStatus;
  method: string;
  note: string;
}

function safeJson<T>(value: string | null, schema: z.ZodType<T>): T | null {
  if (!value) return null;
  try {
    return schema.parse(JSON.parse(value));
  } catch {
    return null;
  }
}

export class CompleteLifeReadingOrchestrator {
  private readingId: string;
  private userId?: string;

  constructor(readingId: string, userId?: string) {
    this.readingId = readingId;
    this.userId = userId;
  }

  private async load() {
    return prisma.completeReading.findUnique({
      where: { id: this.readingId },
      include: {
        birthProfile: true,
        user: { include: { profile: true } },
        palmAnalysis: true,
        numerology: true,
        astrology: true,
        reports: { orderBy: { version: "desc" } },
        consents: true,
        jobs: true,
        assets: { where: { processingStatus: "VALIDATED" } },
      },
    });
  }

  private verifyOwnership(reading: NonNullable<Awaited<ReturnType<CompleteLifeReadingOrchestrator["load"]>>>) {
    if (this.userId && reading.userId !== this.userId) {
      throw new AppError(ERROR_CODES.NOT_FOUND, "Reading not found.", 404);
    }
  }

  private verifyStatus(reading: NonNullable<Awaited<ReturnType<CompleteLifeReadingOrchestrator["load"]>>>) {
    if (!["QUEUED", "PROCESSING", "PARTIALLY_COMPLETED", "READY"].includes(reading.status)) {
      throw new AppError(ERROR_CODES.INVALID_STATE, `Cannot synthesise a reading in status ${reading.status}.`, 409);
    }
  }

  private verifyConsents(
    reading: NonNullable<Awaited<ReturnType<CompleteLifeReadingOrchestrator["load"]>>>,
    modules: string[],
  ) {
    const granted = new Set(
      reading.consents
        .filter((c) => c.granted && !c.withdrawnAt && c.readingId === this.readingId)
        .map((c) => c.purpose),
    );
    const draft = parseDraft(reading);
    const required = requiredConsents({ ...draft, methods: modules as typeof draft.methods });
    const missing = required.filter((purpose) => !granted.has(purpose));
    if (missing.length) {
      throw new AppError(ERROR_CODES.CONSENT_REQUIRED, "Consent is missing for required processing.", 403, { missing });
    }
  }

  private componentStatuses(
    reading: NonNullable<Awaited<ReturnType<CompleteLifeReadingOrchestrator["load"]>>>,
    modules: string[],
  ): ComponentStatus[] {
    return ["PALMISTRY", "NUMEROLOGY", "ASTROLOGY"].map((module) => {
      if (!modules.includes(module)) {
        return { module: module as ComponentStatus["module"], status: "NOT_SELECTED", method: "Not selected", note: "Not part of this reading." };
      }
      if (module === "PALMISTRY") {
        const analysis = reading.palmAnalysis;
        const status: ModuleStatus =
          analysis?.status === "COMPLETED"
            ? "COMPLETED"
            : analysis?.status === "LIMITED"
              ? "LIMITED"
              : "UNAVAILABLE";
        return {
          module: "PALMISTRY",
          status,
          method: analysis?.modelVersion
            ? `Vision-assisted observation · ${analysis.modelVersion}`
            : "Photographic quality assessment only",
          note:
            status === "COMPLETED"
              ? "Visible palm features were observed and interpreted."
              : status === "LIMITED"
                ? "Palm lines could not be reliably confirmed. No palm interpretation was invented."
                : "The palmistry component did not complete.",
        };
      }
      if (module === "NUMEROLOGY") {
        const analysis = reading.numerology;
        return {
          module: "NUMEROLOGY",
          status: analysis?.status === "COMPLETED" ? "COMPLETED" : "UNAVAILABLE",
          method: analysis ? `${analysis.system} numerology · ${analysis.mappingVersion}` : "Deterministic numerology",
          note:
            analysis?.status === "COMPLETED"
              ? "Numbers and calculation steps were produced by the deterministic calculator."
              : "The numerology calculation did not complete.",
        };
      }
      const analysis = reading.astrology;
      const status: ModuleStatus =
        analysis?.calculationStatus === "COMPLETED"
          ? "COMPLETED"
          : analysis?.calculationStatus === "LIMITED"
            ? "LIMITED"
            : "UNAVAILABLE";
      const settings = parseJson<{ ayanamsaValue?: number }>(analysis?.calculationSettings, {});
      return {
        module: "ASTROLOGY",
        status,
        method: analysis
          ? `Sidereal · Lahiri ${settings.ayanamsaValue?.toFixed(4) ?? ""}° · whole-sign houses · ${analysis.provider} ${analysis.providerVersion}`
          : "Dedicated sidereal calculation engine",
        note:
          status === "COMPLETED"
            ? "Chart data was calculated from exact birth details."
            : status === "LIMITED"
              ? "Birth-time-dependent fields are limited because the time is unknown or approximate; they are labelled."
              : "The astrology calculation did not complete.",
      };
    });
  }

  private validateVersions(
    reading: NonNullable<Awaited<ReturnType<CompleteLifeReadingOrchestrator["load"]>>>,
  ) {
    if (reading.numerology) {
      const supported = ["chaldean-v1", "pythagorean-v1"];
      if (!supported.includes(reading.numerology.mappingVersion)) {
        throw new AppError(ERROR_CODES.INVALID_STATE, "Unsupported numerology mapping version.", 409);
      }
    }
    if (reading.astrology) {
      if (!reading.astrology.providerVersion || !reading.astrology.provider) {
        throw new AppError(ERROR_CODES.INVALID_STATE, "Astrology calculation is missing provider version metadata.", 409);
      }
    }
  }

  private buildContext(
    reading: NonNullable<Awaited<ReturnType<CompleteLifeReadingOrchestrator["load"]>>>,
    modules: string[],
    statuses: ComponentStatus[],
  ): SynthesisContext {
    const draft = parseDraft(reading);
    const preferredName = reading.user.profile?.displayName || draft.preferredName || draft.fullName || "Reader";
    const numerologyCalc = reading.numerology
      ? parseJson<NumerologyCalculation | null>(reading.numerology.calculationResults, null)
      : null;
    const numerologyInterpretation = reading.numerology
      ? safeJson(reading.numerology.interpretation, NumerologyInterpretationSchema)
      : null;
    const astrology = reading.astrology
      ? parseJson<AstrologyResult | null>(reading.astrology.chartData, null)
      : null;
    const astrologyInterpretation = reading.astrology
      ? safeJson(reading.astrology.interpretation, VedicInterpretationSchema)
      : null;
    const palmObservation = reading.palmAnalysis
      ? safeJson(reading.palmAnalysis.structuredObservations, PalmObservationSchema)
      : null;
    const palmInterpretation = reading.palmAnalysis
      ? safeJson(reading.palmAnalysis.interpretation, PalmInterpretationSchema)
      : null;
    const storedQuality = reading.palmAnalysis
      ? parseJson<{ status: string; score: number; issues?: Array<{ message: string } | string> } | null>(
          reading.palmAnalysis.imageQuality,
          null,
        )
      : null;
    const quality = storedQuality
      ? {
          status: storedQuality.status,
          score: storedQuality.score,
          issues: storedQuality.issues?.map((issue) => (typeof issue === "string" ? issue : issue.message)),
        }
      : null;

    return {
      preferredName,
      displayName: reading.user.name,
      language: reading.language,
      dateOfBirth: "",
      referenceDate: new Date().toISOString().slice(0, 10),
      selectedModules: modules,
      moduleStatuses: statuses.map((s) => ({
        module: s.module,
        status: s.status === "UNAVAILABLE" ? "UNAVAILABLE" : s.status,
        method: s.method,
        note: s.note,
      })),
      numerology: numerologyCalc ?? undefined,
      numerologyInterpretation: numerologyInterpretation ?? undefined,
      astrology: astrology ?? undefined,
      astrologyInterpretation: astrologyInterpretation ?? undefined,
      palmObservation: palmObservation ?? undefined,
      palmInterpretation: palmInterpretation ?? undefined,
      palmImageQuality: quality,
    };
  }

  async run(): Promise<{ reportId: string; version: number; status: string }> {
    const reading = await this.load();
    if (!reading) throw new AppError(ERROR_CODES.NOT_FOUND, "Reading not found.", 404);
    this.verifyOwnership(reading);
    this.verifyStatus(reading);
    const modules = parseJson<string[]>(reading.selectedModules, []);
    this.verifyConsents(reading, modules);
    this.validateVersions(reading);

    const statuses = this.componentStatuses(reading, modules);
    const usable =
      statuses.some((s) => s.status === "COMPLETED" || s.status === "LIMITED") &&
      (reading.numerology?.status === "COMPLETED" ||
        reading.astrology?.calculationStatus === "COMPLETED" ||
        reading.astrology?.calculationStatus === "LIMITED" ||
        reading.palmAnalysis?.status === "COMPLETED");

    if (!usable) {
      await prisma.completeReading.update({
        where: { id: this.readingId },
        data: { status: "FAILED", errorCode: "NO_COMPONENT_DATA" },
      });
      await notify({
        userId: reading.userId,
        readingId: this.readingId,
        type: "REPORT_FAILED",
        title: "Reading could not be completed",
        body: "None of the selected methods produced validated data. No report was generated from invented content. You can retry the analysis or contact support.",
      });
      await audit({
        actorUserId: reading.userId,
        action: "REPORT_GENERATION_FAILED",
        resourceType: "CompleteReading",
        resourceId: this.readingId,
        metadata: { reason: "NO_COMPONENT_DATA" },
      });
      throw new AppError(ERROR_CODES.PROVIDER_UNAVAILABLE, "No validated component data is available for a report.", 409);
    }

    const context = this.buildContext(reading, modules, statuses);
    const sanitizedPayload = JSON.stringify({
      reader: context.preferredName,
      language: context.language,
      selectedModules: context.selectedModules,
      moduleStatuses: context.moduleStatuses,
      numerology: reading.numerology
        ? {
            system: reading.numerology.system,
            mappingVersion: reading.numerology.mappingVersion,
            results: parseJson(reading.numerology.calculationResults, {}),
            interpretation: parseJson(reading.numerology.interpretation, {}),
          }
        : null,
      astrology: reading.astrology
        ? {
            settings: parseJson(reading.astrology.calculationSettings, {}),
            planetaryPositions: parseJson(reading.astrology.planetaryPositions, []),
            chartData: parseJson<Record<string, unknown>>(reading.astrology.chartData, {}).ascendant
              ? { ascendant: parseJson<Record<string, unknown>>(reading.astrology.chartData, {}).ascendant }
              : null,
            dashaData: parseJson(reading.astrology.dashaData, null),
            birthTimeAccuracy: reading.astrology.birthTimeAccuracy,
            uncertainty: parseJson(reading.astrology.uncertaintyMetadata, {}),
            interpretation: parseJson(reading.astrology.interpretation ?? null, {}),
          }
        : null,
      palm: reading.palmAnalysis
        ? {
            observations: parseJson(reading.palmAnalysis.structuredObservations, {}),
            interpretation: parseJson(reading.palmAnalysis.interpretation, {}),
            limitations: parseJson<{ limitations?: string[] }>(reading.palmAnalysis.structuredObservations, {}).limitations ?? [],
          }
        : null,
    });

    const synthesis = await generateFromPrompt({
      promptKey: "synthesis",
      payload: sanitizedPayload,
      language: reading.language,
      context,
      schema: ReportDocumentSchema,
      schemaName: "complete_life_report",
      userId: reading.userId,
      readingId: this.readingId,
      temperature: 0.45,
    });
    const document = ReportDocumentSchema.parse(synthesis.data);

    const allCompleted = statuses
      .filter((s) => s.status !== "NOT_SELECTED")
      .every((s) => s.status === "COMPLETED");
    const finalStatus = allCompleted ? "COMPLETED" : "PARTIALLY_COMPLETED";
    const version = reading.reportVersion + 1;

    const report = await prisma.$transaction(async (tx) => {
      await tx.completeLifeReport.updateMany({
        where: { readingId: this.readingId, status: "FINAL" },
        data: { status: "SUPERSEDED" },
      });
      const created = await tx.completeLifeReport.create({
        data: {
          readingId: this.readingId,
          userId: reading.userId,
          version,
          reportContent: toJson(document),
          synthesisMetadata: toJson({
            components: statuses,
            providers: {
              ai: synthesis.provider,
              model: synthesis.model,
              promptVersion: synthesis.promptVersion,
              numerology: reading.numerology?.mappingVersion ?? null,
              astrology: reading.astrology
                ? `${reading.astrology.provider}@${reading.astrology.providerVersion}`
                : null,
              palm: reading.palmAnalysis?.modelVersion ?? null,
            },
            integrity: {
              allCompleted,
              sharedConsensusClaimed: false,
              note: "Sections are separately attributed. Consensus is only stated when theme tags genuinely overlap.",
            },
            usage: synthesis.usage,
            generatedAt: new Date().toISOString(),
          }),
          promptVersion: synthesis.promptVersion,
          aiModel: `${synthesis.provider}:${synthesis.model}`,
          status: "FINAL",
        },
      });
      await tx.completeReading.update({
        where: { id: this.readingId },
        data: {
          status: finalStatus,
          reportVersion: version,
          completedAt: new Date(),
          errorCode: allCompleted ? null : "PARTIAL_COMPONENTS",
        },
      });
      return created;
    });

    await notify({
      userId: reading.userId,
      readingId: this.readingId,
      type: "REPORT_READY",
      title: finalStatus === "COMPLETED" ? "Your Complete Life Reading is ready" : "Your reading is ready with limitations",
      body:
        finalStatus === "COMPLETED"
          ? "Open your report to read the combined interpretation and download a PDF."
          : "Some selected methods could not be completed fully. Your report explains which parts are limited and why.",
    });
    await audit({
      actorUserId: reading.userId,
      action: "REPORT_GENERATED",
      resourceType: "CompleteLifeReport",
      resourceId: report.id,
      metadata: { version, finalStatus, aiProvider: synthesis.provider },
    });

    return { reportId: report.id, version, status: finalStatus };
  }
}

export async function synthesizeCompleteReading(readingId: string): Promise<void> {
  const orchestrator = new CompleteLifeReadingOrchestrator(readingId);
  await orchestrator.run();
}

/**
 * Recomputes the preferred name and DOB inputs server-side for component jobs.
 * This function is deliberately not used by the orchestrator's synthesis step:
 * the final report receives only minimized, validated interpretation data.
 */
export async function componentInputs(readingId: string) {
  const { reading, birth } = await decryptedBirthForReading(readingId);
  if (!reading) throw new AppError(ERROR_CODES.NOT_FOUND, "Reading not found.", 404);
  if (!birth?.dateOfBirth) throw new AppError(ERROR_CODES.INVALID_STATE, "Birth details are missing.", 409);
  const draft = parseDraft(reading);
  return { reading, birth, draft };
}

export const ORCHESTRATOR_STEPS = [
  "validate ownership",
  "verify reading status",
  "verify consent records",
  "verify component availability",
  "validate calculation versions",
  "build structured interpretation input",
  "generate palmistry explanation",
  "generate numerology explanation",
  "generate Vedic explanation",
  "generate final combined reflection",
  "run safety and output validation",
  "save immutable report version",
  "update reading status",
  "notify the user",
] as const;

export type { ConsentPurpose };
export { CONSENT_PURPOSES };
