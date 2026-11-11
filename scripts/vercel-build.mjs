import { execSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Vercel build entry point.
 *
 * The repository keeps `prisma/schema.prisma` on SQLite so local development and
 * the test suite need no infrastructure. This script derives a PostgreSQL
 * variant (same models) into `prisma/.gen/`, generates the client from it, and
 * then builds Next.js. Nothing here mutates the committed schema.
 */
const root = process.cwd();
const sourcePath = path.join(root, "prisma", "schema.prisma");
const outputDir = path.join(root, "prisma", ".gen");
const outputPath = path.join(outputDir, "schema.prisma");

const source = await readFile(sourcePath, "utf8");
if (!source.includes('provider = "sqlite"')) {
  throw new Error("Expected the committed schema to use the sqlite provider.");
}

let generated = source.replace('provider = "sqlite"', 'provider = "postgresql"');

// Vercel functions run on Amazon Linux. Include both OpenSSL variants so the
// query engine resolves regardless of the current runtime image.
generated = generated.replace(/generator client \{[\s\S]*?\n\}/, (block) =>
  block.includes("binaryTargets")
    ? block
    : block.replace(
        /\n\}$/,
        '\n  binaryTargets = ["native", "rhel-openssl-1.1.x", "rhel-openssl-3.0.x"]\n}',
      ),
);

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, generated, "utf8");

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const run = (args) => execSync(`${npx} ${args}`, { stdio: "inherit", env: process.env, shell: true });

console.log("[vercel-build] generating PostgreSQL Prisma client");
run(`prisma generate --schema "${path.relative(root, outputPath)}"`);
console.log("[vercel-build] building Next.js");
run("next build");
