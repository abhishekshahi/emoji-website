import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import {
  runSequentialD1Import,
  EXPECTED_RELATIONSHIPS,
  queryCount,
  getImportLockPath,
} from "@/lib/kaomoji/cloudflare/d1-import";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

function acquireLock(): void {
  writeFileSync(
    getImportLockPath(rootDir),
    JSON.stringify({ pid: process.pid, started_at: new Date().toISOString(), mode: "relationships-fast" }) + "\n",
    "utf8",
  );
}

function releaseLock(): void {
  try {
    unlinkSync(getImportLockPath(rootDir));
  } catch {
    /* ignore */
  }
}

async function main(): Promise<void> {
  if (!process.argv.includes("--remote") || !process.argv.includes("--resume")) {
    console.error("Usage: --remote --resume");
    process.exit(1);
  }

  process.env.PHASE19_D1_BATCH_SLEEP_MS ??= "0";
  process.env.PHASE19_D1_COMPACT_CHECKPOINT ??= "1";

  console.log("Phase 19 relationships-only fast import (concurrency=1, zero sleep)");

  acquireLock();
  process.on("exit", releaseLock);
  process.on("SIGINT", () => {
    releaseLock();
    process.exit(130);
  });

  const started = Date.now();
  let lastLog = 0;
  let lastIndex = -1;

  try {
    const progress = await runSequentialD1Import({
      rootDir,
      remote: true,
      fresh: false,
      resume: true,
      stopAfterTable: "relationship",
      onBatch: ({ table, index, total }) => {
        if (table !== "relationship") return;
        const now = Date.now();
        if (index % 10 === 0 || index === total - 1 || now - lastLog > 30_000) {
          lastLog = now;
          lastIndex = index;
          const elapsed = ((now - started) / 1000).toFixed(0);
          console.log(`[relationship] batch ${index + 1}/${total} elapsed=${elapsed}s`);
        }
      },
    });

    const rel = progress.relationship_count;
    const ok = rel === EXPECTED_RELATIONSHIPS;
    console.log("Relationships:", rel, "/", EXPECTED_RELATIONSHIPS, ok ? "PASS" : "INCOMPLETE");
    process.exit(ok ? 0 : 1);
  } catch (error) {
    const count = queryCount(rootDir, "relationship", true);
    console.error("Halted:", error instanceof Error ? error.message : error);
    console.error("Current relationship count:", count ?? "unknown");
    process.exit(1);
  }
}

void main();
