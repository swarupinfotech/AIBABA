# Implementation notes & verification

This document records what is actually implemented, how the deterministic parts were verified, and what remains deliberately limited.

## 1. Status

| Area | State |
| --- | --- |
| Scaffold, dependencies, environment validation | Complete |
| SQLite schema, migration, seed | Complete |
| Auth, sessions, RBAC, admin | Complete |
| Reading wizard, draft persistence, consents | Complete |
| Palm upload, validation, private storage | Complete |
| Deterministic numerology | Complete |
| Deterministic Vedic astrology, D1/D9, Dasha | Complete |
| AI providers, prompts, schema validation, safety pass | Complete |
| Job queue, worker, retries, idempotency | Complete |
| Report synthesis, history, chat, share, PDF | Complete |
| Privacy consent, export, deletion | Complete |
| North/South Indian chart UI with D1/D9 toggle | Complete |
| Unit + integration tests | 130 passing, 10 files |
| Live HTTP end-to-end journey | 18 steps passing |
| Standalone worker drain | Verified |
| TypeScript / ESLint / production build | Clean |
| PostgreSQL migration automation | Documented, not automated |
| Payments | Not implemented (disabled) |

## 2. Verified commands

Run from the repository root on Windows PowerShell (use `npm.cmd`/`npx.cmd` if `.ps1` execution is blocked):

```text
npx tsc --noEmit        → clean
npm run lint            → 0 errors, 0 warnings
npm test                → 10 files, 130 tests passed
npm run build           → compiled successfully, 46 routes generated
npm run worker -- --once → processed a real numerology + synthesis pair
npm run e2e             → all 18 journey steps passed
```

The report page was additionally server-rendered against a real completed astrology reading: HTTP `200`, chart label present, D9 toggle present, ascendant sign present, no data-integrity error.

The end-to-end journey (`tests/e2e/journey.ts`) exercises the real HTTP surface:

1. health endpoint;
2. registration and cookie session;
3. session verification;
4. draft creation;
5. wizard draft save;
6. signed palm presign + upload + validation;
7. forged image signature rejected;
8. partial consent refused with `403`;
9. full per-purpose consent and submission;
10. idempotent queue driven to completion;
11. report retrieved with all required sections;
12. follow-up chat answer streamed;
13. PDF downloaded (≈220 KB, starts with `%PDF-`);
14. share link created and opened;
15. history contains the reading;
16. optional research consent remains declined; export returns a timestamp;
17. sign-out, `401`, sign-in, report persistence;
18. deletion removes the report, palm asset and share link.

During verification the journey reported `PARTIALLY_COMPLETED` with `palm=LIMITED numerology=COMPLETED astrology=COMPLETED` — the intended default behavior of the local, non-vision provider.

## 3. Calculation verification

### Numerology

Known case: `John Smith`, born `1990-05-15`, reference date `2026-11-11`.

| System | Destiny raw | Destiny | Soul urge | Personality | Life path | Birth | Personal year | Personal month |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Chaldean | 35 | 8 | 8 | 9 | 3 | 6 | 3 | 5 |
| Pythagorean | 44 | 8 | 6 | 11 (master) | 3 | 6 | 3 | 5 |

- Life path: `15 → 6`, `5 → 5`, `1990 → 1`; `6 + 5 + 1 = 12 → 3`.
- 2027 personal year: `2027 → 11` (master preserved), `6 + 5 + 11 = 22`, another master number.
- Chaldean map never assigns 9 to a letter. Pythagorean maps A–I, J–R, S–Z in 1–9 cycles.
- Non-Latin names are rejected with `NON_LATIN_NAME` rather than transliterated automatically.
- Master numbers 11, 22 and 33 are preserved; compound numbers are retained for Chaldean.

### Astrology

Known case: `1990-05-15 14:30`, `Asia/Kolkata`, New Delhi (`28.6139, 77.209`), exact time.

- Lahiri ayanamsa J2000 anchor: `23.853056°`.
- Sidereal ascendant: Virgo `25.6304°`, Chitra nakshatra pada 1.
- Sun: Taurus `0.56°`, Krittika pada 2.
- Moon: Capricorn `1.90°`, Uttara Ashadha pada 2.
- Whole-sign first house: Virgo; 12 houses returned.
- Vimshottari current lord at birth: Rahu.
- D1 ascendant sign index matches Virgo; D9 placements are derived from the same longitudes.

Behavior by birth-time accuracy:

| Accuracy | Ascendant / houses | Dasha | D9 | Uncertainty |
| --- | --- | --- | --- | --- |
| `EXACT` | available | available | available | `LOW` |
| `APPROXIMATE` | available with a range | available | available | `MEDIUM` |
| `UNKNOWN` | `null` | `null` | `null` | `HIGH` |

For unknown time, date-only planetary signs and nakshatras remain available, and the Moon’s possible range is recorded. A stray time supplied with `UNKNOWN` is ignored rather than silently trusted.

### Palm quality gate

Synthetic test images are generated deterministically; the gate measures brightness, contrast, Laplacian variance and skin-tone coverage. A well-exposed, sharp, high-contrast frame scores `PASS`; a blank or over-bright frame returns `NEEDS_REUPLOAD` with specific issues. The gate never claims to identify palm lines.

