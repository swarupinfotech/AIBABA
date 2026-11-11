# AIBABA — Complete Life Reading

A working full-stack product for a combined **palmistry, numerology and Vedic astrology** reading. It keeps three kinds of information visibly separate:

1. **Deterministic calculations** — Chaldean and Pythagorean numerology, sidereal Vedic positions, D1/D9 charts, whole-sign houses and Vimshottari Dasha.
2. **Observations** — only features visible in an uploaded palm photograph, each with a visibility status and confidence.
3. **Interpretation** — schema-validated, clearly labelled language from the local interpreter or a configured OpenAI/Gemini provider.

The application never substitutes invented lines, planetary positions, numbers, Dasha periods or provider responses when data is missing. Unknown birth time withholds time-dependent astrology; an unusable photograph produces a `LIMITED` palm reading with every feature `NOT_ASSESSED`.

> This is a traditional-interpretation product, not a scientific measurement or a prediction service. Reports do not guarantee events or provide medical, legal or financial advice.

## What is included

- Public landing, methodology, privacy and terms pages.
- Account registration, login, logout, session persistence and profile settings.
- Six-step guided reading wizard with encrypted draft saving.
- Signed, private palm uploads with image-signature, dimension, size, quality and EXIF checks.
- Deterministic numerology with stored mappings, inputs, steps and results.
- Sidereal Vedic astrology using `astronomy-engine`, Lahiri ayanamsa, mean node and whole-sign houses.
- North Indian and South Indian chart drawing with D1 rashi / D9 navamsa toggle.
- Consent-gated submission and a retryable, idempotent database-backed job queue.
- A 12-section combined report, follow-up chat, share links and PDF export with Hindi/Devanagari fonts.
- Reading history, notifications, per-purpose privacy settings, data export and deletion.
- Admin area: overview, readings, jobs, users, settings and audit log.
- 130 unit/integration tests, an 18-step live HTTP journey and a standalone worker.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js `16.4.6` App Router, React `19.3.0` |
| Language | TypeScript strict |
| Styling | Tailwind CSS v4 with the custom Midnight/Indigo/Gold palette |
| Database | Prisma `6.19.3`, SQLite locally, PostgreSQL for production |
| Astronomy | `astronomy-engine` `2.1.19` |
| AI | Local deterministic provider (default), OpenAI and Gemini adapters |
| Images | `sharp` validation, re-encoding and quality measurement |
| PDF | `puppeteer-core` + installed Chrome/Edge, embedded Noto Sans fonts |
| Tests | Vitest, live HTTP end-to-end script |

## Quick start

Requires Node.js 20+ (tested on Node 24), npm, and a seeded SQLite database.

```bash
npm install
copy .env.example .env          # Windows; use `cp` elsewhere
npx prisma migrate deploy       # or `npm run db:push` for a fresh local DB
npm run db:seed
npm run dev
```

Open <http://localhost:3000>.

The development database ships with two accounts:

| Account | Email | Password |
| --- | --- | --- |
| Demo user | `demo@aibaba.app` | `Aibaba@2026` |
| Super admin | `admin@aibaba.app` | `AibabaAdmin@2026` |

Change these before any shared or public deployment, or set `SEED_DEMO_ACCOUNTS=false` and seed your own administrator.

### Useful commands

```bash
npm run dev          # Next.js development server
npm run build        # production build
npm start            # serve the production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # Vitest unit + integration suites
npm run e2e          # live HTTP journey (server must be running)
npm run worker       # background job worker
npm run worker -- --once   # drain the queue once and exit
npm run db:seed      # seed cities, plans, settings and demo accounts
```

## How a reading flows

```
Register / sign in
  → create draft (PII encrypted at rest)
  → save wizard answers + consents
  → upload palm photo (presigned, signed download)
  → submit
  → idempotent jobs: palm analyze → numerology → astrology → report synthesis
  → processing page polls status / browser ticks the queue locally
  → report, PDF, share link, follow-up chat
  → export or delete
```

In production, run `npm run worker` as a supervised process. During local development the browser may call `POST /api/v1/life-readings/[id]/tick` to advance the same queue; it is an owner-only convenience, not a replacement for the worker.

## Repository map

```
src/app/                 Routes, page shells and API v1 handlers
src/components/          UI: wizard, report, chart, admin, settings
src/jobs/                Queue, worker runner, job handlers
src/lib/                 Auth, crypto, validation, env, API helpers
src/modules/             Life-reading domain services and views
src/services/            AI, astrology, numerology, storage, PDF, uploads
prisma/                  Schema, migration, seed, local dev.db
tests/unit               Deterministic and validation tests
tests/integration        Ownership, RBAC, encryption, deletion tests
tests/e2e                Full HTTP journey against a running server
docs/                    Architecture, API, security, deployment, implementation
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [HTTP API](docs/API.md)
- [Security & privacy](docs/SECURITY-PRIVACY.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Implementation notes & verification](docs/IMPLEMENTATION.md)

## Environment

Configuration is validated at startup by `src/lib/env.ts`. Production refuses the development `AUTH_SECRET`. Start from `.env.example`; never commit `.env`.

Key variables: `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`, `AUTH_SECRET`, `DATA_ENCRYPTION_KEY`, `AI_PROVIDER`, `STORAGE_PROVIDER`, `CHROMIUM_EXECUTABLE_PATH`, `PAYMENTS_ENABLED`.

## Known limits

- The default `local` AI provider has no vision capability. Palm observations are therefore `LIMITED` and all features are `NOT_ASSESSED`; numerology and astrology interpretations are still produced deterministically.
- Lahiri ayanamsa is an approximation (J2000 value plus IAU precession), not a Swiss Ephemeris call. The value used is stored with every reading.
- D9 navamsa is derived from the same stored longitudes. Other divisional charts and transits are not calculated.
- PDF export requires Chrome or Edge; without it the endpoint returns a documented `503`.
- Payments are disabled by default and no payment flow is wired.
- SQLite is for local development. Production requires the documented PostgreSQL switch and a shared rate-limit store.

## License

Private product code. Third-party licenses remain with their packages; see `node_modules` metadata for `astronomy-engine`, Prisma, Next.js, Noto fonts and other dependencies.
