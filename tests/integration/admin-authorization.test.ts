import "./setup";
import { afterAll, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ token: "" as string }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "aibaba_session" && state.token ? { name, value: state.token } : undefined,
    set: () => undefined,
    delete: () => undefined,
  }),
}));

import { prisma } from "@/lib/database/prisma";
import { randomToken, sha256 } from "@/lib/security/crypto";
import { resetRateLimits } from "@/lib/rate-limit";
import { GET as adminReadings } from "@/app/api/v1/admin/readings/route";

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = (name: string) => `vitest-${run}-${name}@example.test`;

async function makeUser(name: string, role: string) {
  return prisma.user.create({
    data: { email: email(name), name, passwordHash: "unused", role },
  });
}

async function signIn(userId: string, options: { expiresAt?: Date; revokedAt?: Date } = {}) {
  const token = randomToken(24);
  await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt: options.expiresAt ?? new Date(Date.now() + 60 * 60_000),
      revokedAt: options.revokedAt ?? null,
    },
  });
  state.token = token;
  return token;
}

async function callAdmin() {
  return adminReadings(new Request("http://localhost:3000/api/v1/admin/readings"));
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: `vitest-${run}-` } } });
  await prisma.$disconnect();
});

describe("admin API authorization", () => {
  it("rejects anonymous requests with 401", async () => {
    resetRateLimits();
    state.token = "";
    const response = await callAdmin();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects a signed-in normal user with 403", async () => {
    resetRateLimits();
    const user = await makeUser("Normal", "USER");
    await signIn(user.id);
    const response = await callAdmin();
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("rejects an expired session with 401", async () => {
    resetRateLimits();
    const user = await makeUser("Expired", "SUPER_ADMIN");
    await signIn(user.id, { expiresAt: new Date(Date.now() - 60_000) });
    const response = await callAdmin();
    expect(response.status).toBe(401);
  });

  it("rejects a revoked session with 401", async () => {
    resetRateLimits();
    const user = await makeUser("Revoked", "SUPER_ADMIN");
    await signIn(user.id, { revokedAt: new Date() });
    const response = await callAdmin();
    expect(response.status).toBe(401);
  });

  it("allows a support role and returns only operational metadata", async () => {
    resetRateLimits();
    const admin = await makeUser("Support", "SUPPORT");
    const owner = await makeUser("Owner", "USER");
    await prisma.completeReading.create({
      data: { userId: owner.id, status: "COMPLETED", selectedModules: "[]" },
    });
    await signIn(admin.id);

    const response = await callAdmin();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.data.readings)).toBe(true);
    const row = body.data.readings.find((r: { user: { id: string } }) => r.user.id === owner.id);
    expect(row).toBeTruthy();
    // Email is masked and no birth details, images or report content are exposed.
    expect(row.user.email).toMatch(/^\w{2}\*\*\*@/);
    expect(row).not.toHaveProperty("draftData");
    expect(row).not.toHaveProperty("birthProfile");
    expect(row).not.toHaveProperty("reportContent");
  });

  it("allows a content editor, whose role outranks support in the hierarchy", async () => {
    resetRateLimits();
    const editor = await makeUser("Editor", "CONTENT_EDITOR");
    await signIn(editor.id);
    const response = await callAdmin();
    expect(response.status).toBe(200);
  });
});
