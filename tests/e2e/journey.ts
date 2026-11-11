/**
 * End-to-end journey against a running AIBABA server.
 *
 *   npm run dev            # terminal 1
 *   npm run e2e            # terminal 2
 *
 * Optionally set E2E_BASE_URL (default http://localhost:3000).
 *
 * This exercises the real HTTP surface — registration, draft saving, signed
 * palm upload, consent-gated submission, the idempotent job queue, report
 * retrieval, PDF, follow-up chat, sharing, session persistence and deletion.
 * It exits non-zero on the first failed assertion.
 */
import { randomBytes } from "node:crypto";
import sharp from "sharp";

const BASE = (process.env.E2E_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const stamp = Date.now().toString(36);
const email = `e2e-${stamp}@example.test`;
const password = `Aibaba-${randomBytes(9).toString("base64url")}`;

let cookie = "";
const results: Array<{ step: string; detail?: string }> = [];

function log(step: string, detail?: string): void {
  results.push({ step, detail });
  console.log(`✓ ${step}${detail ? ` — ${detail}` : ""}`);
}

function fail(message: string, body?: unknown): never {
  console.error(`\n✗ ${message}`);
  if (body !== undefined) console.error(JSON.stringify(body, null, 2).slice(0, 4000));
  console.error(`\nPassed ${results.length} step(s) before failing.`);
  process.exit(1);
}

function rememberCookies(response: Response): void {
  const cookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : response.headers.get("set-cookie")
        ? [response.headers.get("set-cookie") as string]
        : [];
  for (const raw of cookies) {
    const pair = raw.split(";")[0];
    if (pair.startsWith("aibaba_session=")) cookie = pair;
    if (pair.startsWith("aibaba_session=;")) cookie = "";
  }
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(`${BASE}${path}`, { ...init, headers, redirect: "manual" });
  rememberCookies(response);
  return response;
}

async function api<T = unknown>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await request(path, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    fail(`${method} ${path} returned ${response.status}`, payload);
  }
  return (payload as { data: T }).data;
}

async function expectStatus(path: string, status: number, init: RequestInit = {}): Promise<Response> {
  const response = await request(path, init);
  if (response.status !== status) {
    const body = await response.text().catch(() => "");
    fail(`Expected ${status} from ${path}, received ${response.status}`, body.slice(0, 1000));
  }
  return response;
}

