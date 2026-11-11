# HTTP API

Base path: `/api/v1` (except the operational `GET /api/health`).

All responses are JSON except the palm image stream, streamed chat answers and PDFs.

## Conventions

### Success envelope

```json
{ "data": { "...": "..." } }
```

### Error envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the submitted information.",
    "details": { "fields": [{ "path": "email", "message": "Invalid email" }] }
  }
}
```

Stable codes: `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `CONSENT_REQUIRED`, `INVALID_STATE`, `UNSUPPORTED_MEDIA`, `PAYLOAD_TOO_LARGE`, `PROVIDER_UNAVAILABLE`, `INTERNAL_ERROR`.

### Authentication

- Browser sessions use the `aibaba_session` cookie: `HttpOnly`, `SameSite=Lax`, `Secure` in production.
- The server stores only a SHA-256 hash of the token; sessions expire after 30 days and can be revoked.
- Cookie-authenticated mutations check the `Origin` header against the request host and `NEXT_PUBLIC_APP_URL`.
- JSON requests must send `Content-Type: application/json`.
- Cross-user resource IDs return `404` to avoid confirming existence.

### Roles

`USER < SUPPORT < CONTENT_EDITOR < OPERATIONS_ADMIN < SUPER_ADMIN`.

Admin endpoints below state the minimum role. A missing session is `401`; an insufficient role is `403`.

### Rate limits

Fixed-window limits are applied per client and scope (for example, login 10 / 15 minutes, submission 10 / minute, PDF 10 / minute, data export 3 / hour). Limits are in-memory by default; use a shared adapter for multi-instance deployments.

## Health

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/health` | none | Database connectivity check. `200` with latency, or `503` when unavailable. No configuration is exposed. |

## Authentication and account

| Method | Path | Body / query | Description |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/register` | `{ name, email, password (10+), acceptTerms: true }` | Creates the account, starts a session, returns `201`. |
| POST | `/api/v1/auth/login` | `{ email, password }` | Starts a session. |
| POST | `/api/v1/auth/logout` | — | Revokes the current session. |
| GET | `/api/v1/auth/me` | — | `{ user, profile, unreadNotifications }`; `user` is `null` when signed out. |
| PATCH | `/api/v1/account/profile` | `{ displayName, country?, timezone?, preferredLanguage: "en"\|"hi" }` | Updates profile and language. |

## Life readings

