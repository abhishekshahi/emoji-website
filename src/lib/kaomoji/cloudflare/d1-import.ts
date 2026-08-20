import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { runWrangler } from "../../../../scripts/r2/wrangler-r2";
import { getPhase19ExportDir, getPhase19RootDir } from "../storage/paths";

export const D1_DB_NAME = "emojiquick-kaomoji" as const;
export const EXPECTED_KAOMOJI = 50979 as const;
export const EXPECTED_RELATIONSHIPS = 392904 as const;
export const BACKOFF_MS = [0, 2000, 5000, 10000, 20000, 30000, 60000] as const;
export const KAOMOJI_ROWS_PER_BATCH = 25 as const;
export const RELATIONSHIP_ROWS_PER_BATCH = 100 as const;
export const DEFAULT_ROWS_PER_BATCH = 500 as const;

/** Sequential import order — base tables before junction/dependent rows. */
export const IMPORT_TABLE_ORDER = [
  "category",
  "keyword",
  "kaomoji",
  "kaomoji_category",
  "kaomoji_keyword",
  "collection",
  "collection_item",
  "relationship",
  "search_metadata",
  "kaomoji_locale",
  "source_attribution",
  "production_release",
] as const;

export type ImportTable = (typeof IMPORT_TABLE_ORDER)[number];

/** Expected remote row counts per table (from production export). */
export const EXPECTED_TABLE_COUNTS: Readonly<Record<ImportTable, number>> = {
  category: 56,
  keyword: 998,
  kaomoji: EXPECTED_KAOMOJI,
  kaomoji_category: 131_314,
  kaomoji_keyword: 383_621,
  collection: 20,
  collection_item: 4400,
  relationship: EXPECTED_RELATIONSHIPS,
  search_metadata: 4,
  kaomoji_locale: 198_799,
  source_attribution: 60_165,
  production_release: 1,
};

/** Rows per SQL batch file (must match export batch sizes). */
export const ROWS_PER_BATCH: Readonly<Partial<Record<ImportTable, number>>> = {
  kaomoji: KAOMOJI_ROWS_PER_BATCH,
  relationship: RELATIONSHIP_ROWS_PER_BATCH,
};

const CLEAR_SQL = [
  "DELETE FROM source_attribution;",
  "DELETE FROM production_release;",
  "DELETE FROM kaomoji_locale;",
  "DELETE FROM search_metadata;",
  "DELETE FROM relationship;",
  "DELETE FROM collection_item;",
  "DELETE FROM collection;",
  "DELETE FROM kaomoji_keyword;",
  "DELETE FROM keyword;",
  "DELETE FROM kaomoji_category;",
  "DELETE FROM kaomoji;",
  "DELETE FROM category;",
];

export interface D1ImportCheckpoint {
  readonly version: 1;
  readonly started_at: string;
  readonly updated_at: string;
  readonly fresh: boolean;
  readonly remote: boolean;
  readonly table: ImportTable;
  readonly table_index: number;
  readonly batch_index: number;
  readonly completed_batches: number;
  readonly failed_batches: readonly FailedBatch[];
  readonly last_success_file: string | null;
}

export interface FailedBatch {
  readonly table: ImportTable;
  readonly file: string;
  readonly error: string;
  readonly attempts: number;
  readonly timestamp: string;
}

export interface D1ImportProgress {
  readonly checkpoint: D1ImportCheckpoint;
  readonly kaomoji_count: number | null;
  readonly relationship_count: number | null;
  readonly complete: boolean;
}

export function getCheckpointPath(rootDir: string): string {
  return join(getPhase19RootDir(rootDir), "d1-import-checkpoint.json");
}

export function getImportLockPath(rootDir: string): string {
  return join(getPhase19RootDir(rootDir), "d1-import.lock");
}

export function getImportLogPath(rootDir: string): string {
  return join(getPhase19RootDir(rootDir), "d1-import-orchestrator.log");
}

export function getImportFinalManifestPath(rootDir: string): string {
  return join(getPhase19RootDir(rootDir), "phase19-d1-import-final.json");
}

export function loadCheckpoint(rootDir: string): D1ImportCheckpoint | null {
  const p = getCheckpointPath(rootDir);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as D1ImportCheckpoint;
}

