# Deployment

The repository runs locally with SQLite and no external services. A production deployment needs PostgreSQL, private object storage, a supervised worker and a Chrome/Edge binary for PDFs.

## 1. Local development

```bash
npm install
copy .env.example .env
npx prisma migrate deploy
npm run db:seed
npm run dev
```

The default `.env.example` works as-is for local development. Strong local secrets are only required when running `npm run build` or `NODE_ENV=production`.

Optional local checks:

```bash
npx tsc --noEmit
npm run lint
npm test
npm run worker -- --once
npm run e2e          # in a second terminal, with `npm run dev` running
```

## 2. Production prerequisites

| Component | Requirement |
| --- | --- |
| Node.js | 20+ (tested on Node 24) |
| Database | PostgreSQL 14+ |
| Object storage | Private S3-compatible bucket (AWS S3, Cloudflare R2, MinIO, etc.) |
| Worker | A long-running process for `npm run worker` |
| PDF | Chrome or Chromium/Edge installed in the runtime image |
| TLS | HTTPS termination at the platform or reverse proxy |
| Secrets | Managed secret store for `AUTH_SECRET`, `DATA_ENCRYPTION_KEY`, provider keys |

## 3. Environment

Start from `.env.example` and set at least:

```dotenv
NODE_ENV="production"
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/aibaba?schema=public"
NEXT_PUBLIC_APP_URL="https://your-domain.example"

AUTH_SECRET="<48+ random characters>"
DATA_ENCRYPTION_KEY="<base64-encoded 32 bytes>"

AI_PROVIDER="local"                 # or openai/gemini with server-side keys
STORAGE_PROVIDER="s3"
STORAGE_BUCKET="aibaba-private"
STORAGE_REGION="ap-south-1"
STORAGE_ACCESS_KEY="..."
STORAGE_SECRET_KEY="..."
# STORAGE_ENDPOINT=""               # set for MinIO/R2; enables path-style URLs

CHROMIUM_EXECUTABLE_PATH="/usr/bin/chromium"
EMAIL_PROVIDER="console"            # or resend
PAYMENTS_ENABLED="false"
```

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"     # DATA_ENCRYPTION_KEY
```

`NEXT_PUBLIC_APP_URL` must exactly match the public origin. It is used by same-origin CSRF checks and share links.

Production startup fails if `AUTH_SECRET` is the development default or starts with `change-me`. If `DATA_ENCRYPTION_KEY` is set and shorter than 32 characters, startup also fails.

**Key rotation:** changing `AUTH_SECRET` invalidates all sessions and, when no dedicated data key is present, makes encrypted fields unreadable. Changing `DATA_ENCRYPTION_KEY` makes existing encrypted drafts/birth fields unreadable. Rotate deliberately with a re-encryption migration.

## 4. Switch Prisma to PostgreSQL

The schema intentionally avoids provider-specific JSON types. To switch:

1. Change the datasource provider in `prisma/schema.prisma`:

   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. Generate a PostgreSQL baseline migration against an empty production database. The existing SQLite migration is SQLite syntax and should not be replayed on PostgreSQL.

   ```bash
   npx prisma migrate dev --name init_postgres
   # commit prisma/migrations/<timestamp>_init_postgres
   ```

   For an existing local database you do not need to preserve, `npx prisma db push` is acceptable for a first deployment. For a real migration, create the baseline and then apply it with `prisma migrate deploy`.

3. Run `npx prisma generate` and redeploy the app and worker.

4. Seed reference data and (optionally) demo accounts:

   ```bash
   npm run db:seed
   ```

   Set `SEED_DEMO_ACCOUNTS=false` in production and create your own administrator.

5. Indexes already exist for the common ownership, status, idempotency and timestamp lookups. Review query plans after importing real data; consider `jsonb` columns for large JSON payloads if you need database-side queries.

### Production database hygiene

- Use a least-privilege application role; migrations may use a separate role.
- Enable automated backups and point-in-time recovery.
- Enable encryption at rest (required because not every personal field is application-encrypted).
- Restrict network access to the app and worker.
- Do not run `prisma migrate dev` in production; use `prisma migrate deploy`.

## 5. Storage

### Vercel Blob (serverless)

Set `STORAGE_PROVIDER=vercel` and provide `BLOB_READ_WRITE_TOKEN` (the Vercel Blob integration injects it automatically). Blobs are written with `BLOB_ACCESS`, which defaults to `private`; reads happen server-side with the token and downloads still pass through `/api/v1/uploads/:id/file` with the owner check and HMAC signature. No blob URL is exposed to the browser.

The store must match `BLOB_ACCESS`: a private store rejects `access: "public"` writes and vice versa.

### S3-compatible (recommended)

Set `STORAGE_PROVIDER=s3` plus bucket, region and credentials. Objects are written with `ServerSideEncryption: AES256` and are never public. Uploads use a presigned `PUT`; previews use short-lived presigned `GET` URLs or the app’s signed route.

For MinIO, R2 or another S3-compatible service, set `STORAGE_ENDPOINT`; the adapter enables path-style addressing automatically.

Recommended bucket policy:

- block all public access;
- allow only the application credentials;
- enable versioning only if you have a deletion/retention policy that honours user deletion;
- add a lifecycle rule for abandoned multipart uploads;
- keep the bucket in the same jurisdiction as the database where possible.

### Local filesystem

`STORAGE_PROVIDER=local` writes under `STORAGE_DIR` or `./.data/uploads`. This is suitable for a single small instance with a persistent volume. Mount the volume outside the build output and back it up. Multiple app instances must not share a local volume without a shared filesystem.

## 6. Running the app

```bash
npm ci
npx prisma migrate deploy
npm run build
npm start
```

`next start` listens on port 3000 by default; put it behind TLS and set the platform port as needed.

Build-time note: `next build` runs with `NODE_ENV=production`, so the production `AUTH_SECRET` must be available during the build (or at least a strong placeholder). Do not build with the development default.

### Reverse proxy / platform

- Terminate TLS and redirect HTTP → HTTPS.
- Preserve the `Host`, `Origin` and `X-Forwarded-*` headers.
- Set request-body limits above the 8 MiB palm limit and 12 MiB server-action limit.
- Add HSTS at the proxy.
- Do not cache `/api/*` or private image responses.
- Health check: `GET /api/health` returns `200` only when the database is reachable.

## 7. Worker

Run at least one worker process:

```bash
npm run worker
```

Environment:

```dotenv
WORKER_POLL_MS="2000"
WORKER_BATCH="3"
```

Operational notes:

- The worker uses the same `DATABASE_URL`, storage and AI/provider settings as the web app.
- Multiple workers are safe: jobs are claimed with a conditional update and stale locks are recovered after 10 minutes.
- Scale workers horizontally for throughput; keep `WORKER_BATCH` modest to limit database contention.
- Supervise with systemd, Docker, Kubernetes, ECS, Fly Machines or your platform’s process manager. Restart on failure.
- Graceful shutdown handles `SIGINT`/`SIGTERM` and disconnects Prisma.
- `npm run worker -- --once` runs a bounded drain and exits; useful for cron or smoke tests.
- The web app’s `POST …/tick` endpoint is a local/demo convenience. Do not rely on browser traffic for production processing.
- Keep `tsx` available in the image (it is a dev dependency). If you use a production-only install, compile the worker or run it in a stage that includes dev dependencies.

## 8. PDF rendering

`puppeteer-core` uses an installed browser. Set `CHROMIUM_EXECUTABLE_PATH`, or install Chrome/Chromium/Edge in one of the auto-detected locations (see `src/services/pdf/index.ts`).

Docker example packages:

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium fonts-noto-core fonts-noto-devanagari ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
```

The app embeds its own Noto Sans and Noto Sans Devanagari fonts from `src/assets/fonts`, so Hindi report text does not depend on system fonts. `outputFileTracingIncludes` in `next.config.ts` ensures those fonts are present in the deployment bundle.

If no browser is found, the PDF endpoint returns `503` with a clear message. Run the end-to-end journey to verify PDF output after deployment.

Chromium sandboxing: in containers, run as a non-root user. If your platform cannot provide a sandbox, configure the browser launch flags in `src/services/pdf/index.ts` deliberately rather than disabling security globally.

## 9. Email and notifications

`EMAIL_PROVIDER=console` logs a message ID only. Set `EMAIL_PROVIDER=resend` and `EMAIL_API_KEY` to send email; configure a verified sender in `EMAIL_FROM`.

In-app notifications always work. Email failures are caught and must not fail the underlying job.

## 10. Payments

`PAYMENTS_ENABLED=false` by default. The Razorpay variables are placeholders; no checkout, webhook verification or entitlement enforcement is implemented. Do not enable payments until that flow is built and reviewed.

## 11. Rate limiting and caching

The default limiter is an in-memory fixed window. It is correct for a single process but not shared across instances. Before scaling horizontally, replace the adapter in `src/lib/rate-limit.ts` with Redis (`REDIS_URL` is reserved) or a platform limiter. Keep the same interface so route handlers are unchanged.

No Redis-backed cache is required today. Add one only when measured.

## 12. Backups, retention and deletion

- Back up PostgreSQL daily and test restores.
- Back up or version the private bucket only if you can honour deletion requests; otherwise use lifecycle deletion.
- Reading/account deletion removes database content and storage objects, but database backups and object versions persist until their retention window expires. Document that window in your privacy policy.
- Configure log retention and ensure application/provider logs never contain palm images, birth details or report content.
- Audit entries and job history may be retained for operational integrity; they must remain free of personal content.

## 13. Deployment checklist

- [ ] PostgreSQL provisioned, encrypted, backed up, least-privilege role.
- [ ] `DATABASE_URL` points at PostgreSQL and the schema provider is switched.
- [ ] Baseline migration applied with `prisma migrate deploy`.
- [ ] Strong `AUTH_SECRET` and `DATA_ENCRYPTION_KEY` loaded from a secret store.
- [ ] `NEXT_PUBLIC_APP_URL` equals the public HTTPS origin.
- [ ] Private S3 bucket configured; public access blocked.
- [ ] Worker running under a supervisor.
- [ ] Chrome/Edge installed; PDF export verified.
- [ ] `/api/health` monitored.
- [ ] TLS, HSTS, body-size limits and no-store API caching configured.
- [ ] Shared rate-limit adapter in place before multiple instances.
- [ ] Email sender verified or console mode accepted.
- [ ] Demo accounts disabled or passwords changed.
- [ ] Privacy policy, terms and consent text reviewed for the operating jurisdiction.
- [ ] Deletion and export flows tested against production configuration.
- [ ] Provider DPAs and data-residency requirements reviewed.

## 14. Vercel (serverless)

The repository ships a Vercel-specific build path. Local development and tests stay on SQLite; the deploy derives a PostgreSQL schema at build time without modifying the committed one.

### 14.1 How the build works

`npm run vercel-build` (Vercel detects the `vercel-build` script automatically) runs `scripts/vercel-build.mjs`, which:

1. copies `prisma/schema.prisma` to `prisma/.gen/schema.prisma`;
2. swaps the datasource provider to `postgresql` and adds `binaryTargets` for Vercel's Amazon Linux runtimes;
3. runs `prisma generate` from the generated schema;
4. runs `next build`.

`prisma/.gen/` is git-ignored. Never run `prisma migrate deploy` on Vercel against the SQLite migration folder; apply the schema once from your machine (see 14.4).

### 14.2 Environment variables

Set these in the Vercel project (Production and Preview):

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. Use the pooled URL when the provider offers one (Neon `-pooler`, Supabase port 6543). |
| `NEXT_PUBLIC_APP_URL` | The final HTTPS origin, e.g. `https://aibaba.vercel.app` |
| `AUTH_SECRET` | 48+ random characters |
| `DATA_ENCRYPTION_KEY` | base64-encoded 32 bytes |
| `STORAGE_PROVIDER` | `vercel` |
| `BLOB_READ_WRITE_TOKEN` | injected by the Vercel Blob integration |
| `BLOB_ACCESS` | `private` |
| `AI_PROVIDER` | `local` (or `openai` / `gemini` with keys) |
| `CRON_SECRET` | random string; Vercel sends it as a Bearer token to the cron route |
| `SEED_DEMO_ACCOUNTS` | `false` for anything public |

`NODE_ENV` is managed by Vercel; do not set it manually.

### 14.3 Services

- **Database** — Vercel Postgres (Neon-backed) from the Marketplace, or any PostgreSQL 14+ instance.
- **Blob** — a private Vercel Blob store connected to the project.
- **PDF** — `@sparticuz/chromium` is bundled; `pdfAvailable()` reports `true` on Vercel and the browser is unpacked to `/tmp` on first render. Expect the first PDF request to be slow.
- **Queue** — there is no long-running worker. The processing page advances its own reading through the owner-only `tick` endpoint, and `vercel.json` schedules a daily `GET /api/cron/jobs` (authenticated with `CRON_SECRET`) to drain anything left behind. On Hobby plans keep the daily schedule; per-minute crons require a plan that allows them.

### 14.4 First-time database setup

From a machine that holds the production `DATABASE_URL`:

```bash
npm run vercel-build          # generates the PostgreSQL client and builds
npx prisma db push --schema prisma/.gen/schema.prisma
DATABASE_URL="<prod url>" SEED_DEMO_ACCOUNTS=false npx tsx prisma/seed.ts
npx prisma generate           # restore the local SQLite client afterwards
```

`db push` creates the schema in an empty database. For schema evolution after launch, generate a PostgreSQL baseline migration from `prisma/.gen/schema.prisma` and switch to `prisma migrate deploy`.

### 14.5 Deploy and verify

```bash
vercel link
vercel --prod
```

Verify, in order: `GET /api/health` returns `200`; registration works; a palm upload completes and the preview renders through the signed route; a reading reaches `PARTIALLY_COMPLETED`; the PDF downloads; a share link opens; deletion removes the reading and its blob.

### 14.6 Serverless limits

- Request duration caps apply to `tick` and PDF rendering. The local AI provider is fast, but a vision provider or large PDF can exceed the limit; on failure the reading stays retryable.
- Serverless instances do not share memory, so the in-memory rate limiter is per-instance on Vercel. Replace it with Redis before real traffic.
- `sharp` and Prisma run on the Node.js runtime; do not switch those routes to the Edge runtime.
