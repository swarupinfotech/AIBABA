# Security & privacy

This document describes the controls implemented in the codebase and the gaps that still require deployment-level decisions. It is not a legal privacy policy; see the `/privacy` and `/terms` pages for user-facing text.

## 1. Data inventory

| Category | Examples | Storage |
| --- | --- | --- |
| Account | Email, name, hashed password, role, preferred language | `User` |
| Session | Random token (cookie), SHA-256 hash, expiry, revocation | `Session` |
| Profile | Display name, country, timezone | `UserProfile` |
| Reading draft | Full name, birth date/time, place, method choices, consent choices | `CompleteReading.draftData` — encrypted |
| Birth profile | Full name and date of birth — encrypted; time, place, coordinates, timezone — plain | `BirthProfile` |
| Palm images | Re-encoded JPEG/PNG/WebP | Private local filesystem or private S3 object |
| Palm analysis | Observations, interpretation, quality metadata | `PalmAnalysis` JSON (plain at application level) |
| Numerology / astrology | Deterministic inputs, settings and results | `NumerologyAnalysis`, `AstrologyCalculation` JSON |
| Report | Validated report document, prompt/model versions | `CompleteLifeReport` |
| Conversations | Questions and answers | `AIConversation`, `AIMessage` |
| Consent | Purpose, version, grant/withdraw timestamps | `ConsentRecord` |
| Operations | Job state, audit entries, notifications, deletion requests | `BackgroundJob`, `AuditLog`, `Notification`, `DataDeletionRequest` |

Personal data is deliberately minimised: no phone number, address, government ID, payment instrument or precise device fingerprint is collected in the current flow.

## 2. Authentication and sessions

- Passwords are hashed with bcrypt (`bcryptjs`), cost factor configured in `src/lib/auth/password.ts`.
- Sessions are opaque random tokens stored only as SHA-256 hashes in the database.
- Cookies are `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` when `NODE_ENV=production`. TTL: 30 days.
- Logout revokes the session row and clears the cookie. Account deletion revokes all sessions.
- Expired or revoked sessions resolve to no user. Disabled accounts (`accountStatus !== ACTIVE`) are treated as logged out.
- Login is rate limited to 10 attempts per 15 minutes; registration to 8 per 15 minutes.
- Registration requires explicit acceptance of terms and starts a session only after creation.

### CSRF

Cookie-authenticated mutating routes call `assertSameOrigin`. If an `Origin` header is present, its host must match either the request host or `NEXT_PUBLIC_APP_URL`; otherwise the request is rejected with `403`. Login/registration and share reads are safe methods or intentionally public. `SameSite=Lax` and JSON-only bodies provide additional defence.

## 3. Authorization

Role hierarchy: `USER < SUPPORT < CONTENT_EDITOR < OPERATIONS_ADMIN < SUPER_ADMIN`.

- Every reading, asset, conversation and report lookup is scoped by `userId` in the service layer.
- A foreign ID returns `404`, not `403`, to avoid confirming existence.
- Admin read endpoints require at least `SUPPORT`; job retries and setting writes require `OPERATIONS_ADMIN`; role changes require `SUPER_ADMIN`.
- A super admin cannot demote their own account.
- Admin reading views return operational metadata only — no birth data, draft, report body or palm image.
- Admin views, retries and setting changes are audited.
- Page routes enforce the same hierarchy with `pageRole` and redirect unauthorised users.

## 4. Encryption and secrets

### Application-level encryption

`src/lib/security/crypto.ts` implements AES-256-GCM with:

- a random 12-byte IV per value;
- a version prefix (`v1.`);
- an authentication tag, so tampering fails closed;
- a dedicated `DATA_ENCRYPTION_KEY` (base64, 32 bytes) when provided, otherwise a key derived with SHA-256 from `AUTH_SECRET` under a separate context string.

Encrypted fields today:

- `CompleteReading.draftData` (the full wizard draft, including name, birth data and place);
- `BirthProfile.encryptedFullName`;
- `BirthProfile.encryptedDateOfBirth`.

Other personal or sensitive columns (email, account name, birthplace name, coordinates, structured calculations, palm observations, reports and chat content) are not field-encrypted. Production must therefore rely on database/disk encryption, restricted network access and least-privilege credentials. Field-level encryption can be extended without changing the envelope format.

### Secrets

- `AUTH_SECRET` must be at least 32 characters. Production startup rejects the built-in development value or a `change-me…` value.
- `DATA_ENCRYPTION_KEY` should be a base64-encoded 32-byte key from a managed secret store.
- Rotating `AUTH_SECRET` or `DATA_ENCRYPTION_KEY` invalidates sessions and makes previously encrypted fields unreadable. Plan a migration before rotation.
- Provider keys (OpenAI, Gemini, S3, Resend, Razorpay) are read server-side only and never sent to the browser.
- `.env` is git-ignored. `.env.example` contains no real credentials.

## 5. Palm image handling

1. Presign validates reading ownership, MIME allowlist, extension and size.
2. Upload completion verifies the HMAC signature and upload token/expiry.
3. The declared MIME type must match the file signature. Mismatches are rejected.
4. Dimensions must be 480–6000 px; files over 8 MiB are rejected before decode.
5. The image is re-encoded with `sharp`, which strips EXIF/metadata, and stored under a server-generated key.
6. A SHA-256 checksum and measured quality are stored.
7. Objects are private. Local storage is served only through `/api/v1/uploads/:id/file` with an owner check **and** a short-lived HMAC signature (15 minutes). S3 objects are private and use presigned URLs or the same signed route.
8. Object keys are validated against a strict pattern and path traversal (`..`, absolute paths) is rejected.
9. Deletion removes the object and marks the asset `DELETED`.