export function saveCheckpoint(rootDir: string, checkpoint: D1ImportCheckpoint): void {
  const p = getCheckpointPath(rootDir);
  mkdirSync(join(p, ".."), { recursive: true });
  const compact = process.env.PHASE19_D1_COMPACT_CHECKPOINT === "1";
  writeFileSync(p, (compact ? JSON.stringify(checkpoint) : JSON.stringify(checkpoint, null, 2)) + "\n", "utf8");
}

export function collectSqlFiles(d1Dir: string, table: string): string[] {
  const tableDir = join(d1Dir, table);
  if (!existsSync(tableDir)) return [];
  return readdirSync(tableDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => join(tableDir, f));
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function executeSqlFile(
  rootDir: string,
  file: string,
  remote: boolean,
): { ok: boolean; output: string } {
  let target = file;
  let tmp: string | null = null;
  try {
    if (process.env.PHASE19_D1_OR_IGNORE === "1") {
      tmp = join(tmpdir(), `phase19-orignore-${basename(file)}-${process.pid}.sql`);
      const sql = readFileSync(file, "utf8").replace(/^INSERT INTO/im, "INSERT OR IGNORE INTO");
      writeFileSync(tmp, sql, "utf8");
      target = tmp;
    }
    const args = ["d1", "execute", D1_DB_NAME, "--file", target];
    if (remote) args.push("--remote");
    const result = runWrangler(args, rootDir);
    return { ok: result.ok, output: `${result.stdout}\n${result.stderr}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, output: message };
  } finally {
    if (tmp) {
      try {
        unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  }
}

export function executeCommand(rootDir: string, sql: string, remote: boolean): boolean {
  const args = ["d1", "execute", D1_DB_NAME, "--command", sql];
  if (remote) args.push("--remote");
  return runWrangler(args, rootDir).ok;
}

export function queryCount(rootDir: string, table: string, remote: boolean): number | null {
  const args = ["d1", "execute", D1_DB_NAME, "--command", `SELECT COUNT(*) AS c FROM ${table}`];
  if (remote) args.push("--remote");
  const result = runWrangler(args, rootDir);
  if (!result.ok) return null;
  const match = result.stdout.match(/"c"\s*:\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

export function queryDuplicateCanonicalIds(
  rootDir: string,
  remote: boolean,
): number | null {
  const sql =
    "SELECT COUNT(*) AS c FROM (SELECT canonical_id FROM kaomoji GROUP BY canonical_id HAVING COUNT(*) > 1)";
  const args = ["d1", "execute", D1_DB_NAME, "--command", sql];
  if (remote) args.push("--remote");
  const result = runWrangler(args, rootDir);
  if (!result.ok) return null;
  const match = result.stdout.match(/"c"\s*:\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

export function isImportComplete(rootDir: string, remote: boolean): boolean {
  const k = queryCount(rootDir, "kaomoji", remote);
  const r = queryCount(rootDir, "relationship", remote);
  return k === EXPECTED_KAOMOJI && r === EXPECTED_RELATIONSHIPS;
}

/** All Phase 19 D1 tables at expected counts (including locale, attribution, release). */
export function isPhase19D1FullyComplete(rootDir: string, remote: boolean): boolean {
  for (const table of IMPORT_TABLE_ORDER) {
    const actual = queryCount(rootDir, table, remote);
    if (actual !== EXPECTED_TABLE_COUNTS[table]) return false;
  }
  return true;
}

/** Infer resume point from measured remote counts when no checkpoint exists. */
export function inferCheckpointFromRemote(
  rootDir: string,
  remote: boolean,
): D1ImportCheckpoint | null {
  const dupes = queryDuplicateCanonicalIds(rootDir, remote);
  if (dupes !== null && dupes > 0) return null;

  const d1Dir = join(getPhase19ExportDir(rootDir), "d1");
  let completedBatches = 0;

  for (let tableIndex = 0; tableIndex < IMPORT_TABLE_ORDER.length; tableIndex++) {
    const table = IMPORT_TABLE_ORDER[tableIndex]!;
    const expected = EXPECTED_TABLE_COUNTS[table];
    const actual = queryCount(rootDir, table, remote) ?? 0;
    const files = collectSqlFiles(d1Dir, table);

    if (actual >= expected) {
      completedBatches += files.length;
      continue;
    }

    if (actual === 0) {
      return {
        ...initialCheckpoint(remote, false),
        table,
        table_index: tableIndex,
        batch_index: 0,
        completed_batches: completedBatches,
        updated_at: new Date().toISOString(),
      };
    }

    const batchIndex =
      process.env.PHASE19_D1_OR_IGNORE === "1"
        ? 0
        : table === "kaomoji"
          ? Math.floor(actual / KAOMOJI_ROWS_PER_BATCH)
          : Math.floor(actual / (ROWS_PER_BATCH[table] ?? DEFAULT_ROWS_PER_BATCH));
    return {
      ...initialCheckpoint(remote, false),
      table,
      table_index: tableIndex,
      batch_index: batchIndex,
      completed_batches: completedBatches + batchIndex,
      updated_at: new Date().toISOString(),
    };
  }

  return null;
}

export function getResumeBatchIndexForTable(
  rootDir: string,
  table: ImportTable,
  remote: boolean,
): number {
  const expected = EXPECTED_TABLE_COUNTS[table];
  const actual = queryCount(rootDir, table, remote) ?? 0;
  if (actual >= expected) return Number.MAX_SAFE_INTEGER;
  if (actual === 0) return 0;
  if (process.env.PHASE19_D1_OR_IGNORE === "1") return 0;
  if (table === "kaomoji") return Math.floor(actual / KAOMOJI_ROWS_PER_BATCH);
  const rowsPerBatch = ROWS_PER_BATCH[table] ?? DEFAULT_ROWS_PER_BATCH;
  return Math.floor(actual / rowsPerBatch);
}

export async function executeSqlWithRetry(
  rootDir: string,
  file: string,
  remote: boolean,
  maxAttempts = 5,
): Promise<{ ok: boolean; attempts: number; output: string }> {
  let lastOutput = "";
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)] ?? 20000;
    if (delay > 0) await sleepMs(delay);
    const result = executeSqlFile(rootDir, file, remote);
    lastOutput = result.output;
    if (result.ok) return { ok: true, attempts: attempt + 1, output: lastOutput };
    const lower = lastOutput.toLowerCase();
    if (
      process.env.PHASE19_D1_OR_IGNORE !== "1" &&
      lower.includes("unique constraint") &&
      lower.includes("sqlite_constraint")
    ) {
      return { ok: true, attempts: attempt + 1, output: lastOutput };
    }
    if (lower.includes("d1_reset_do") || lower.includes("internal error")) {
      await sleepMs(10_000);
      continue;
    }
    if (lower.includes("enoent") || lower.includes("no such file")) {
      await sleepMs(2000);
      continue;
    }
  }
  return { ok: false, attempts: maxAttempts, output: lastOutput };
}

export function clearRemoteTables(rootDir: string): boolean {
  for (const sql of CLEAR_SQL) {
    if (!executeCommand(rootDir, sql, true)) return false;
  }
  return true;
}

export function initialCheckpoint(remote: boolean, fresh: boolean): D1ImportCheckpoint {
  return {
    version: 1,
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    fresh,
    remote,
    table: IMPORT_TABLE_ORDER[0]!,
    table_index: 0,
    batch_index: 0,
    completed_batches: 0,
    failed_batches: [],
    last_success_file: null,
  };
}

export interface RunSequentialImportOptions {
  readonly rootDir: string;
  readonly remote: boolean;
  readonly fresh: boolean;
  readonly resume: boolean;
  readonly limit?: number;
  /** Stop after completing this table (inclusive). */
  readonly stopAfterTable?: ImportTable;
  readonly onBatch?: (info: {
    table: ImportTable;
    file: string;
    index: number;
    total: number;
  }) => void;
}

export async function runSequentialD1Import(
  opts: RunSequentialImportOptions,
): Promise<D1ImportProgress> {
  const d1Dir = join(getPhase19ExportDir(opts.rootDir), "d1");
  if (!existsSync(d1Dir)) throw new Error("Run npm run kaomoji:phase19 first");

  if (opts.remote && isPhase19D1FullyComplete(opts.rootDir, true)) {
    const checkpoint = loadCheckpoint(opts.rootDir) ?? initialCheckpoint(opts.remote, false);
    return {
      checkpoint,
      kaomoji_count: EXPECTED_KAOMOJI,
      relationship_count: EXPECTED_RELATIONSHIPS,
      complete: true,
    };
  }

  let checkpoint = opts.resume ? loadCheckpoint(opts.rootDir) : null;
  if (opts.fresh) {
    if (opts.remote) clearRemoteTables(opts.rootDir);
    checkpoint = initialCheckpoint(opts.remote, true);
    saveCheckpoint(opts.rootDir, checkpoint);
  }
  if (opts.resume && opts.remote) {
    const inferred = inferCheckpointFromRemote(opts.rootDir, true);
    if (inferred) {
      checkpoint = inferred;
      saveCheckpoint(opts.rootDir, checkpoint);
    }
  }
  if (!checkpoint) {
    checkpoint = initialCheckpoint(opts.remote, false);
    if (!opts.fresh) saveCheckpoint(opts.rootDir, checkpoint);
  }

  const failed: FailedBatch[] = [...checkpoint.failed_batches];
  let completed = checkpoint.completed_batches;
  let tableIndex = checkpoint.table_index;
  let batchIndex = checkpoint.batch_index;

  for (; tableIndex < IMPORT_TABLE_ORDER.length; tableIndex++) {
    const table = IMPORT_TABLE_ORDER[tableIndex]!;
    const files = collectSqlFiles(d1Dir, table);
    if (!files.length) {
      batchIndex = 0;
      continue;
    }
    if (opts.remote && tableIndex !== checkpoint.table_index) {
      const skipFrom = getResumeBatchIndexForTable(opts.rootDir, table, true);
      if (skipFrom >= files.length) {
        completed += files.length;
        batchIndex = 0;
        continue;
      }
      if (skipFrom > batchIndex) batchIndex = skipFrom;
    }
    for (; batchIndex < files.length; batchIndex++) {
      if (opts.limit !== undefined && completed >= opts.limit) break;
      const file = files[batchIndex]!;
      opts.onBatch?.({ table, file, index: batchIndex, total: files.length });
      const result = await executeSqlWithRetry(opts.rootDir, file, opts.remote);
      if (!result.ok) {
        failed.push({
          table,
          file,
          error: result.output.slice(0, 500),
          attempts: result.attempts,
          timestamp: new Date().toISOString(),
        });
        checkpoint = {
          ...checkpoint,
          table,
          table_index: tableIndex,
          batch_index: batchIndex,
          completed_batches: completed,
          failed_batches: failed,
          updated_at: new Date().toISOString(),
        };
        saveCheckpoint(opts.rootDir, checkpoint);
        throw new Error(
          `D1 import halted at ${table} batch ${batchIndex}: ${result.output.slice(0, 200)}`,
        );
      }
      completed++;
      checkpoint = {
        ...checkpoint,
        table,
        table_index: tableIndex,
        batch_index: batchIndex + 1,
        completed_batches: completed,
        failed_batches: failed,
        last_success_file: file,
        updated_at: new Date().toISOString(),
      };
      saveCheckpoint(opts.rootDir, checkpoint);
      const batchSleep = Number(process.env.PHASE19_D1_BATCH_SLEEP_MS ?? 0);
      if (batchSleep > 0) await sleepMs(batchSleep);
    }
    batchIndex = 0;
    if (opts.limit !== undefined && completed >= opts.limit) break;
    if (opts.stopAfterTable === table) break;
  }

  const kaomoji_count = queryCount(opts.rootDir, "kaomoji", opts.remote);
  const relationship_count = queryCount(opts.rootDir, "relationship", opts.remote);
  const complete = opts.remote
    ? isPhase19D1FullyComplete(opts.rootDir, true)
    : kaomoji_count === EXPECTED_KAOMOJI && relationship_count === EXPECTED_RELATIONSHIPS;

  const finalManifest = {
    source: "phase-12-public-quality",
    schema_version: "19.0.0",
    import_timestamp: new Date().toISOString(),
    kaomoji_count,
    relationship_count,
    expected_kaomoji: EXPECTED_KAOMOJI,
    expected_relationships: EXPECTED_RELATIONSHIPS,
    completed_batches: completed,
    failed_batches: failed.length,
    complete,
    checkpoint,
  };
  writeFileSync(
    getImportFinalManifestPath(opts.rootDir),
    JSON.stringify(finalManifest, null, 2) + "\n",
    "utf8",
  );

  return { checkpoint, kaomoji_count, relationship_count, complete };
}
