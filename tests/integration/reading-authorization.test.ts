import "./setup";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/api/response";
import {
  deleteReading,
  getReadingOrThrow,
  latestReport,
  submitReading,
  updateDraft,
} from "@/modules/life-reading/service";
import { enqueueJob } from "@/jobs/queue";
import { decryptField } from "@/lib/security/crypto";
import { toJson } from "@/lib/json";

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = (name: string) => `vitest-${run}-${name}@example.test`;

async function makeUser(name: string, role = "USER") {
  return prisma.user.create({
    data: {
      email: email(name),
      name,
      passwordHash: "not-used-in-these-tests",
      role,
    },
  });
}

async function makeReading(userId: string, draft: Record<string, unknown> = {}) {
  return prisma.completeReading.create({
    data: {
      userId,
      status: "DRAFT",
      selectedModules: toJson((draft.methods as string[]) ?? []),
      draftData: toJson({
        methods: ["NUMEROLOGY"],
        fullName: "Sample Person",
        dateOfBirth: "1990-05-15",
        numerologySystem: "CHALDEAN",
        numerologyName: "Sample Person",
        step: 6,
        ...draft,
      }),
      currentStep: 6,
    },
  });
}

let userAId = "";
let userBId = "";

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: `vitest-${run}-` } } });
  await prisma.$disconnect();
});

describe("reading ownership", () => {
  it("creates two isolated accounts", async () => {
    const [a, b] = await Promise.all([makeUser("Alice"), makeUser("Bob")]);
    userAId = a.id;
    userBId = b.id;
    expect(userAId).not.toBe(userBId);
  });

  it("allows the owner to load a reading", async () => {
    const reading = await makeReading(userAId);
    const loaded = await getReadingOrThrow(reading.id, userAId);
    expect(loaded.id).toBe(reading.id);
  });

  it("denies another user access to the reading, draft and report", async () => {
    const reading = await makeReading(userAId);

    await expect(getReadingOrThrow(reading.id, userBId)).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
    await expect(updateDraft(reading.id, userBId, { preferredName: "Intruder" })).rejects.toBeInstanceOf(
      AppError,
    );
    await expect(deleteReading(reading.id, userBId)).rejects.toMatchObject({ status: 404 });

    // The report lookup is scoped by userId, so a foreign id yields null.
    await prisma.completeLifeReport.create({
      data: {
        readingId: reading.id,
        userId: userAId,
        version: 1,
        reportContent: "{}",
        synthesisMetadata: "{}",
        promptVersion: "test",
        aiModel: "test",
      },
    });
    expect(await latestReport(reading.id, userBId)).toBeNull();
    expect((await latestReport(reading.id, userAId))?.version).toBe(1);
  });

  it("does not reveal deleted readings as existing", async () => {
    const reading = await makeReading(userAId);
    await prisma.completeReading.update({ where: { id: reading.id }, data: { status: "DELETED" } });
    await expect(getReadingOrThrow(reading.id, userAId)).rejects.toMatchObject({ status: 404 });
    expect((await getReadingOrThrow(reading.id, userAId, { allowDeleted: true })).status).toBe("DELETED");
  });

  it("rejects another user's submission at the service boundary", async () => {
    const reading = await makeReading(userAId);
    await expect(
      submitReading(reading.id, userBId, {
        PERSONAL_DATA_PROCESSING: true,
        AI_PROCESSING: true,
        SAVE_HISTORY: true,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("draft persistence", () => {
  it("stores the draft encrypted and returns the merged document", async () => {
    const reading = await makeReading(userAId);
    const { draft } = await updateDraft(reading.id, userAId, {
      preferredName: "Alice",
      numerologySystem: "PYTHAGOREAN",
    });
    expect(draft.preferredName).toBe("Alice");

    const stored = await prisma.completeReading.findUniqueOrThrow({ where: { id: reading.id } });
    expect(stored.draftData).toBeTruthy();
    expect(stored.draftData).not.toContain("Alice");
    expect(decryptField(stored.draftData as string)).toContain("Alice");
  });

  it("refuses edits after submission", async () => {
    const reading = await makeReading(userAId);
    await prisma.completeReading.update({ where: { id: reading.id }, data: { status: "QUEUED" } });
    await expect(updateDraft(reading.id, userAId, { preferredName: "Too late" })).rejects.toMatchObject({
      status: 409,
    });
  });
});

describe("idempotent job enqueueing", () => {
  it("creates exactly one job for a repeated idempotency key", async () => {
    const reading = await makeReading(userAId);
    const key = `${reading.id}:NUMEROLOGY_CALCULATE:v1`;
    await enqueueJob({
      readingId: reading.id,
      jobType: "NUMEROLOGY_CALCULATE",
      idempotencyKey: key,
    });
    await enqueueJob({
      readingId: reading.id,
      jobType: "NUMEROLOGY_CALCULATE",
      idempotencyKey: key,
    });
    const jobs = await prisma.backgroundJob.findMany({ where: { idempotencyKey: key } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe("QUEUED");
    expect(jobs[0].attemptCount).toBe(0);
  });
});

describe("deletion workflow", () => {
  it("purges report content, conversations and assets but keeps a tombstone", async () => {
    const reading = await makeReading(userAId, { methods: ["NUMEROLOGY", "ASTROLOGY"], step: 6 });
    const conversation = await prisma.aIConversation.create({
      data: {
        userId: userAId,
        readingId: reading.id,
        title: "About my report",
        messages: { create: { role: "user", content: "Explain my life path." } },
      },
    });
    await prisma.completeLifeReport.create({
      data: {
        readingId: reading.id,
        userId: userAId,
        version: 1,
        reportContent: '{"sections":[]}',
        synthesisMetadata: "{}",
        promptVersion: "test",
        aiModel: "test",
      },
    });
    await prisma.uploadedAsset.create({
      data: {
        userId: userAId,
        readingId: reading.id,
        storageKey: `${userAId}/${reading.id}/delete-test.png`,
        assetType: "PALM_LEFT",
        mimeType: "image/png",
        fileSize: 1024,
        checksum: "abc",
        processingStatus: "VALIDATED",
      },
    });
    await prisma.consentRecord.create({
      data: {
        userId: userAId,
        readingId: reading.id,
        purpose: "AI_PROCESSING",
        consentVersion: "2026-11-v1",
        granted: true,
        grantedAt: new Date(),
      },
    });

    await deleteReading(reading.id, userAId);

    const tombstone = await prisma.completeReading.findUniqueOrThrow({ where: { id: reading.id } });
    expect(tombstone.status).toBe("DELETED");
    expect(tombstone.draftData).toBeNull();
    expect(tombstone.selectedModules).toBe("[]");
    expect(await prisma.completeLifeReport.count({ where: { readingId: reading.id } })).toBe(0);
    expect(await prisma.aIConversation.count({ where: { id: conversation.id } })).toBe(0);
    expect(await prisma.consentRecord.count({ where: { readingId: reading.id } })).toBe(0);
    const asset = await prisma.uploadedAsset.findFirstOrThrow({ where: { readingId: reading.id } });
    expect(asset.processingStatus).toBe("DELETED");
    expect(asset.retentionStatus).toBe("DELETED");
    const request = await prisma.dataDeletionRequest.findUniqueOrThrow({ where: { readingId: reading.id } });
    expect(request.status).toBe("COMPLETED");
  });

  it("is idempotent when called twice", async () => {
    const reading = await makeReading(userAId);
    await deleteReading(reading.id, userAId);
    await expect(deleteReading(reading.id, userAId)).resolves.toBeUndefined();
  });
});
