/**
 * Background worker for local and small deployments.
 *
 * The Next.js route handlers enqueue idempotent `BackgroundJob` rows; this
 * process claims and executes them. In production you can run one or more of
 * these processes behind a supervisor (systemd, Docker, Fly machines, ECS).
 * Jobs are claimed with a conditional update, so multiple workers are safe.
 *
 * Usage:
 *   npm run worker                # poll every 2s
 *   WORKER_POLL_MS=500 npm run worker
 *   npm run worker -- --once      # drain the queue and exit
 */
import { prisma } from "@/lib/database/prisma";
import { runDueJobs } from "@/jobs/runner";

const POLL_MS = Math.max(250, Number(process.env.WORKER_POLL_MS ?? 2_000));
const BATCH = Math.max(1, Math.min(Number(process.env.WORKER_BATCH ?? 3), 10));
const ONCE = process.argv.includes("--once");

let running = true;
let iterations = 0;

function log(message: string): void {
  const stamp = new Date().toISOString();
  console.log(`[worker ${stamp}] ${message}`);
}

async function shutdown(signal: string): Promise<void> {
  if (!running) return;
  running = false;
  log(`received ${signal}; finishing the current job and disconnecting`);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    log("DATABASE_URL is not set; using the Prisma default from .env");
  }
  log(`started (poll=${POLL_MS}ms, batch=${BATCH}${ONCE ? ", once" : ""})`);

  // The queue is empty most of the time; this loop intentionally stays simple
  // and observable rather than hiding state in a third-party scheduler.
  while (running) {
    iterations += 1;
    try {
      const ran = await runDueJobs({ limit: BATCH });
      if (ran > 0) log(`processed ${ran} job${ran === 1 ? "" : "s"}`);
    } catch (error) {
      log(`queue error: ${error instanceof Error ? error.message : "unknown"}`);
    }

    if (ONCE) {
      if (iterations === 1) {
        // Give retryable jobs one more pass in `--once` mode when they are due.
        await runDueJobs({ limit: BATCH }).catch(() => 0);
      }
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }

  await prisma.$disconnect().catch(() => undefined);
  log("stopped");
}

main().catch(async (error) => {
  console.error("[worker] fatal", error instanceof Error ? error.message : error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