## 4. Key implementation decisions

### Local database, portable schema

SQLite keeps the project runnable with no infrastructure. JSON is stored as validated strings in `String` columns so a PostgreSQL switch does not require application contract changes. Structured results are parsed and validated at every boundary.

### Deterministic calculations separate from language

`src/services/numerology` and `src/services/astrology` have no AI dependency. The orchestrator passes their validated outputs to prompts. The AI schema cannot introduce new planets, numbers or lines: the report document is validated, and the prompt forbids invention.

### Honest default AI

`AI_PROVIDER=local` is deterministic and offline. It cannot see images, so palm analysis is `LIMITED` with every feature `NOT_ASSESSED`. This is preferable to a fabricated palm reading. OpenAI and Gemini adapters exist for operators who configure keys; vision-capable models can then produce structured observations, still constrained by `PalmObservationSchema`.

### Job queue as database rows

Idempotency keys (`readingId:JOB_TYPE:version`) prevent duplicate work. Conditional claims make multiple workers safe. Retries use exponential backoff and a maximum attempt count. Component failures do not block valid components; synthesis labels missing pieces instead of filling them.

### Browser tick for local demos

Production uses `npm run worker`. The owner-only `/tick` endpoint lets the processing page advance the same queue during local development, avoiding a second terminal for a demo. It does not create a separate execution path.

### Encrypted drafts

`draftData`, `encryptedFullName` and `encryptedDateOfBirth` use AES-256-GCM. Drafts are decrypted only inside the service/job layer. This satisfies the requirement that PII in progress is encrypted at rest; broader field encryption remains a documented hardening option.

### Signed private assets

Palm images never receive public URLs. Local mode serves through an owner check plus HMAC signature; S3 mode uses private objects and presigned access. The HMAC binds scope, asset ID and expiry. Tampering or expiry returns `403`.

### Charts draw stored data only

`toKundliCharts` parses the stored calculation and returns `null` when no ascendant exists. `KundliChart` is a client component for the North/South and D1/D9 toggles, but it performs no astronomy. The server report page passes a serialisable object; `chart-data.ts` avoids a client-reference boundary error.

## 5. Deliberate limitations

- **D9 only.** Navamsa is computed and displayed. Other divisional charts are not approximated.
- **No transits synthesis.** Transit data is only described where validated data exists; the current flow does not calculate transits.
- **Lahiri approximation.** The ayanamsa is J2000 plus precession, not Swiss Ephemeris. The value is stored so results are reproducible and auditable.
- **Mean node.** The true node is not offered.
- **Whole-sign houses only.** No Placidus/KP/other house systems.
- **No palm line invention.** With the default provider, all palm features are `NOT_ASSESSED`.
- **No guaranteed predictions.** Prompts, schemas and safety checks forbid deterministic claims, fear pressure and medical/legal/financial advice.
- **PDF depends on a browser.** A missing Chrome/Edge yields a documented `503`.
- **Payments disabled.** No checkout, webhook or paid entitlement enforcement.
- **Rate limiting is in-process.** Replace with Redis before horizontal scaling.
- **Not every PII column is field-encrypted.** See `SECURITY-PRIVACY.md`.
- **No email verification, MFA or password reset yet.** Schema fields exist for verification; flows are not wired.

## 6. File map for reviewers

```
src/services/numerology/index.ts        deterministic engine, mappings, reduction
src/services/astrology/index.ts         ayanamsa, positions, nakshatras, houses, Dasha, D1/D9
src/services/image-analysis/validate.ts MIME/size/dimension/quality, re-encode
src/services/ai/schemas.ts              Zod contracts for every AI output
src/services/ai/local.ts                deterministic local interpreter
src/services/ai/index.ts                provider factory, budget, validation, safety
src/services/storage/index.ts           local + private S3 adapters
src/services/pdf/index.ts               HTML → PDF with embedded fonts
src/jobs/queue.ts                       idempotent enqueue, synthesis trigger
src/jobs/runner.ts                      claim, execute, retry, fail
src/jobs/handlers.ts                    palm/numerology/astrology/synthesis handlers
src/modules/life-reading/service.ts     ownership, drafts, submission, deletion
src/modules/life-reading/orchestrator.ts report assembly and publication
src/components/astrology/chart-data.ts  stored-data → drawable chart shape
src/components/astrology/KundliChart.tsx North/South, D1/D9 rendering
prisma/schema.prisma                    normalized relational model
tests/e2e/journey.ts                    full live journey
scripts/worker.ts                       supervised worker / --once drain
```

## 7. Recommended next steps

1. Add email verification, password reset and optional MFA.
2. Replace the in-memory limiter with Redis and add a CSP.
3. Add automated retention jobs for backups, logs and object versions.
4. Extend application-level encryption to birthplace, palm text and report content if required by the threat model.
5. Build a reviewed payment/entitlement flow before enabling `PAYMENTS_ENABLED`.
6. If a vision provider is enabled, evaluate palm observation quality against a labelled, consented test set and document its error modes.
7. Add transits only with a validated provider and the same “draw stored data only” rule.
8. Add browser-level UI tests once the visual language is final.
