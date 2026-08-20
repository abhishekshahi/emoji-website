import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import {
  runSequentialD1Import,
  EXPECTED_KAOMOJI,
  queryCount,
  getImportLockPath,
} from "@/lib/kaomoji/cloudflare/d1-import";
import { getPhase19ManifestPath } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

function acquireLock(): void {
  writeFileSync(
    getImportLockPath(rootDir),
    JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }) + "\n",
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
  const remote = process.argv.includes("--remote");
  const fresh = process.argv.includes("--fresh");
  const resume = process.argv.includes("--resume");
  const limit = process.argv.includes("--limit")
    ? Number(process.argv[process.argv.indexOf("--limit") + 1])
    : undefined;

  console.log("Phase 19 D1 sequential import (concurrency=1, no parallel writes)");
  console.log("Mode:", fresh ? "fresh" : resume ? "resume" : "continue");

  acquireLock();
  process.on("exit", releaseLock);
  process.on("SIGINT", () => {
    releaseLock();
    process.exit(130);
  });

  try {
    const progress = await runSequentialD1Import({
      rootDir,
      remote,
      fresh,
      resume: resume && !fresh,
      limit,
      onBatch: ({ table, index, total }) => {
        if (index % 25 === 0 || index === total - 1) {
          console.log(`  [${table}] batch ${index + 1}/${total}`);
        }
      },
    });

    console.log("Kaomoji:", progress.kaomoji_count, "/ expected", EXPECTED_KAOMOJI);
    console.log("Relationships:", progress.relationship_count);
    console.log("Complete:", progress.complete);

    const manifestPath = getPhase19ManifestPath(rootDir);
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
      manifest.d1_kaomoji_count = progress.kaomoji_count;
      manifest.d1_relationship_count = progress.relationship_count;
      manifest.d1_import_complete = progress.complete;
      manifest.d1_import_remote = remote;
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
    }

    process.exit(progress.complete ? 0 : 1);
  } catch (error) {
    const count = remote ? queryCount(rootDir, "kaomoji", true) : null;
    console.error("Import halted:", error instanceof Error ? error.message : error);
    console.error("Current kaomoji count:", count ?? "unknown");
    process.exit(1);
  }
}

void main();