async function palmPhoto(): Promise<Buffer> {
  const width = 720;
  const height = 720;
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      // A warm, framed "hand-like" ellipse with high-contrast creases so the
      // quality gate passes without pretending to be a real photograph.
      const dx = (x - width / 2) / (width / 2.4);
      const dy = (y - height / 2) / (height / 2.1);
      const inside = dx * dx + dy * dy <= 1;
      const crease = Math.abs(Math.sin(x / 26) * Math.cos(y / 31)) > 0.965;
      const value = inside ? (crease ? 42 : 168) : 118;
      const i = (y * width + x) * 3;
      raw[i] = inside ? Math.min(255, value + 34) : value;
      raw[i + 1] = inside ? Math.min(255, value - 6) : value;
      raw[i + 2] = inside ? Math.min(255, value - 38) : value;
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

function assert(condition: unknown, message: string, context?: unknown): asserts condition {
  if (!condition) fail(message, context);
}

async function waitForReport(readingId: string): Promise<{
  status: string;
  components: Record<string, string | null>;
  reportId: string | null;
}> {
  const deadline = Date.now() + 90_000;
  let last: { status: string; components: Record<string, string | null>; reportId: string | null } | null =
    null;

  while (Date.now() < deadline) {
    await api(`/api/v1/life-readings/${readingId}/tick`, "POST", {});
    const status = await api<{
      reading: { status: string; reportId: string | null };
      components: Record<string, string | null>;
    }>(`/api/v1/life-readings/${readingId}/status`, "GET");
    last = {
      status: status.reading.status,
      components: status.components,
      reportId: status.reading.reportId,
    };
    if (["COMPLETED", "PARTIALLY_COMPLETED", "FAILED", "CANCELLED"].includes(last.status)) {
      return last;
    }
    await new Promise((resolve) => setTimeout(resolve, 900));
  }
  fail("Timed out waiting for the reading to finish", last);
}

async function main(): Promise<void> {
  console.log(`AIBABA end-to-end journey → ${BASE}\n`);

  // 0. Server reachable
  const health = await request("/api/health").catch(() => null);
  if (!health || !health.ok) {
    fail(
      `The server is not reachable at ${BASE}. Start it with \`npm run dev\` (or set E2E_BASE_URL).`,
    );
  }
  log("Health endpoint responded");

  // 1–3. Register and open the account
  const registered = await api<{ id: string; email: string }>("/api/v1/auth/register", "POST", {
    name: "E2E Journey",
    email,
    password,
    acceptTerms: true,
  });
  assert(cookie, "Registration did not set a session cookie");
  log("Registered a new account", registered.email);

  const me = await api<{ user: { id: string; email: string } | null }>("/api/v1/auth/me", "GET");
  assert(me.user && me.user.id === registered.id, "Session does not resolve to the registered user");
  log("Session verified", me.user.email);

  // 4. Create a draft reading
  const created = await api<{ id: string; status: string }>("/api/v1/life-readings", "POST", {
    language: "en",
  });
  assert(created.status === "DRAFT", `Expected DRAFT, got ${created.status}`);
  const readingId = created.id;
  log("Created reading draft", readingId);

  // 5–8. Save the full wizard draft
  const draft = {
    methods: ["PALMISTRY", "NUMEROLOGY", "ASTROLOGY"],
    fullName: "E2E Journey",
    preferredName: "E2E",
    dateOfBirth: "1990-05-15",
    language: "en",
    country: "India",
    numerologySystem: "CHALDEAN",
    numerologyName: "E2E Journey",
    dominantHand: "RIGHT",
    birthTime: "14:30",
    birthTimeAccuracy: "EXACT",
    birthplace: {
      name: "New Delhi",
      region: "Delhi",
      country: "India",
      latitude: 28.6139,
      longitude: 77.209,
      timezone: "Asia/Kolkata",
    },
    step: 6,
  };
  await api(`/api/v1/life-readings/${readingId}`, "PATCH", draft);
  log("Saved name, birth details, methods and numerology system");

  // 9. Upload a palm photograph through the signed local upload flow
  const photo = await palmPhoto();
  const presign = await api<{
    assetId: string;
    uploadToken: string;
    expires: number;
    mode: "local" | "s3";
    uploadUrl: string;
  }>("/api/v1/uploads/presign", "POST", {
    readingId,
    assetType: "PALM_RIGHT",
    filename: "right-palm.png",
    mimeType: "image/png",
    fileSize: photo.length,
  });
  assert(presign.mode === "local", "This journey expects local storage (STORAGE_PROVIDER=local)");

  const form = new FormData();
  form.set("assetId", presign.assetId);
  form.set("expires", String(presign.expires));
  form.set("token", presign.uploadToken);
  form.set("file", new Blob([new Uint8Array(photo)], { type: "image/png" }), "right-palm.png");
  const uploaded = await request("/api/v1/uploads/complete", { method: "POST", body: form });
  const uploadPayload = await uploaded.json().catch(() => null);
  if (!uploaded.ok) fail("Palm upload failed", uploadPayload);
  const asset = (uploadPayload as { data: { id: string; status: string } }).data;
  assert(asset.status === "VALIDATED", `Palm photo was not validated (status: ${asset.status})`);
  log("Uploaded and validated a palm photograph", asset.id);

  // Signed preview URL works and an unsigned one does not.
  await expectStatus(`/api/v1/uploads/${asset.id}/file?expires=1&sig=forged`, 403);
  log("Unsigned palm image access is rejected");

  // 10. Explicit consent, then submit
  const rejected = await request(`/api/v1/life-readings/${readingId}/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ consents: { PERSONAL_DATA_PROCESSING: true } }),
  });
  assert(rejected.status === 403, `Submission without required consent should be 403, got ${rejected.status}`);
  log("Submission without full consent is refused");

  const submitted = await api<{ status: string }>(`/api/v1/life-readings/${readingId}/submit`, "POST", {
    consents: {
      PERSONAL_DATA_PROCESSING: true,
      AI_PROCESSING: true,
      PALM_IMAGE_PROCESSING: true,
      SAVE_HISTORY: true,
      PRODUCT_RESEARCH: false,
    },
  });
  assert(submitted.status === "QUEUED", `Expected QUEUED after submit, got ${submitted.status}`);
  log("Submitted the reading with separate consents");

  // 11–12. Drive the idempotent queue and inspect per-component progress
  const finished = await waitForReport(readingId);
  assert(
    finished.status === "COMPLETED" || finished.status === "PARTIALLY_COMPLETED",
    `Reading finished in an unexpected state: ${finished.status}`,
    finished,
  );
  assert(finished.reportId, "The reading finished without a report id");
  log(
    `Reading finished as ${finished.status}`,
    `palm=${finished.components.palm} numerology=${finished.components.numerology} astrology=${finished.components.astrology}`,
  );

  // 13. Open the report
  const report = await api<{
    report: {
      id: string;
      version: number;
      document: {
        sections: Array<{ kind: string; title: string }>;
        methods: Array<{ module: string; status: string }>;
      };
      pdfUrl: string;
    } | null;
  }>(`/api/v1/life-readings/${readingId}/report`, "GET");
  assert(report.report, "Report endpoint returned no report");
  const document = report.report.document;
  assert(document.sections.length >= 10, `Expected at least 10 sections, got ${document.sections.length}`);
  const kinds = document.sections.map((section) => section.kind);
  for (const required of ["OVERVIEW", "PALMISTRY", "NUMEROLOGY", "VEDIC", "REFLECTION"]) {
    assert(kinds.includes(required as never), `Report is missing the ${required} section`, kinds);
  }
  log("Opened the combined report", `${document.sections.length} sections · v${report.report.version}`);

  // 14. Follow-up conversation (streaming)
  const conversation = await api<{ id: string }>("/api/v1/conversations", "POST", {
    readingId,
    title: "E2E questions",
  });
  const chat = await request(`/api/v1/conversations/${conversation.id}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: "Summarise my reading in one sentence." }),
  });
  assert(chat.ok, `Chat request failed with ${chat.status}`);
  const answer = await chat.text();
  assert(answer.trim().length > 0, "The assistant returned an empty answer");
  log("Asked a follow-up question", `${answer.trim().slice(0, 80)}…`);

  // 15. PDF download
  const pdf = await request(report.report.pdfUrl);
  if (pdf.ok) {
    const bytes = Buffer.from(await pdf.arrayBuffer());
    assert(
      bytes.subarray(0, 5).toString("ascii") === "%PDF-",
      "The PDF response is not a PDF document",
    );
    log("Downloaded the PDF report", `${(bytes.length / 1024).toFixed(0)} KB`);
  } else {
    const body = await pdf.json().catch(() => null);
    assert(
      pdf.status === 503,
      `PDF download failed unexpectedly with ${pdf.status}`,
      body,
    );
    log("PDF renderer unavailable — endpoint returned the documented 503", "set CHROMIUM_EXECUTABLE_PATH");
  }

  // 16. Permission-controlled share link
  const share = await api<{ url: string; expiresAt: string }>(
    `/api/v1/life-readings/${readingId}/share`,
    "POST",
  );
  const token = share.url.replace("/share/", "");
  const shared = await api<{ document: { preferredName: string } | null; version: number }>(
    `/api/v1/shares/${token}`,
    "GET",
  );
  assert(shared.document, "Shared report link returned no document");
  log("Created and opened a share link", `expires ${share.expiresAt}`);

  // 17. History while signed in
  const history = await api<{ readings: Array<{ id: string; status: string }> }>(
    "/api/v1/life-readings",
    "GET",
  );
  assert(
    history.readings.some((reading) => reading.id === readingId),
    "The reading is missing from history",
  );
  log("Reading appears in history", `${history.readings.length} saved reading(s)`);

  // 18. Consent + export surface
  const consents = await api<{ consents: Array<{ purpose: string; granted: boolean }> }>(
    "/api/v1/privacy/consents",
    "GET",
  );
  assert(
    consents.consents.some((consent) => consent.purpose === "PRODUCT_RESEARCH" && !consent.granted),
    "Optional research consent should remain declined",
  );
  const exported = await api<{ exportedAt: string }>("/api/v1/privacy/export", "GET");
  assert(exported.exportedAt, "Data export did not return a timestamp");
  log("Verified per-purpose consents and requested a data export");

  // 19. Persistence across sign-out and sign-in
  await api("/api/v1/auth/logout", "POST", {});
  cookie = "";
  await expectStatus(`/api/v1/life-readings/${readingId}`, 401);
  await api("/api/v1/auth/login", "POST", { email, password });
  const persisted = await api<{ id: string; status: string; report: unknown }>(
    `/api/v1/life-readings/${readingId}`,
    "GET",
  );
  assert(persisted.status === finished.status && persisted.report, "The report did not persist after re-login");
  log("Report persisted across sign-out and sign-in");

  // 20. Delete everything
  await api(`/api/v1/life-readings/${readingId}`, "DELETE");
  await expectStatus(`/api/v1/life-readings/${readingId}`, 404);
  await expectStatus(`/api/v1/uploads/${asset.id}`, 404);
  await expectStatus(`/api/v1/shares/${token}`, 404);
  log("Deleted the reading; report, palm asset and share link are gone");

  console.log(`\nAll ${results.length} journey steps passed.`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "Unexpected journey failure");
});
