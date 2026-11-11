import sharp from "sharp";
import { prisma } from "@/lib/database/prisma";
import { parseJson, toJson } from "@/lib/json";
import { storage } from "@/services/storage";
import { generateFromPrompt } from "@/services/ai";
import {
  NumerologyInterpretationSchema,
  PalmInterpretationSchema,
  PalmObservationSchema,
  VedicInterpretationSchema,
} from "@/services/ai/schemas";
import { calculateNumerology } from "@/services/numerology";
import { calculateAstrology } from "@/services/astrology";
import { localToUtc } from "@/lib/datetime";
import { componentInputs } from "@/modules/life-reading/orchestrator";
import { CompleteLifeReadingOrchestrator } from "@/modules/life-reading/orchestrator";
import { notify } from "@/services/notifications";
import type { ImageQuality } from "@/services/image-analysis/validate";

function combineQuality(assets: Array<{ qualityMetadata: string | null }>): ImageQuality | null {
  const qualities = assets
    .map((a) => parseJson<ImageQuality | null>(a.qualityMetadata, null))
    .filter((q): q is ImageQuality => Boolean(q));
  if (!qualities.length) return null;
  return qualities.sort((a, b) => a.score - b.score)[0];
}

async function ensurePalmRecord(readingId: string, userId: string, status: string) {
  return prisma.palmAnalysis.upsert({
    where: { readingId },
    update: { status, errorCode: null },
    create: { readingId, userId, status },
  });
}

