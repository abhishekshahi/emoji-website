import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXPECTED_KAOMOJI,
  EXPECTED_RELATIONSHIPS,
  EXPECTED_TABLE_COUNTS,
  IMPORT_TABLE_ORDER,
  queryCount,
  queryDuplicateCanonicalIds,
} from "@/lib/kaomoji/cloudflare/d1-import";
import { hashRawFile } from "@/lib/kaomoji/processing/phase7/raw-snapshot";
import { evaluateBenchmark } from "@/lib/kaomoji/processing/phase14/benchmark-dataset";
import { searchKaomojiV2 } from "@/lib/kaomoji/processing/phase14/search-index-v2";
import { getKaomojiRawRecordsPath, getPhase14SearchIndexPath, getPhase19RootDir } from "@/lib/kaomoji/storage/paths";
import { runWrangler } from "../r2/wrangler-r2";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const MULTILINE_IDS = ["kao_45ca69b73e510a92", "kao_45d80596a904a64c"] as const;

function queryScalar(rootDir: string, sql: string, remote: boolean): number | null {
  const args = ["d1", "execute", "emojiquick-kaomoji", "--command", sql];
  if (remote) args.push("--remote");
  const result = runWrangler(args, rootDir);
  if (!result.ok) return null;
  const match = result.stdout.match(/"c"\s*:\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

function queryExists(rootDir: string, canonicalId: string, remote: boolean): boolean {
  const sql = `SELECT COUNT(*) AS c FROM kaomoji WHERE canonical_id = '${canonicalId}'`;
  return queryScalar(rootDir, sql, remote) === 1;
}

function main(): void {
  const remote = process.argv.includes("--remote");
  if (!remote) {
    console.error("Use --remote for integrity audit against production D1");
    process.exit(1);
  }

  const errors: string[] = [];
  const counts: Record<string, number | null> = {};
  for (const table of IMPORT_TABLE_ORDER) {
    counts[table] = queryCount(rootDir, table, true);
    const expected = EXPECTED_TABLE_COUNTS[table];
    if (counts[table] !== expected) {
      errors.push(`${table}: ${counts[table] ?? "?"} != ${expected}`);
    }
  }

  const dupes = queryDuplicateCanonicalIds(rootDir, true);
  if (dupes !== 0) errors.push(`duplicate canonical IDs: ${dupes}`);

  const dupRel = queryScalar(
    rootDir,
    `SELECT COUNT(*) AS c FROM (SELECT from_canonical_id, to_canonical_id, relationship_type, COUNT(*) AS n FROM relationship GROUP BY from_canonical_id, to_canonical_id, relationship_type HAVING n > 1)`,
    true,
  );
  if (dupRel !== 0) errors.push(`duplicate relationship edges: ${dupRel}`);

  const brokenColl = queryScalar(
    rootDir,
    `SELECT COUNT(*) AS c FROM collection_item ci LEFT JOIN kaomoji k ON ci.canonical_id = k.canonical_id WHERE k.canonical_id IS NULL`,
    true,
  );
  if (brokenColl !== 0) errors.push(`broken collection_item refs: ${brokenColl}`);

  const orphans = queryScalar(
    rootDir,
    `SELECT COUNT(*) AS c FROM relationship r LEFT JOIN kaomoji k1 ON r.from_canonical_id = k1.canonical_id LEFT JOIN kaomoji k2 ON r.to_canonical_id = k2.canonical_id WHERE k1.canonical_id IS NULL OR k2.canonical_id IS NULL`,
    true,
  );
  if (orphans !== 0) errors.push(`orphan relationships: ${orphans}`);

  for (const id of MULTILINE_IDS) {
    if (!queryExists(rootDir, id, true)) errors.push(`missing multiline record: ${id}`);
  }

  const idx = JSON.parse(readFileSync(getPhase14SearchIndexPath(rootDir), "utf8"));
  const benchmark = evaluateBenchmark((q, l) => searchKaomojiV2(idx, q, l).length);
  if (benchmark.pass !== benchmark.total) {
    errors.push(`search benchmark ${benchmark.pass}/${benchmark.total}`);
  }

  const rawSha = hashRawFile(getKaomojiRawRecordsPath(rootDir)).sha256;

  const report = {
    timestamp: new Date().toISOString(),
    remote: true,
    counts,
    expected: EXPECTED_TABLE_COUNTS,
    duplicate_canonical_ids: dupes,
    duplicate_relationships: dupRel,
    broken_collection_items: brokenColl,
    orphan_relationships: orphans,
    multiline_records: Object.fromEntries(MULTILINE_IDS.map((id) => [id, queryExists(rootDir, id, true)])),
    search_benchmark: `${benchmark.pass}/${benchmark.total}`,
    raw_sha256: rawSha,
    valid: errors.length === 0,
    errors,
  };

  const outDir = getPhase19RootDir(rootDir);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "d1-integrity-audit.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.valid ? 0 : 1);
}

main();
