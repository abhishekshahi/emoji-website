import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { EXPECTED_RELATIONSHIPS } from "@/lib/kaomoji/cloudflare/d1-import";
import { getPhase12PublicQualityDir, getPhase19RootDir } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const BATCH_SIZE = 50_000;

interface RelRow {
  readonly from_canonical_id: string;
  readonly to_canonical_id: string;
  readonly relationship_type: string;
}

function relKey(r: RelRow): string {
  return `${r.from_canonical_id}|${r.to_canonical_id}|${r.relationship_type}`;
}

function parseWranglerRows(stdout: string): RelRow[] {
  const rows: RelRow[] = [];
  try {
    const parsed = JSON.parse(stdout) as Array<{ results?: RelRow[] }>;
    for (const block of parsed) {
      if (block.results) rows.push(...block.results);
    }
    if (rows.length) return rows;
  } catch {
    /* fall through to regex */
  }
  const fromRe = /"from_canonical_id"\s*:\s*"(kao_[0-9a-f]{16})"/g;
  const toRe = /"to_canonical_id"\s*:\s*"(kao_[0-9a-f]{16})"/g;
  const typeRe = /"relationship_type"\s*:\s*"([^"]+)"/g;
  const froms = [...stdout.matchAll(fromRe)].map((m) => m[1]);
  const tos = [...stdout.matchAll(toRe)].map((m) => m[1]);
  const types = [...stdout.matchAll(typeRe)].map((m) => m[1]);
  const n = Math.min(froms.length, tos.length, types.length);
  for (let i = 0; i < n; i++) {
    rows.push({ from_canonical_id: froms[i]!, to_canonical_id: tos[i]!, relationship_type: types[i]! });
  }
  return rows;
}

function fetchRemoteBatch(offset: number, limit: number): RelRow[] {
  const sql = `SELECT from_canonical_id, to_canonical_id, relationship_type FROM relationship ORDER BY id LIMIT ${limit} OFFSET ${offset}`;
  const out = execSync(
    `npx wrangler d1 execute emojiquick-kaomoji --remote --json --command "${sql}"`,
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, cwd: rootDir, timeout: 300_000 },
  );
  return parseWranglerRows(out);
}

function main(): void {
  if (!process.argv.includes("--remote")) {
    console.error("Use --remote");
    process.exit(1);
  }

  const localPath = join(getPhase12PublicQualityDir(rootDir), "relationships.json");
  const localRows = JSON.parse(readFileSync(localPath, "utf8")) as RelRow[];
  const localSet = new Set<string>();
  const localDupes = new Set<string>();
  let localDupeCount = 0;
  for (const r of localRows) {
    const k = relKey(r);
    if (localSet.has(k)) {
      localDupeCount++;
      localDupes.add(k);
    }
    localSet.add(k);
  }

  const remoteSet = new Set<string>();
  const remoteDupes = new Set<string>();
  let remoteDupeCount = 0;
  let offset = 0;
  while (offset < EXPECTED_RELATIONSHIPS + BATCH_SIZE) {
    console.error(`Fetching remote batch offset=${offset}...`);
    const batch = fetchRemoteBatch(offset, BATCH_SIZE);
    if (batch.length === 0) break;
    for (const r of batch) {
      const k = relKey(r);
      if (remoteSet.has(k)) {
        remoteDupeCount++;
        remoteDupes.add(k);
      }
      remoteSet.add(k);
    }
    offset += batch.length;
    if (batch.length < BATCH_SIZE) break;
  }

  const missing = [...localSet].filter((k) => !remoteSet.has(k));
  const unexpected = [...remoteSet].filter((k) => !localSet.has(k));
  const errors: string[] = [];
  if (localRows.length !== EXPECTED_RELATIONSHIPS) {
    errors.push(`local count ${localRows.length} != ${EXPECTED_RELATIONSHIPS}`);
  }
  if (remoteSet.size !== EXPECTED_RELATIONSHIPS) {
    errors.push(`remote count ${remoteSet.size} != ${EXPECTED_RELATIONSHIPS}`);
  }
  if (localDupeCount) errors.push(`local duplicates: ${localDupeCount}`);
  if (remoteDupeCount) errors.push(`remote duplicates: ${remoteDupeCount}`);
  if (missing.length) errors.push(`missing: ${missing.length}`);
  if (unexpected.length) errors.push(`unexpected: ${unexpected.length}`);

  const report = {
    timestamp: new Date().toISOString(),
    local_total: localRows.length,
    local_unique: localSet.size,
    remote_unique: remoteSet.size,
    expected: EXPECTED_RELATIONSHIPS,
    missing_count: missing.length,
    unexpected_count: unexpected.length,
    local_duplicates: localDupeCount,
    remote_duplicates: remoteDupeCount,
    missing_sample: missing.slice(0, 20),
    unexpected_sample: unexpected.slice(0, 20),
    valid: errors.length === 0,
    errors,
  };

  const outDir = getPhase19RootDir(rootDir);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "relationship-set-diff.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.valid ? 0 : 1);
}

main();