async function prepareVisionImage(buffer: Buffer): Promise<{ base64: string; mimeType: string }> {
  const resized = await sharp(buffer)
    .rotate()
    .resize({ width: 1100, height: 1100, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  return { base64: resized.toString("base64"), mimeType: "image/jpeg" };
}

export async function runPalmJob(readingId: string): Promise<void> {
  const { reading, draft } = await componentInputs(readingId);
  const assets = await prisma.uploadedAsset.findMany({
    where: { readingId, userId: reading.userId, processingStatus: "VALIDATED" },
    orderBy: { createdAt: "desc" },
  });
  const left = assets.find((a) => a.assetType === "PALM_LEFT");
  const right = assets.find((a) => a.assetType === "PALM_RIGHT");
  if (!left && !right) throw new Error("PALM_ASSET_MISSING");

  await ensurePalmRecord(readingId, reading.userId, "VALIDATING");
  const dominantHand = draft.dominantHand ?? "RIGHT";
  const primary = (dominantHand === "RIGHT" ? right : left) ?? left ?? right!;
  const secondary = primary.id === left?.id ? right : left;
  const images: Array<{ base64: string; mimeType: string }> = [];
  for (const asset of [primary, secondary].filter(Boolean).slice(0, 2)) {
    try {
      const buffer = await storage().get(asset!.storageKey);
      images.push(await prepareVisionImage(buffer));
    } catch {
      // A missing secondary image must not block analysis of the primary image.
    }
  }
  if (!images.length) throw new Error("PALM_ASSET_UNREADABLE");

  const quality = combineQuality([primary, secondary].filter(Boolean) as Array<{ qualityMetadata: string | null }>);

  const observationResult = await generateFromPrompt({
    promptKey: "palmObservation",
    payload: JSON.stringify({
      dominantHand,
      imagesSupplied: images.length,
      imageQuality: quality,
      instruction: "Assess only what is visible. Do not identify the person.",
    }),
    language: reading.language,
    context: { quality, imagesSupplied: images.length },
    images,
    schema: PalmObservationSchema,
    schemaName: "palm_observation",
    userId: reading.userId,
    readingId,
    temperature: 0.2,
  });
  const observation = PalmObservationSchema.parse(observationResult.data);
  const hasVisible = observation.features.some((f) => f.status === "VISIBLE" || f.status === "FAINT");

  const interpretationResult = await generateFromPrompt({
    promptKey: "palmInterpretation",
    payload: JSON.stringify(observation),
    language: reading.language,
    context: { observation },
    schema: PalmInterpretationSchema,
    schemaName: "palm_interpretation",
    userId: reading.userId,
    readingId,
    temperature: 0.4,
  });
  const interpretation = PalmInterpretationSchema.parse(interpretationResult.data);

  await prisma.palmAnalysis.update({
    where: { readingId },
    data: {
      dominantHand,
      leftAssetId: left?.id ?? null,
      rightAssetId: right?.id ?? null,
      imageQuality: toJson(quality ?? {}),
      visibleFeatures: toJson(observation.features),
      structuredObservations: toJson(observation),
      interpretation: toJson(interpretation),
      confidenceMetadata: toJson({
        visionProvider: observationResult.provider,
        model: observationResult.model,
        featuresVisible: observation.features.filter((f) => f.status === "VISIBLE" || f.status === "FAINT").length,
        retakeRecommended: observation.retakeRecommended,
        safetyFlags: observation.safetyFlags,
      }),
      modelVersion: `${observationResult.provider}:${observationResult.model}`,
      promptVersion: `${observationResult.promptVersion}+${interpretationResult.promptVersion}`,
      status: hasVisible ? "COMPLETED" : "LIMITED",
      errorCode: hasVisible ? null : "NO_VISIBLE_LINES",
    },
  });

  await notify({
    userId: reading.userId,
    readingId,
    type: "PALM_COMPLETED",
    title: hasVisible ? "Palm observation complete" : "Palm analysis was limited",
    body: hasVisible
      ? "Visible palm features were observed and interpreted. Only what was visible is included."
      : "The photograph did not allow reliable palm-line observation. No lines were invented; you can retake the photograph or continue with the other methods.",
  });
}

export async function runNumerologyJob(readingId: string): Promise<void> {
  const { reading, birth, draft } = await componentInputs(readingId);
  if (!draft.numerologySystem) throw new Error("NUMEROLOGY_SYSTEM_MISSING");
  const calculationName = draft.numerologyName || birth.fullName || "";
  await prisma.numerologyAnalysis.upsert({
    where: { readingId },
    update: { status: "PENDING", errorCode: null },
    create: { readingId, userId: reading.userId, system: draft.numerologySystem, mappingVersion: "pending", calculationInput: "{}", calculationSteps: "[]", calculationResults: "{}", status: "PENDING" },
  });

  const calculation = calculateNumerology({
    fullName: birth.fullName || draft.fullName,
    calculationName,
    dateOfBirth: birth.dateOfBirth!,
    system: draft.numerologySystem,
    referenceDate: new Date().toISOString().slice(0, 10),
  });

  const interpretationResult = await generateFromPrompt({
    promptKey: "numerology",
    payload: JSON.stringify({
      system: calculation.system,
      mappingVersion: calculation.mappingVersion,
      numbers: Object.values(calculation.numbers).map((n) => ({
        key: n.key,
        label: n.label,
        value: n.value,
        raw: n.raw,
        compound: n.compound,
        meaning: n.meaning,
        calculation: n.calculation,
      })),
      notes: calculation.notes,
    }),
    language: reading.language,
    context: { calculation },
    schema: NumerologyInterpretationSchema,
    schemaName: "numerology_interpretation",
    userId: reading.userId,
    readingId,
    temperature: 0.4,
  });
  const interpretation = NumerologyInterpretationSchema.parse(interpretationResult.data);

  await prisma.numerologyAnalysis.update({
    where: { readingId },
    data: {
      system: calculation.system,
      mappingVersion: calculation.mappingVersion,
      calculationInput: toJson(calculation.input),
      calculationSteps: toJson(
        Object.values(calculation.numbers).map((n) => ({ key: n.key, label: n.label, calculation: n.calculation, steps: n.steps })),
      ),
      calculationResults: toJson(calculation),
      interpretation: toJson(interpretation),
      status: "COMPLETED",
      errorCode: null,
    },
  });

  await notify({
    userId: reading.userId,
    readingId,
    type: "NUMEROLOGY_COMPLETED",
    title: "Numerology calculation complete",
    body: "Your deterministic numerology numbers and their traditional interpretations are ready.",
  });
}

export async function runAstrologyJob(readingId: string): Promise<void> {
  const { reading, birth } = await componentInputs(readingId);
  if (!birth.birthplaceName || birth.latitude === null || birth.longitude === null || !birth.timezone) {
    throw new Error("BIRTHPLACE_MISSING");
  }
  await prisma.astrologyCalculation.upsert({
    where: { readingId },
    update: { calculationStatus: "PENDING", errorCode: null },
    create: {
      readingId,
      userId: reading.userId,
      provider: "pending",
      providerVersion: "pending",
      calculationSettings: "{}",
      birthTimeAccuracy: birth.birthTimeAccuracy,
      calculationStatus: "PENDING",
    },
  });

  const calculation = calculateAstrology({
    dateOfBirth: birth.dateOfBirth!,
    birthTime: birth.birthTime ?? undefined,
    birthTimeAccuracy: birth.birthTimeAccuracy as "EXACT" | "APPROXIMATE" | "UNKNOWN",
    birthplace: {
      name: birth.birthplaceName,
      country: "",
      latitude: birth.latitude,
      longitude: birth.longitude,
      timezone: birth.timezone,
    },
    localToUtc,
  });

  const interpretationResult = await generateFromPrompt({
    promptKey: "vedic",
    payload: JSON.stringify({
      settings: calculation.settings,
      birthTimeAccuracy: birth.birthTimeAccuracy,
      assumedTime: calculation.birth.assumedTime,
      ascendant: calculation.ascendant,
      planets: calculation.planets,
      houses: calculation.houses,
      dasha: calculation.dasha,
      uncertainty: calculation.uncertainty,
    }),
    language: reading.language,
    context: { astrology: calculation },
    schema: VedicInterpretationSchema,
    schemaName: "vedic_interpretation",
    userId: reading.userId,
    readingId,
    temperature: 0.4,
  });
  const interpretation = VedicInterpretationSchema.parse(interpretationResult.data);

  const calculationStatus = calculation.ascendant ? "COMPLETED" : "LIMITED";
  await prisma.astrologyCalculation.update({
    where: { readingId },
    data: {
      provider: calculation.provider,
      providerVersion: calculation.providerVersion,
      calculationSettings: toJson(calculation.settings),
      birthTimeAccuracy: birth.birthTimeAccuracy,
      locationSnapshot: toJson({
        name: birth.birthplaceName,
        latitude: birth.latitude,
        longitude: birth.longitude,
        timezone: birth.timezone,
      }),
      planetaryPositions: toJson(calculation.planets),
      chartData: toJson(calculation),
      dashaData: toJson(calculation.dasha),
      transitData: toJson(calculation.transits),
      uncertaintyMetadata: toJson(calculation.uncertainty),
      interpretation: toJson(interpretation),
      calculationStatus,
      errorCode: null,
    },
  });

  await notify({
    userId: reading.userId,
    readingId,
    type: "ASTROLOGY_COMPLETED",
    title: calculationStatus === "COMPLETED" ? "Vedic chart calculated" : "Vedic calculation completed with limits",
    body:
      calculationStatus === "COMPLETED"
        ? "Your sidereal chart is ready, including planetary placements and Vimshottari Dasha."
        : "Birth time is unknown, so ascendant, houses, divisional charts and Dasha are intentionally withheld and labelled.",
  });
}

export async function runSynthesisJob(readingId: string): Promise<void> {
  const orchestrator = new CompleteLifeReadingOrchestrator(readingId);
  await orchestrator.run();
}