| Method | Path | Body / query | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/life-readings` | — | Current user's reading summaries, newest first. |
| POST | `/api/v1/life-readings` | `{ language?: "en"\|"hi" }` | Creates a `DRAFT`, returns `201`. |
| GET | `/api/v1/life-readings/:id` | — | Owner-scoped detail view including draft, assets, components, jobs, consents and latest report. |
| PATCH | `/api/v1/life-readings/:id` | Partial draft fields | Merges and encrypts the draft while status is `DRAFT`/`AWAITING_CONSENT`. |
| DELETE | `/api/v1/life-readings/:id` | — | Purges report content, palm assets, conversations and consents; keeps a `DELETED` tombstone. |
| GET | `/api/v1/life-readings/:id/status` | — | Summaries plus per-component and job status. |
| POST | `/api/v1/life-readings/:id/submit` | `{ consents }` | Validates the draft and consents, enqueues jobs, returns `202`. Missing required consent → `403 CONSENT_REQUIRED`. |
| POST | `/api/v1/life-readings/:id/tick` | `{}` | Local/demo helper: runs up to two due jobs for this reading. Owner only. Production uses the worker. |
| POST | `/api/v1/life-readings/:id/retry` | `{}` | Requeues terminal failed jobs, returns `202`. |
| POST | `/api/v1/life-readings/:id/cancel` | `{}` | Cancels queued/running work and the reading. |
| POST | `/api/v1/life-readings/:id/continue-without-palm` | `{}` | Marks palmistry skipped and continues with other methods. |
| GET | `/api/v1/life-readings/:id/:module` | — | `module` is `palmistry`, `numerology` or `astrology`. Returns that component only. |
| GET | `/api/v1/life-readings/:id/report` | — | Latest validated report (`report` is `null` when none). |
| POST | `/api/v1/life-readings/:id/share` | — | Creates a 30-day share token and URL. |
| GET | `/api/v1/life-readings/:id/report/:reportId/pdf` | — | PDF bytes. `503` when no Chrome/Edge renderer is available. |
| GET | `/api/v1/shares/:token` | — | Public, read-only report document for a valid unexpired share token. |

### Draft fields

Only include what you are changing. The server validates and merges.

```json
{
  "fullName": "Aarav Sharma",
  "preferredName": "Aarav",
  "dateOfBirth": "1990-05-15",
  "language": "en",
  "methods": ["PALMISTRY", "NUMEROLOGY", "ASTROLOGY"],
  "country": "India",
  "numerologySystem": "CHALDEAN",
  "numerologyName": "Aarav Sharma",
  "dominantHand": "RIGHT",
  "birthTime": "14:30",
  "birthTimeAccuracy": "EXACT",
  "birthplace": {
    "name": "New Delhi",
    "region": "Delhi",
    "country": "India",
    "latitude": 28.6139,
    "longitude": 77.209,
    "timezone": "Asia/Kolkata"
  },
  "step": 6
}
```

Notes:

- `numerologyName` must be a Latin-alphabet spelling; non-Latin scripts are rejected rather than transliterated automatically.
- `birthTimeAccuracy` is `EXACT`, `APPROXIMATE` or `UNKNOWN`. Exact/approximate require `birthTime`; all astrology requires a resolved `birthplace`.
- `PALMISTRY` requires `dominantHand`.
- The wizard normally writes each step; a complete PATCH is also accepted.

### Consent payload

```json
{
  "consents": {
    "PERSONAL_DATA_PROCESSING": true,
    "AI_PROCESSING": true,
    "PALM_IMAGE_PROCESSING": true,
    "SAVE_HISTORY": true,
    "PRODUCT_RESEARCH": false
  }
}
```

`PALM_IMAGE_PROCESSING` is required only when palmistry is selected. `PRODUCT_RESEARCH` is always optional and is never bundled into the required set. Partial payloads are accepted by the parser; the service returns `403 CONSENT_REQUIRED` with the missing purposes when a required purpose is absent or false.

## Uploads

Palm uploads are private and signed.

1. `POST /api/v1/uploads/presign`
2. Either local multipart completion or direct S3 `PUT` followed by completion without a file.

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| POST | `/api/v1/uploads/presign` | `{ readingId, assetType: "PALM_LEFT"\|"PALM_RIGHT", filename, mimeType, fileSize }` | Validates ownership/type/size and returns `{ assetId, uploadToken, expires, mode, uploadUrl }`. |
| POST | `/api/v1/uploads/complete` | `multipart/form-data`: `assetId`, `expires`, `token`, `file` (local mode) | Verifies the signature, validates/re-encodes the image, stores it, returns status. S3 mode omits `file`. |
| GET | `/api/v1/uploads/:id` | — | Owner-scoped asset metadata and signed preview URL. |
| DELETE | `/api/v1/uploads/:id` | — | Soft-deletes the asset and schedules storage deletion. |
| GET | `/api/v1/uploads/:id/file?expires=…&sig=…` | — | Owner + signature required. Streams the private image with `no-store`. Forged/expired signatures → `403`. |

Accepted formats: JPEG, PNG, WebP. Maximum 8 MiB; dimensions 480–6000 px. Content signature must match the declared MIME type. EXIF is stripped by re-encoding. A structurally valid but low-quality photo is accepted with `quality.status = "NEEDS_REUPLOAD"`; an invalid file is rejected.

## Conversations

| Method | Path | Body / query | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/conversations` | `?readingId=` | Lists the user's conversations with a short preview. |
| POST | `/api/v1/conversations` | `{ readingId, title? }` | Creates a conversation for an owned reading. |
| GET | `/api/v1/conversations/:id` | — | Messages in creation order. |
| DELETE | `/api/v1/conversations/:id` | — | Deletes the conversation and messages. |
| POST | `/api/v1/conversations/:id/messages` | `{ question }` | Requires `AI_PROCESSING` consent and a published report. Returns `text/plain` streamed chunks; the final answer is persisted. |

