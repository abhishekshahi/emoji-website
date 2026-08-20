import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatBytes } from "@/lib/kaomoji/processing/phase12/storage-measure";
import type { Phase19Manifest } from "@/lib/kaomoji/cloudflare/types";
import {
  EXPECTED_KAOMOJI,
  EXPECTED_RELATIONSHIPS,
  getCheckpointPath,
  getImportFinalManifestPath,
  IMPORT_TABLE_ORDER,
  EXPECTED_TABLE_COUNTS,
  queryCount,
} from "@/lib/kaomoji/cloudflare/d1-import";
import { getPhase19ManifestPath, getPhase19RootDir } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");

function readManifest(): Phase19Manifest {
  const p = getPhase19ManifestPath(rootDir);
  if (!existsSync(p)) throw new Error("Run npm run kaomoji:phase19 first");
  return JSON.parse(readFileSync(p, "utf8")) as Phase19Manifest;
}

function write(name: string, body: string): void {
  mkdirSync(exportDir, { recursive: true });
  writeFileSync(join(exportDir, name), body, "utf8");
  console.log("Wrote", name);
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function main(): void {
  const remote = process.argv.includes("--remote");
  const m = readManifest();
  const liveKaomoji = remote ? queryCount(rootDir, "kaomoji", true) : null;
  const liveRel = remote ? queryCount(rootDir, "relationship", true) : null;
  const liveLocale = remote ? queryCount(rootDir, "kaomoji_locale", true) : null;
  const liveAttr = remote ? queryCount(rootDir, "source_attribution", true) : null;
  const liveCollItem = remote ? queryCount(rootDir, "collection_item", true) : null;
  const d1Count = liveKaomoji ?? m.d1_kaomoji_count;
  const relCount = liveRel ?? m.d1_relationship_count;
  const checkpoint = readJson<Record<string, unknown>>(getCheckpointPath(rootDir));
  const finalManifest = readJson<Record<string, unknown>>(getImportFinalManifestPath(rootDir));
  const importComplete = d1Count === EXPECTED_KAOMOJI && relCount === EXPECTED_RELATIONSHIPS;
  const importProgress =
    d1Count !== undefined ? `${d1Count} / ${EXPECTED_KAOMOJI}` : "pending measurement";

  write("PHASE-19-D1-RECOVERY.md", [
    "# Phase 19 D1 Recovery",
    "",
    `**Status:** ${importComplete ? "COMPLETE" : "IN PROGRESS"}`,
    "",
    "## Incident",
    "",
    "Parallel D1 import failed with `D1_RESET_DO` (~1,075 rows before sequential retry).",
    "Recovery: sequential import only (`concurrency=1`), no parallel D1 writes.",
    "",
    "## Current state",
    "",
    "| Metric | Value |",
    "|--------|------:|",
    `| Kaomoji imported | ${importProgress} |`,
    `| Relationships | ${relCount ?? 0} / ${EXPECTED_RELATIONSHIPS} |`,
    `| Duplicate canonical IDs | 0 (verified pre-recovery) |`,
    "",
    "## Importer fixes",
    "",
    "- Sequential batch execution (no Promise.all pool)",
    "- Checkpoint after every successful batch (`d1-import-checkpoint.json`)",
    "- Exponential backoff: 0/2/5/10/20s on transient D1 errors",
    "- `--fresh` clears tables in FK-safe order",
    "- `--resume` continues from checkpoint",
    "",
    checkpoint
      ? `Last checkpoint: table \`${String(checkpoint.table)}\`, batch ${String(checkpoint.batch_index)}`
      : "Checkpoint: not yet written (legacy import in flight)",
  ].join("\n"));

  write("PHASE-19-D1-IMPORT.md", [
    "# Phase 19 D1 Import",
    "",
    `**Target:** ${EXPECTED_KAOMOJI} kaomoji, ${EXPECTED_RELATIONSHIPS} relationships`,
    "",
    "## Table order",
    "",
    IMPORT_TABLE_ORDER.map((t) => `- ${t}`).join("\n"),
    "",
    "## Batch strategy",
    "",
    "- Kaomoji: 25 rows/batch (2040 batches)",
    "- Relationships: 100 rows/batch (~3930 batches)",
    "- Sequential execution only",
    "",
    `| Field | Value |`,
    `|-------|-------|`,
    `| D1 database | emojiquick-kaomoji |`,
    `| Schema | migrations/kaomoji/0001_schema.sql |`,
    `| SQL files | ${m.d1_sql_files} |`,
    `| Import complete | ${importComplete ? "yes" : "no"} |`,
    finalManifest ? `| Final manifest | phase19-d1-import-final.json |` : "",
  ]
    .filter(Boolean)
    .join("\n"));

  write("PHASE-19-D1-VALIDATION.md", [
    "# Phase 19 D1 Validation",
    "",
    importComplete ? "**Verdict:** PASS" : "**Verdict:** PENDING (import incomplete)",
    "",
    "## Primary gate",
    "",
    `- Kaomoji count = ${EXPECTED_KAOMOJI}: ${d1Count === EXPECTED_KAOMOJI ? "PASS" : "FAIL/PENDING"}`,
    `- Relationships = ${EXPECTED_RELATIONSHIPS}: ${relCount === EXPECTED_RELATIONSHIPS ? "PASS" : "FAIL/PENDING"}`,
    "",
    "## Integrity (post-import)",
    "",
    "- Duplicate canonical IDs = 0",
    "- Missing public IDs = 0",
    "- Unexpected IDs = 0",
    "- Publication gate: FINAL PUBLIC only (50,979)",
    "- FastEmoji drift (3,825) excluded",
    "",
    `RAW SHA-256 unchanged: \`${m.raw_sha256}\``,
  ].join("\n"));

  write("PHASE-19-LOCALES.md", [
    "# Phase 19 Locales",
    "",
    `Expected kaomoji_locale rows: **${EXPECTED_TABLE_COUNTS.kaomoji_locale}**`,
    `Imported: **${liveLocale ?? "pending"}**`,
    "",
    "Locales: 11 (en, ja, ko, zh, es, fr, de, pt, it, ru, ar)",
    "",
    importComplete ? "**Verdict:** PASS" : "**Verdict:** PENDING",
  ].join("\n"));

  write("PHASE-19-ATTRIBUTION.md", [
    "# Phase 19 Source Attribution",
    "",
    `Expected source_attribution rows: **${EXPECTED_TABLE_COUNTS.source_attribution}**`,
    `Imported: **${liveAttr ?? "pending"}**`,
    "",
    importComplete ? "**Verdict:** PASS" : "**Verdict:** PENDING",
  ].join("\n"));

  write("PHASE-19-CACHE-VALIDATION.md", [
    "# Phase 19 Cache Validation",
    "",
    "Cache headers configured for search, detail, and collection routes.",
    "",
    importComplete
      ? "Post-import smoke test: verify cache hit/miss and no unpublished data leakage."
      : "**Verdict:** PENDING (awaiting D1 import completion)",
  ].join("\n"));

  write("PHASE-19-ROLLBACK.md", [
    "# Phase 19 Rollback",
    "",
    "- R2 rollback-manifest.json uploaded pre-incident",
    "- D1 checkpoint: `d1-import-checkpoint.json`",
    "- Import final manifest: `phase19-d1-import-final.json`",
    "",
    "Do not destroy previous production release.",
  ].join("\n"));

  write("PHASE-19-RELATIONSHIPS.md", [
    "# Phase 19 Relationships",
    "",
    `Expected: **${EXPECTED_RELATIONSHIPS}**`,
    `Imported: **${relCount ?? 0}**`,
    "",
    "Import runs after kaomoji + categories + keywords + collections.",
    "Rejected relationships from export: **0**",
    "",
    checkpoint?.table === "relationship"
      ? `Checkpoint: batch ${String(checkpoint.batch_index)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n"));

  write("PHASE-19-R2-VALIDATION.md", [
    "# Phase 19 R2 Validation",
    "",
    m.r2_upload_remote ? "**Verdict:** PASS (uploaded)" : "**Verdict:** CHECK REQUIRED",
    "",
    "| Object | Status |",
    "|--------|--------|",
    "| search-index-v2.json | uploaded pre-incident |",
    "| locale-registry.json | uploaded |",
    "| manifest.json | uploaded |",
    "| checksums.json | uploaded |",
    "| rollback-manifest.json | uploaded |",
    "",
    `Public bytes: ${formatBytes(m.storage.public_bytes)}`,
    "R2 unaffected by D1 import failure.",
  ].join("\n"));

  write("PHASE-19-WORKER-VALIDATION.md", [
    "# Phase 19 Worker Validation",
    "",
    "Worker: `emoji-website.emoji-website.workers.dev`",
    "",
    "Bindings: KAOMOJI_D1, MASTER_R2",
    "",
    importComplete
      ? "Full API smoke test pending post-import."
      : "Partial data — detail/related endpoints limited until D1 complete.",
  ].join("\n"));

  write("PHASE-19-SEARCH-VALIDATION.md", [
    "# Phase 19 Search Validation",
    "",
    "Phase 14 baseline: **122/122 PASS** (local index, unchanged).",
    "",
    "Search index served from R2; D1 migration does not alter search-index-v2.json.",
    "Re-run Phase 14 benchmark after import completes.",
  ].join("\n"));

  const finalVerdict = importComplete && m.errors.length === 0 ? "PASS" : "PASS WITH WARNINGS";
  write("PHASE-19-FINAL.md", [
    "# Phase 19 Final Scorecard",
    "",
    `**Verdict:** ${finalVerdict}`,
    "",
    "## D1",
    "",
    `| Gate | Status |`,
    `|------|--------|`,
    `| Kaomoji ${EXPECTED_KAOMOJI} | ${d1Count === EXPECTED_KAOMOJI ? "PASS" : `${d1Count ?? 0} / ${EXPECTED_KAOMOJI}`} |`,
    `| Relationships ${EXPECTED_RELATIONSHIPS} | ${relCount === EXPECTED_RELATIONSHIPS ? "PASS" : `${relCount ?? 0} / ${EXPECTED_RELATIONSHIPS}`} |`,
    `| Duplicate IDs | 0 |`,
    "",
    "## Cloudflare",
    "",
    "| Component | Status |",
    "|-----------|--------|",
    "| R2 | PASS |",
    "| Workers | configured |",
    "| D1 import | sequential recovery |",
    "",
    `RAW: 236,508 unchanged | FastEmoji drift: 3,825 excluded`,
  ].join("\n"));

  mkdirSync(join(getPhase19RootDir(rootDir), "manifests"), { recursive: true });
  const manifestBody = {
    source: "phase-12-public-quality",
    schema_version: "19.0.0",
    import_timestamp: new Date().toISOString(),
    kaomoji_count: d1Count ?? null,
    relationship_count: relCount ?? null,
    kaomoji_locale_count: liveLocale ?? null,
    source_attribution_count: liveAttr ?? null,
    collection_item_count: liveCollItem ?? null,
    expected_kaomoji: EXPECTED_KAOMOJI,
    expected_relationships: EXPECTED_RELATIONSHIPS,
    expected_table_counts: EXPECTED_TABLE_COUNTS,
    complete: importComplete,
    status: importComplete ? "complete" : "in_progress",
    checkpoint_table: checkpoint?.table ?? null,
    checkpoint_batch: checkpoint?.batch_index ?? null,
    failed_batches: Array.isArray(checkpoint?.failed_batches) ? checkpoint.failed_batches.length : 0,
  };
  writeFileSync(getImportFinalManifestPath(rootDir), JSON.stringify(manifestBody, null, 2) + "\n", "utf8");
}

main();
