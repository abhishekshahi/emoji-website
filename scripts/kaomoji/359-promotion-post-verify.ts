/**
 * Post-promotion verification: remote D1 counts + 359 record checks.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { hashRawFile } from "@/lib/kaomoji/processing/phase7/raw-snapshot";
import { buildSearchIndexV2, searchKaomojiV2 } from "@/lib/kaomoji/processing/phase14/search-index-v2";
import type { KaomojiEditorialRecord } from "@/lib/kaomoji/processing/phase9/types";
import { queryCount } from "@/lib/kaomoji/cloudflare/d1-import";
import { getKaomojiRawRecordsPath, getPhase12PublicQualityDir } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const finalDir = join(rootDir, "data/kaomoji/processed/final");
const preflight = JSON.parse(readFileSync(join(finalDir, "359-promotion-preflight.json"), "utf8")) as {
  tables: Record<string, { expected_after: number }>;
};

const PROMOTED = JSON.parse(readFileSync(join(finalDir, "promotion-decisions.json"), "utf8")) as Array<{
  canonical_id: string;
  slug: string;
}>;
const WIKI_IDS = new Set(
  (JSON.parse(readFileSync(join(finalDir, "maximum-coverage-reconciliation.json"), "utf8")) as {
    per_record: Array<{ canonical_id: string; previous_license_status: string }>;
  }).per_record.filter((r) => r.previous_license_status === "ATTRIBUTION_REQUIRED").map((r) => r.canonical_id),
);

function queryD1(sql: string): unknown {
  const out = execSync(
    `npx wrangler d1 execute emojiquick-kaomoji --remote --json --command "${sql.replace(/"/g, '\\"')}"`,
    { encoding: "utf8", cwd: rootDir },
  );
  const parsed = JSON.parse(out) as Array<{ results?: unknown[] }>;
  return parsed[0]?.results?.[0];
}

async function main(): Promise<void> {
  const errors: string[] = [];
  const measured: Record<string, number> = {};

  for (const table of [
    "kaomoji", "relationship", "category", "keyword", "kaomoji_category",
    "kaomoji_keyword", "kaomoji_locale", "source_attribution", "search_metadata",
    "collection", "collection_item", "production_release",
  ]) {
    const c = queryCount(rootDir, table, true);
    measured[table] = c ?? -1;
    const expected = preflight.tables[table]?.expected_after;
    if (expected != null && c !== expected) {
      errors.push(`${table}: expected ${expected}, got ${c}`);
    }
  }

  const publicCount = Number((queryD1("SELECT COUNT(*) AS c FROM kaomoji WHERE is_public = 1;") as { c: number })?.c ?? -1);
  if (publicCount !== 51338) errors.push(`public is_public=1: expected 51338, got ${publicCount}`);

  const missingPromoted: string[] = [];
  const notPublic: string[] = [];
  for (const p of PROMOTED) {
    const row = queryD1(
      `SELECT canonical_id, is_public FROM kaomoji WHERE canonical_id = '${p.canonical_id}';`,
    ) as { canonical_id?: string; is_public?: number } | undefined;
    if (!row?.canonical_id) missingPromoted.push(p.canonical_id);
    else if (row.is_public !== 1) notPublic.push(p.canonical_id);
  }
  if (missingPromoted.length) errors.push(`missing promoted: ${missingPromoted.length}`);
  if (notPublic.length) errors.push(`promoted not public: ${notPublic.length}`);

  const wikiMissing: string[] = [];
  for (const id of WIKI_IDS) {
    const row = queryD1(
      `SELECT COUNT(*) AS c FROM source_attribution WHERE canonical_id = '${id}';`,
    ) as { c?: number } | undefined;
    if (!row?.c) wikiMissing.push(id);
  }
  if (wikiMissing.length) errors.push(`wikipedia attribution missing: ${wikiMissing.join(", ")}`);

  const editorial = JSON.parse(
    readFileSync(join(getPhase12PublicQualityDir(rootDir), "editorial.json"), "utf8"),
  ) as KaomojiEditorialRecord[];
  const index = buildSearchIndexV2(editorial);
  const notSearchable = PROMOTED.filter((p) => !index.records.some((r) => r.canonical_id === p.canonical_id));

  const dupKaomoji = queryD1(
    "SELECT COUNT(*) AS c FROM (SELECT canonical_id FROM kaomoji GROUP BY canonical_id HAVING COUNT(*) > 1);",
  ) as { c?: number };
  const orphanRel = queryD1(
    `SELECT COUNT(*) AS c FROM relationship r WHERE NOT EXISTS (SELECT 1 FROM kaomoji k WHERE k.canonical_id = r.from_canonical_id) OR NOT EXISTS (SELECT 1 FROM kaomoji k WHERE k.canonical_id = r.to_canonical_id);`,
  ) as { c?: number };

  const rawSha = hashRawFile(getKaomojiRawRecordsPath(rootDir)).sha256;
  const canonicalCount = JSON.parse(
    readFileSync(join(rootDir, "data/kaomoji/processed/phase-8/proposed-library/canonical-records.json"), "utf8"),
  ).length;

  const report = {
    timestamp: new Date().toISOString(),
    mode: "359_PROMOTION_POST_VERIFY",
    measured,
    expected: Object.fromEntries(Object.entries(preflight.tables).map(([k, v]) => [k, v.expected_after])),
    public_is_public: publicCount,
    promoted_verified: PROMOTED.length - missingPromoted.length - notPublic.length,
    promoted_missing: missingPromoted,
    promoted_not_public: notPublic,
    wikipedia_attribution_ok: WIKI_IDS.size - wikiMissing.length,
    wikipedia_missing: wikiMissing,
    not_searchable: notSearchable.map((p) => p.canonical_id),
    duplicate_kaomoji: dupKaomoji?.c ?? -1,
    orphan_relationships: orphanRel?.c ?? -1,
    canonical_count: canonicalCount,
    raw_count: 236508,
    raw_sha256: rawSha,
    raw_unchanged: rawSha === "fcf0b80437171e933470e83d899821c5d7910c677c3431683d56199d1e670aaf",
    verification_passes: errors.length === 0 && notSearchable.length === 0 && (dupKaomoji?.c ?? 1) === 0 && (orphanRel?.c ?? 1) === 0,
    errors,
  };

  writeFileSync(join(finalDir, "359-promotion-post-verify.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.verification_passes ? 0 : 1);
}

void main();