Palm photographs are never used for identity recognition, biometric identification or unrelated sensitive-trait inference. Prompts explicitly forbid these uses. With an external vision provider, the photograph is transmitted to that provider when palm analysis runs; this is covered by the palm/AI consent purposes and must be reflected in the provider agreement.

## 6. Consent model

Purposes (`CONSENT_VERSION = 2026-11-v1`):

| Purpose | Required for |
| --- | --- |
| `PERSONAL_DATA_PROCESSING` | Any reading |
| `AI_PROCESSING` | Interpretation and follow-up chat |
| `PALM_IMAGE_PROCESSING` | Palm upload and analysis |
| `SAVE_HISTORY` | Saved readings |
| `PRODUCT_RESEARCH` | Optional; never required |

Rules:

- Required purposes are computed from the selected methods.
- Submission without a required purpose is refused with `403 CONSENT_REQUIRED` and the missing purposes listed.
- Each purpose is stored separately with its version and timestamp. Declining research consent is recorded explicitly.
- `PRODUCT_RESEARCH` is never bundled into the essential set.
- Settings allows withdrawing optional consents. Essential purposes cannot be withdrawn while the account remains active; the UI directs the user to delete the reading/account instead.
- Follow-up chat re-checks `AI_PROCESSING` consent on every message.

## 7. Data minimisation in AI calls

- The model receives validated calculation results, validated palm observations (or the image, for vision tasks) and the selected language.
- The model is instructed to explain, not calculate or observe.
- Prompts forbid inventing lines, positions, numbers, Dasha periods or chart placements, and forbid medical/legal/financial advice and guaranteed predictions.
- Responses are validated against strict Zod schemas; unsafe or malformed output fails the job rather than being stored.
- A separate safety pass reviews generated text.
- Token usage and estimated cost are recorded; a monthly budget can block external calls.
- Notifications and logs never include birth details, images or report content. Audit metadata is limited to operational identifiers and counts.
- The default `local` provider makes no network call and cannot see images, so palm output is honestly `LIMITED`.

## 8. Retention and deletion

- Deleting a reading sets it to `DELETION_PENDING`, then in a transaction removes reports, palm analysis, numerology, astrology, consents, shares, notifications and conversations; it clears the encrypted draft, detaches and optionally deletes the birth profile, soft-deletes assets and deletes storage objects. A `DELETED` tombstone remains with no personal content.
- Deleting an account requires the password and the literal confirmation `DELETE`. It deletes every reading, revokes sessions, anonymises the account row, clears the profile, removes conversations/notifications, and records a completed deletion request with the actor cleared.
- `ReportShare` links are time-limited (30 days default) and can be revoked; they return `404` after expiry or revocation.
- Job and audit rows may remain for operational integrity; they must not contain personal content (enforced by convention and review).

Deployment-level retention (backups, object-store lifecycle, log rotation, database snapshots) is not automated here. Configure it in the hosting platform and document the backup deletion window.

## 9. Audit logging

`audit()` appends events such as registration, login, submission, report generation, deletion, consent changes, admin views/retries/settings and role changes. It records:

- actor user ID (or `null` after account deletion);
- action and resource type/ID;
- a small safe metadata object;
- a SHA-256 hash of the IP address (never the raw IP).

Audit writes never block user flows; failures are logged to the server console.

## 10. Transport and browser hardening

`next.config.ts` sets:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- `Cache-Control: no-store` for `/api/*`
- API JSON responses are not cached; private image responses use `private, no-store`.

Run production behind TLS and add HSTS at the reverse proxy or platform. Consider adding a Content-Security-Policy once third-party scripts are finalised.

## 11. Logging and error handling

- Clients receive stable error codes and safe messages. Stack traces, SQL and provider payloads are not returned.
- Unknown errors are logged server-side with a short message.
- The health endpoint exposes only status, database reachability, latency and a timestamp.
- Provider responses are not written to logs. AI usage stores token/cost metadata, not content.

## 12. Known gaps and production recommendations

1. **Rate limiting is per-process.** Replace the in-memory map with Redis (the `REDIS_URL` variable exists) before running multiple instances.
2. **Not all PII is field-encrypted.** Enable database/volume encryption and restrict snapshots; extend field encryption to birthplace, palm text and report content if the threat model requires it.
3. **No email verification.** `emailVerifiedAt` exists but the flow is not wired. Add verification before enabling paid or public use.
4. **No MFA and no password-reset flow.** Add both for production.
5. **No automated retention job.** Backups, logs and object storage need lifecycle rules.
6. **No CSP yet.** Add after asset/script origins are fixed.
7. **External providers require a DPA.** Confirm data residency, retention and training opt-out with OpenAI/Gemini/S3/Resend.
8. **Payments are disabled.** No PCI scope exists today; introducing payments requires a separate design.
9. **Secrets management.** Use a managed secret store rather than `.env` files on servers.
10. **Incident response.** Define who can access the database, how breaches are detected, and how users are notified.