## Notifications

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/notifications` | — | Latest 50 notifications and unread count. |
| PATCH | `/api/v1/notifications` | `{ id }` or `{ all: true }` | Marks one or all as read. |

## Privacy

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/privacy/consents` | — | Current consent version, purposes and history. |
| PATCH | `/api/v1/privacy/consents` | `{ purpose, granted }` | Grants or withdraws one purpose. Essential purposes cannot be withdrawn while the account is active. |
| GET | `/api/v1/privacy/export` | — | Account, profile, readings, reports, consents and conversations as JSON. Rate limited to 3/hour. |
| POST | `/api/v1/privacy/deletion` | `{ confirm: "DELETE", password, readingId? }` | Password-confirmed. With `readingId` deletes one reading; otherwise deletes the account and purges readings. |

## Cities

| Method | Path | Query | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/cities` | `?q=` | Up to 20 seeded cities matching name/region/country, including coordinates and IANA timezone. |

## Admin

All endpoints require a session. Minimum roles are shown.

| Method | Path | Role | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/admin/overview` | SUPPORT | Today's users/readings/reports, failed jobs, month AI usage, recent readings and audit. |
| GET | `/api/v1/admin/readings` | SUPPORT | `?status=&q=`; up to 50 operational rows with masked user email. |
| GET | `/api/v1/admin/readings/:id` | SUPPORT | Operational detail; never returns report content or birth data. Viewing is audited. |
| GET | `/api/v1/admin/jobs` | SUPPORT | `?status=`; latest 100 jobs. |
| POST | `/api/v1/admin/jobs/:id/retry` | OPERATIONS_ADMIN | Requeues a `FAILED`/`DEAD`/`CANCELLED` job, `202`. |
| GET | `/api/v1/admin/users` | SUPPORT | `?q=`; latest 50 users with reading counts. |
| PATCH | `/api/v1/admin/users/:id/role` | SUPER_ADMIN | `{ role }`. A super admin cannot remove their own super-admin role. |
| GET | `/api/v1/admin/settings` | SUPPORT | Allowlisted settings plus AI provider status. |
| PATCH | `/api/v1/admin/settings` | OPERATIONS_ADMIN | `{ key, value }` for `ai`, `astrology`, `numerology`, `storage`, `reports`, `features`, `consent`, `retention`, `pdf`. Max 20 KB. |
| GET | `/api/v1/admin/audit` | OPERATIONS_ADMIN | Latest 100 safe audit entries. |

## Typical journey

```http
POST /api/v1/auth/register              → session cookie
POST /api/v1/life-readings              → { id }
PATCH /api/v1/life-readings/{id}        → draft saved (encrypted)
POST /api/v1/uploads/presign            → { assetId, uploadToken, expires, mode }
POST /api/v1/uploads/complete           → asset VALIDATED
POST /api/v1/life-readings/{id}/submit  → 202 QUEUED
[worker or repeated POST …/tick]
GET  /api/v1/life-readings/{id}/status  → COMPLETED / PARTIALLY_COMPLETED
GET  /api/v1/life-readings/{id}/report  → validated report document
GET  …/report/{reportId}/pdf            → application/pdf
POST /api/v1/life-readings/{id}/share   → { url }
POST /api/v1/conversations              → { id }
POST /api/v1/conversations/{id}/messages → streamed answer
GET  /api/v1/privacy/export             → JSON export
DELETE /api/v1/life-readings/{id}       → tombstone + purged content
```

## Status reference

Reading: `DRAFT`, `AWAITING_CONSENT`, `QUEUED`, `PROCESSING`, `READY`, `COMPLETED`, `PARTIALLY_COMPLETED`, `FAILED`, `CANCELLED`, `DELETED`.

Job: `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `DEAD`, `CANCELLED`.

Component: `PENDING`, `COMPLETED`, `LIMITED`, `FAILED`, `UNAVAILABLE`, `NOT_SELECTED`.
