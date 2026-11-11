# Architecture

## 1. System shape

AIBABA is a single Next.js App Router application with a separate worker process that shares the same Prisma database.

```
Browser
  │  HTML / RSC / JSON
  ▼
Next.js app (src/app)
  ├─ page routes ──────────────── server components
  ├─ /api/v1 route handlers ───── JSON API
  ├─ domain modules ───────────── src/modules
  └─ services ─────────────────── src/services
          │
          ├─ Prisma ────────────── SQLite (local) / PostgreSQL (production)
          ├─ Local or S3 storage ─ private palm assets
          ├─ AI provider ──────── local (default), OpenAI, Gemini
          └─ astronomy-engine ─── deterministic Vedic calculations

Worker process (scripts/worker.ts)
  └─ src/jobs/runner.ts → handlers → same domain services
```

There is no hidden third-party queue or scheduler. Jobs are rows in `BackgroundJob`, claimed with a conditional update. This keeps local development observable and lets production run one or many workers safely.

## 2. Responsibilities by layer

### `src/app`

- **Pages** are server components. They authenticate with `pageUser`/`pageRole`, load data through domain services, and render. No reading content is fetched in the browser when the server can render it directly.
- **Route handlers** are thin: parse/validate input, enforce authentication/rate limits, call a service, return a consistent envelope. Errors are normalised by `runApi` → `handleRouteError`.
- **Layouts** provide navigation, admin shell and global styles.

### `src/modules/life-reading`

The domain core.

| File | Responsibility |
| --- | --- |
| `service.ts` | Draft creation, encrypted draft PATCH, submission, ownership-scoped reads, deletion, report lookup, `READING_INCLUDE` |
| `wizard.ts` | Wizard step definitions and progress helpers |
| `birth.ts` | Decrypts birth data for calculation jobs |
| `views.ts` | Serialisable API/page projections: `summaryView`, `readingDetailView`, `reportView`, `parseReport` |
| `orchestrator.ts` | Consent checks, component status aggregation, report synthesis and publication |

Ownership is enforced in the service layer (`getReadingOrThrow(id, userId)`), not only in route handlers. Cross-user IDs return `404` rather than revealing that a record exists.

### `src/services`

| Service | Notes |
| --- | --- |
| `numerology` | Pure deterministic engine. No network, no AI. Stores mapping version, input, steps and result. |
| `astrology` | Deterministic `astronomy-engine` calculations. Stores provider/version, settings, positions, houses, Dasha and D1/D9 data. |
| `image-analysis/validate` | MIME signature detection, size/dimension checks, re-encode, EXIF stripping, quality metrics. |
| `ai` | Provider factory, prompt registry, budget tracking, schema validation, safety pass, streaming follow-ups. |
| `storage` | `local` private filesystem adapter and private S3 adapter behind one interface. |
| `pdf` | HTML → PDF with embedded Noto Sans / Devanagari fonts via Chrome/Edge. |
| `notifications` | In-app rows plus console or Resend email adapter. Messages never contain birth data or report content. |

### `src/lib`

Cross-cutting utilities: `env` validation, Prisma client, AES-256-GCM field encryption and HMAC signing, password hashing, session handling, RBAC, rate limiting, date/timezone conversion, JSON helpers, audit logging.

### `src/components`

- `reading/ReadingWizard` — step navigation and draft persistence.
- `reading/PalmUploader` — presign, local multipart upload or S3 direct PUT, then complete.
- `reading/ProcessingWatcher` — polls status and advances local jobs.
- `report/ReportDocumentView` — renders the validated report document.
- `astrology/KundliChart` — draws only stored D1/D9 data; North/South style toggle.
- `astrology/chart-data.ts` — React-free parsing/typing shared by server and client.
- `report/ChatPanel`, `history/HistoryList`, `settings/SettingsClient`, `admin/*`.

## 3. Reading lifecycle

```
DRAFT ──submit (consents + validation)──► QUEUED
  ▲                                         │
  │ draft PATCH while DRAFT                 ▼
  └──────────────────────────────────── PROCESSING
                                            │
              ┌─────────────────────────────┼──────────────────────────┐
              ▼                             ▼                          ▼
      component jobs complete        some components limited     synthesis fails
              │                             │                          │
              ▼                             ▼                          ▼
         COMPLETED              PARTIALLY_COMPLETED                FAILED
```

`READY` is an internal intermediate state while synthesis is being queued. `CANCELLED` and `DELETED` are terminal.

### Submission

1. Validate the draft again server-side (`validateDraftForSubmission`).
2. Resolve required consents for the selected methods. `PRODUCT_RESEARCH` is always optional and never bundled.
3. Persist one `ConsentRecord` per purpose with the consent version.
4. Enqueue independent component jobs and the synthesis job using stable idempotency keys.
5. Transition to `QUEUED`; notify the user.

### Jobs

`enqueueJob` inserts a row with a unique idempotency key. A duplicate insert (`P2002`) is treated as success. `runDueJobs` claims a due `QUEUED` row with a conditional `updateMany`, increments attempts, executes the handler with a 120-second timeout, and then:

