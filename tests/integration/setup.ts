/**
 * Integration-test environment.
 *
 * Imported (for its side effects) before any application module. It points
 * Prisma at a disposable copy of the seeded development database so tests never
 * touch `prisma/dev.db` or a real deployment.
 *
 * The copy is created once and reused between runs; test data is namespaced and
 * removed by each suite.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const prismaDir = path.resolve(here, "../../prisma");
const tmpDir = path.join(prismaDir, ".tmp");
const target = path.join(tmpDir, "test.db");
const source = path.join(prismaDir, "dev.db");

mkdirSync(tmpDir, { recursive: true });
if (!existsSync(target)) {
  if (!existsSync(source)) {
    throw new Error(
      "Integration tests need a seeded database. Run `npm run db:seed` first (prisma/dev.db).",
    );
  }
  copyFileSync(source, target);
}

Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL: "file:./.tmp/test.db",
  AUTH_SECRET: process.env.AUTH_SECRET ?? "integration-test-secret-0123456789abcdef0123456789",
});
