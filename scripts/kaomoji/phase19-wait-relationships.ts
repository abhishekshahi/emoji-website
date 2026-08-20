import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPECTED_RELATIONSHIPS,
  loadCheckpoint,
  queryCount,
} from "@/lib/kaomoji/cloudflare/d1-import";
import { getPhase19RootDir } from "@/lib/kaomoji/storage/paths";
import { runWrangler } from "../r2/wrangler-r2";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const pollMs = Number(process.env.PHASE19_REL_POLL_MS ?? 120_000);
const nearDonePollMs = Number(process.env.PHASE19_REL_NEAR_DONE_POLL_MS ?? 30_000);
const RELATIONSHIP_BATCHES = 3930;
const NEAR_DONE_BATCH = 3800;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function queryScalar(sql: string): number | null {
  const result = runWrangler(
    ["d1", "execute", "emojiquick-kaomoji", "--remote", "--command", sql],
    rootDir,
  );
  if (!result.ok) return null;
  const match = result.stdout.match(/"c"\s*:\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

function stopMatchingProcesses(pattern: string): void {
  try {
    if (process.platform === "win32") {
      execSync(
        `powershell -NoProfile -Command "$p = Get-CimInstance Win32_Process -Filter \\"Name='node.exe'\\" | Where-Object { $_.CommandLine -match '${pattern}' }; foreach ($x in $p) { Stop-Process -Id $x.ProcessId -Force -ErrorAction SilentlyContinue }"`,
        { cwd: rootDir, stdio: "pipe" },
      );
      return;
    }
    execSync(`pkill -f "${pattern}" || true`, { cwd: rootDir, stdio: "pipe" });
  } catch {
    /* ignore */
  }
}

function haltPostRelationshipWriters(): void {
  console.log("Relationships complete — halting importer and finalize watcher (relationships-only scope)");
  stopMatchingProcesses("phase19-import-d1");
  stopMatchingProcesses("phase19-finalize-orchestrator");
}

async function main(): Promise<void> {
  console.log("Phase 19 relationships-only — waiting for:", EXPECTED_RELATIONSHIPS);

  while (true) {
    const count = queryCount(rootDir, "relationship", true);
    const checkpoint = loadCheckpoint(rootDir);
    const batchIndex = checkpoint?.table === "relationship" ? checkpoint.batch_index : RELATIONSHIP_BATCHES;
    const failed = checkpoint?.failed_batches?.length ?? 0;

    console.log(
      new Date().toISOString(),
      `relationship=${count ?? "?"}/${EXPECTED_RELATIONSHIPS}`,
      `batch=${batchIndex}/${RELATIONSHIP_BATCHES}`,
      `failed_batches=${failed}`,
    );

    if (count === EXPECTED_RELATIONSHIPS) {
      haltPostRelationshipWriters();
      break;
    }

    const interval = batchIndex >= NEAR_DONE_BATCH ? nearDonePollMs : pollMs;
    await sleep(interval);
  }

  const dup = queryScalar(
    `SELECT COUNT(*) AS c FROM (SELECT from_canonical_id, to_canonical_id, relationship_type, COUNT(*) AS n FROM relationship GROUP BY from_canonical_id, to_canonical_id, relationship_type HAVING n > 1)`,
  );
  const orphans = queryScalar(
    `SELECT COUNT(*) AS c FROM relationship r LEFT JOIN kaomoji k1 ON r.from_canonical_id = k1.canonical_id LEFT JOIN kaomoji k2 ON r.to_canonical_id = k2.canonical_id WHERE k1.canonical_id IS NULL OR k2.canonical_id IS NULL`,
  );
  const invalidType = queryScalar(
    `SELECT COUNT(*) AS c FROM relationship WHERE relationship_type IS NULL OR TRIM(relationship_type) = ''`,
  );
  const missingSource = queryScalar(
    `SELECT COUNT(*) AS c FROM relationship WHERE from_canonical_id IS NULL OR TRIM(from_canonical_id) = ''`,
  );
  const missingTarget = queryScalar(
    `SELECT COUNT(*) AS c FROM relationship WHERE to_canonical_id IS NULL OR TRIM(to_canonical_id) = ''`,
  );

  const finalCount = queryCount(rootDir, "relationship", true);
  const checkpoint = loadCheckpoint(rootDir);
  const errors: string[] = [];
  if (finalCount !== EXPECTED_RELATIONSHIPS) errors.push(`count ${finalCount} != ${EXPECTED_RELATIONSHIPS}`);
  if (dup !== 0) errors.push(`duplicate relationships: ${dup}`);
  if (orphans !== 0) errors.push(`orphan relationships: ${orphans}`);
  if (invalidType !== 0) errors.push(`invalid relationship types: ${invalidType}`);
  if (missingSource !== 0) errors.push(`missing source IDs: ${missingSource}`);
  if (missingTarget !== 0) errors.push(`missing target IDs: ${missingTarget}`);

  const report = {
    timestamp: new Date().toISOString(),
    step: "relationship-import-complete",
    relationship_count: finalCount,
    relationship_batches: RELATIONSHIP_BATCHES,
    failed_batches: checkpoint?.failed_batches ?? [],
    duplicate_relationships: dup,
    orphan_relationships: orphans,
    invalid_relationship_types: invalidType,
    missing_source_ids: missingSource,
    missing_target_ids: missingTarget,
    checkpoint,
    checkpoint_verified: finalCount === EXPECTED_RELATIONSHIPS && (checkpoint?.failed_batches?.length ?? 0) === 0,
    valid: errors.length === 0,
    errors,
  };

  const outDir = getPhase19RootDir(rootDir);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "relationship-step1-report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report, null, 2));

  if (!report.valid) process.exit(1);
  console.log("RELATIONSHIP IMPORT COMPLETE");
}

void main();