- marks `COMPLETED`; component jobs trigger `maybeEnqueueSynthesis`;
- retries with exponential backoff while attempts remain and the error is retryable;
- otherwise marks `FAILED`, marks the component failed, and lets the report continue with the failure labelled (except synthesis, which fails the reading).

`LIFE_REPORT_SYNTHESIS` publishes a versioned report only after component outcomes and consent are known. A failed component is represented as `UNAVAILABLE` or `LIMITED`; no generated substitute is inserted.

## 4. Determinism boundaries

The product depends on a strict split:

| Data | Produced by | Stored as |
| --- | --- | --- |
| Numerology numbers, compounds, steps | TypeScript engine | `NumerologyAnalysis` JSON |
| Planetary longitudes, signs, nakshatras, houses, Dasha, D1/D9 | `astronomy-engine` | `AstrologyCalculation` JSON |
| Palm feature visibility | Vision provider (or `NOT_ASSESSED`) | `PalmAnalysis` JSON |
| Narrative interpretation | Local/OpenAI/Gemini | `CompleteLifeReport` JSON |

Prompts receive validated structures and are instructed to explain, not calculate. Report documents are parsed against `ReportDocumentSchema` before storage and again before rendering. A malformed document is not displayed; the page reports a data-integrity issue.

### Astrology details

- Sidereal zodiac, Lahiri ayanamsa: J2000 value `23.853056°` plus IAU general precession.
- Mean lunar node, not true node.
- Whole-sign houses: first house = ascendant sign.
- Nakshatras: 27 equal spans, four padas, boundary epsilon to avoid floating-point drift.
- D9 navamsa: each 30° sign divided into nine 3°20′ parts; placements use the stored longitudes.
- Unknown time: ascendant, houses, Dasha and D9 are `null`; the Moon's date-only range and its uncertainty are stored. Approximate time: an ascendant range and `MEDIUM` uncertainty.

The calculation result is stored in `AstrologyCalculation.chartData`. `readingDetailView` exposes it, and `toKundliCharts` reduces it to the small shape the chart can draw. The chart component never recalculates positions.

## 5. Data model

Key relations (`prisma/schema.prisma`):

```
User 1─* Session
User 1─1 UserProfile
User 1─* CompleteReading
CompleteReading 1─1 BirthProfile
CompleteReading 1─* UploadedAsset
CompleteReading 1─1 PalmAnalysis
CompleteReading 1─1 NumerologyAnalysis
CompleteReading 1─1 AstrologyCalculation
CompleteReading 1─* CompleteLifeReport
CompleteReading 1─* BackgroundJob
CompleteReading 1─* ConsentRecord
CompleteReading 1─* AIConversation ─* AIMessage
CompleteReading 1─* ReportShare
User 1─* Notification
User 1─* DataDeletionRequest
User 1─* AuditLog (as actor)
```

Design choices:

- **Sensitive draft/birth fields store ciphertext.** `CompleteReading.draftData`, `BirthProfile.encryptedFullName` and `BirthProfile.encryptedDateOfBirth` use AES-256-GCM with a random 12-byte IV, version prefix and auth tag. Other personal columns rely on database/volume encryption and least-privilege access; see `docs/SECURITY-PRIVACY.md`.
- **Structured JSON stays in `String` columns** so the schema works on SQLite and PostgreSQL without provider-specific types. Application code validates before use. A production team may migrate selected columns to `jsonb`.
- **Versioning** is explicit: numerology mapping version, astrology provider/version, consent version, report version, prompt version and AI model are persisted.
- **Tombstones**: deletion sets the reading to `DELETED` and clears content/relations; the row remains for audit and to prevent ID reuse confusion.

## 6. Rendering and chart data

`src/components/astrology/chart-data.ts` is deliberately not a client module. This lets the server report page parse stored JSON and pass a serialisable object into the `"use client"` `KundliChart` without turning the parser into a client reference. The component renders an SVG North Indian diamond or a CSS-grid South Indian layout and toggles D1/D9. If no ascendant exists, the page passes `null` and nothing is drawn.

## 7. Error handling

- `AppError` → stable code, HTTP status and safe details.
- Zod errors → `422 VALIDATION_ERROR` with field paths.
- Unknown errors → logged server-side; clients receive `500 INTERNAL_ERROR` without stack traces or provider payloads.
- Same-origin check protects cookie-authenticated mutations; `SameSite=Lax`, `HttpOnly` and production `Secure` cookies add defence in depth.
- Rate limits are fixed-window and in-memory by default. The interface is ready to replace with Redis for multi-instance deployments.

## 8. Trade-offs and deliberate omissions

- SQLite keeps the repository runnable without external infrastructure; PostgreSQL migration is documented, not automated.
- The local interpreter is intentionally limited. It does not pretend to see palms or invent precision.
- In-memory rate limiting is not shared across instances.
- Only D1 and D9 are drawn. Other divisional charts are not approximated.
- `PAYMENTS_ENABLED` exists as configuration only; no checkout or entitlement enforcement is wired.
- Email is console-based unless Resend is configured.
