import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    globals: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Integration suites share a disposable SQLite file; serialise files so
    // writes never contend for the same database lock.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
    },
  },
});
