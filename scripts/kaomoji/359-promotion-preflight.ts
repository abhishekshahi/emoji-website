/**
 * Complete delta audit + preflight for 359-record promotion.
 * READ-ONLY until preflight passes; then optionally generates SQL.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { hashRawFile } from "@/lib/kaomoji/processing/phase7/raw-snapshot";
import { runPhase12Pipeline } from "@/lib/kaomoji/processing/phase12/pipeline";
import { runPhase14Pipeline } from "@/lib/kaomoji/processing/phase14/pipeline";
import { buildSearchIndexV2, searchKaomojiV2 } from "@/lib/kaomoji/processing/phase14/search-index-v2";
import type { KaomojiEditorialRecord, KaomojiRelationship } from "@/lib/kaomoji/processing/phase9/types";
import type { CurationResolution } from "@/lib/kaomoji/processing/phase12/types";
import { EXPECTED_TABLE_COUNTS } from "@/lib/kaomoji/cloudflare/d1-import";
import { getCurationResolutionsPath, getKaomojiRawRecordsPath, getPhase12PublicQualityDir } from "@/lib/kaomoji/storage/paths";
import { buildIncrementalD1Export } from "./maximum-coverage-d1-incremental";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const finalDir = join(rootDir, "data/kaomoji/processed/final");
const backupDir = join(finalDir, "pre-promotion-backup");

const PROMOTED_IDS = new Set(
  (JSON.parse(readFileSync(join(finalDir, "promotion-decisions.json"), "utf8")) as Array<{ canonical_id: string }>).map(
    (d) => d.canonical_id,
  ),
);
const WIKIPEDIA_ATTRIBUTION_IDS = new Set(
  (JSON.parse(readFileSync(join(finalDir, "maximum-coverage-reconciliation.json"), "utf8")) as {
    per_record: Array<{ canonical_id: string; previous_license_status: string }>;
  }).per_record.filter((r) => r.previous_license_status === "ATTRIBUTION_REQUIRED").map((r) => r.canonical_id),
);

const BASELINE = {
  canonical: 63248,
  public: 50979,
  blocked: 12269,
  raw: 236508,
  raw_sha256: "fcf0b80437171e933470e83d899821c5d7910c677c3431683d56199d1e670aaf",
} as const;

interface TableDelta {
  before: number;
  inserts: number;
  deletes: number;
  delete_justification: string | null;
  expected_after: number;
}

function relKey(r: KaomojiRelationship): string {
  return `${r.from_canonical_id}|${r.to_canonical_id}|${r.relationship_type}`;
}

function countKeywords(editorial: KaomojiEditorialRecord[]): number {
  const set = new Set<string>();
  for (const r of editorial) {
    for (const k of r.emojiquick_keywords) set.add(k.toLowerCase());
    for (const k of r.source_keywords) set.add(k.toLowerCase());
  }
  return set.size;
}

function countCategories(editorial: KaomojiEditorialRecord[]): Map<string, { group_name: string; label: string }> {
  const map = new Map<string, { group_name: string; label: string }>();
  for (const r of editorial) {
    for (const c of r.emojiquick_categories) {
      if (!map.has(c.slug)) map.set(c.slug, { group_name: c.group, label: c.label });
    }
  }
  return map;
}

function countCategoryLinks(editorial: KaomojiEditorialRecord[]): number {
  let n = 0;
  for (const r of editorial) n += r.emojiquick_categories.length;
  return n;
}

function countKaomojiKeywords(editorial: KaomojiEditorialRecord[]): number {
  let n = 0;
  for (const r of editorial) n += r.emojiquick_keywords.length + r.source_keywords.length;
  return n;
}

function countLocales(editorial: KaomojiEditorialRecord[]): number {
  let n = 0;
  for (const r of editorial) {
    n += 3;
    if (r.editorial_name) n += 1;
  }
  return n;
}

function countAttribution(provenance: Array<{ canonical_id: string; source_occurrences: Array<{ source_id: string }> }>, publicIds: Set<string>): number {
  let n = 0;
  for (const p of provenance) {
    if (!publicIds.has(p.canonical_id)) continue;
    const seen = new Set<string>();
    for (const occ of p.source_occurrences ?? []) {
      if (seen.has(occ.source_id)) continue;
      seen.add(occ.source_id);
      n++;
    }
  }
  return n;
}

function analyzeRelationshipDeletes(
  removed: KaomojiRelationship[],
  promotedIds: Set<string>,
  oldPublicIds: Set<string>,
): { justified: number; unjustified: number; reasons: Record<string, number> } {
  const reasons: Record<string, number> = {};
  let justified = 0;
  let unjustified = 0;
  for (const r of removed) {
    const involvesPromoted = promotedIds.has(r.from_canonical_id) || promotedIds.has(r.to_canonical_id);
    const bothOldPublic = oldPublicIds.has(r.from_canonical_id) && oldPublicIds.has(r.to_canonical_id);
    let reason: string;
    if (involvesPromoted) {
      reason = "involves_promoted_id_rebuild";
      justified++;
    } else if (bothOldPublic) {
      reason = "existing_public_pair_dropped_by_rebuild";
      unjustified++;
    } else {
      reason = "orphan_or_invalid_endpoint";
      justified++;
    }
    reasons[reason] = (reasons[reason] ?? 0) + 1;
  }
  return { justified, unjustified, reasons };
}

function reviewSqlFiles(incrementalDir: string, promotedIds: Set<string>): {
  issues: string[];
  stats: Record<string, number>;
} {
  const issues: string[] = [];
  const stats = { files: 0, inserts: 0, deletes: 0, kaomoji_ids: new Set<string>() };
  const files = readdirSync(incrementalDir).filter((f) => f.endsWith(".sql"));
  stats.files = files.length;
  const seenKaomojiIds = new Set<string>();

  for (const file of files) {
    const sql = readFileSync(join(incrementalDir, file), "utf8");
    if (/^DELETE FROM/im.test(sql)) stats.deletes += (sql.match(/^DELETE FROM/gim) ?? []).length;
    if (/^INSERT INTO/im.test(sql)) stats.inserts += (sql.match(/^INSERT INTO/gim) ?? []).length;

    if (file.startsWith("kaomoji-batch") && !file.includes("category") && !file.includes("keyword")) {
      const idMatches = sql.matchAll(/'(kao_[0-9a-f]{16})'/g);
      for (const m of idMatches) {
        if (m[1]!.startsWith("kao_")) {
          seenKaomojiIds.add(m[1]!);
          if (!promotedIds.has(m[1]!)) {
            issues.push(`kaomoji insert for non-promoted id: ${m[1]} in ${file}`);
          }
        }
      }
    }
  }

  for (const id of promotedIds) {
    if (!seenKaomojiIds.has(id)) issues.push(`missing kaomoji insert for promoted id: ${id}`);
  }
  for (const id of seenKaomojiIds) {
    if (!promotedIds.has(id)) issues.push(`unexpected kaomoji insert: ${id}`);
  }
  if (seenKaomojiIds.size !== promotedIds.size) {
    issues.push(`kaomoji insert count ${seenKaomojiIds.size} != promoted ${promotedIds.size}`);
  }

  return { issues, stats: { ...stats, kaomoji_ids: seenKaomojiIds.size } };
}

function main(): void {
  const resolutionsPath = getCurationResolutionsPath(rootDir);
  if (!existsSync(resolutionsPath)) {
    console.error("Missing curation-resolutions.json — run reconciliation first");
    process.exit(1);
  }

  const rawShaBefore = hashRawFile(getKaomojiRawRecordsPath(rootDir)).sha256;

  // Ensure post-promotion derived layers exist
  const p12 = runPhase12Pipeline(rootDir);
  if (p12.manifest.publication_eligible !== BASELINE.public + PROMOTED_IDS.size) {
    console.error(`Phase12 public ${p12.manifest.publication_eligible} != expected ${BASELINE.public + PROMOTED_IDS.size}`);
    process.exit(1);
  }

  const p14 = runPhase14Pipeline(rootDir);
  if (p14.manifest.benchmark_pass_count !== p14.manifest.benchmark_queries) {
    console.error(`Search benchmark ${p14.manifest.benchmark_pass_count}/${p14.manifest.benchmark_queries} FAIL`);
    process.exit(1);
  }

  const libDir = getPhase12PublicQualityDir(rootDir);
  const afterEditorial = JSON.parse(readFileSync(join(libDir, "editorial.json"), "utf8")) as KaomojiEditorialRecord[];
  const afterRelationships = JSON.parse(readFileSync(join(libDir, "relationships.json"), "utf8")) as KaomojiRelationship[];
  const afterProvenance = JSON.parse(readFileSync(join(libDir, "provenance.json"), "utf8")) as Array<{
    canonical_id: string;
    source_occurrences: Array<{ source_id: string }>;
  }>;

  const beforeEditorial = JSON.parse(readFileSync(join(backupDir, "editorial.json"), "utf8")) as KaomojiEditorialRecord[];
  const beforeRelationships = JSON.parse(readFileSync(join(backupDir, "relationships.json"), "utf8")) as KaomojiRelationship[];

  const beforePublicIds = new Set(beforeEditorial.map((r) => r.canonical_id));
  const afterPublicIds = new Set(afterEditorial.map((r) => r.canonical_id));

  // Verify 50979 preserved
  for (const id of beforePublicIds) {
    if (!afterPublicIds.has(id)) {
      console.error(`Preflight FAIL: existing public record missing after rebuild: ${id}`);
      process.exit(1);
    }
  }

  const beforeRelKeys = new Set(beforeRelationships.map(relKey));
  const afterRelKeys = new Set(afterRelationships.map(relKey));
  const relInserts = afterRelationships.filter((r) => !beforeRelKeys.has(relKey(r)));
  const relDeletes = beforeRelationships.filter((r) => !afterRelKeys.has(relKey(r)));

  // Required relationships for 359: those involving promoted IDs not already in D1
  const requiredRelInserts = relInserts.filter(
    (r) => PROMOTED_IDS.has(r.from_canonical_id) || PROMOTED_IDS.has(r.to_canonical_id),
  );

  const deleteAnalysis = analyzeRelationshipDeletes(relDeletes, PROMOTED_IDS, beforePublicIds);

  const beforeCategories = countCategories(beforeEditorial);
  const afterCategories = countCategories(afterEditorial);
  let newCategoryRows = 0;
  for (const slug of afterCategories.keys()) {
    if (!beforeCategories.has(slug)) newCategoryRows++;
  }

  const promotedEditorial = afterEditorial.filter((r) => PROMOTED_IDS.has(r.canonical_id));
  const promotedCategoryLinks = countCategoryLinks(promotedEditorial);
  const promotedKeywordLinks = countKaomojiKeywords(promotedEditorial);
  const promotedLocales = countLocales(promotedEditorial);
  const promotedAttribution = countAttribution(afterProvenance, PROMOTED_IDS);

  // Keyword master table delta
  const beforeKwMaster = countKeywords(beforeEditorial);
  const afterKwMaster = countKeywords(afterEditorial);

  // Relationship deletes from full rebuild are NOT applied to D1 — they prune existing
  // public hub edges (329 same_category/medium edges to kao_643ba83911238b9b) without cause.
  // D1 uses INSERT-ONLY for relationships: preserve all 392,904 existing + add promoted-involved.
  const useDeletes = false;
  const relationshipDeletes = 0;
  const relationshipInserts = requiredRelInserts.length;

  const tables: Record<string, TableDelta> = {
    kaomoji: {
      before: EXPECTED_TABLE_COUNTS.kaomoji,
      inserts: PROMOTED_IDS.size,
      deletes: 0,
      delete_justification: null,
      expected_after: EXPECTED_TABLE_COUNTS.kaomoji + PROMOTED_IDS.size,
    },
    relationship: {
      before: EXPECTED_TABLE_COUNTS.relationship,
      inserts: relationshipInserts,
      deletes: relationshipDeletes,
      delete_justification:
        "INSERT-ONLY: 329 rebuild drops NOT applied — they would remove valid existing-public hub edges (kao_643ba83911238b9b, 329 same_category/medium). D1 preserves all pre-promotion relationships.",
      expected_after: EXPECTED_TABLE_COUNTS.relationship + relationshipInserts,
    },
    category: {
      before: EXPECTED_TABLE_COUNTS.category,
      inserts: newCategoryRows,
      deletes: 0,
      delete_justification: null,
      expected_after: EXPECTED_TABLE_COUNTS.category + newCategoryRows,
    },
    keyword: {
      before: EXPECTED_TABLE_COUNTS.keyword,
      inserts: afterKwMaster - beforeKwMaster,
      deletes: 0,
      delete_justification: null,
      expected_after: EXPECTED_TABLE_COUNTS.keyword + (afterKwMaster - beforeKwMaster),
    },
    kaomoji_category: {
      before: EXPECTED_TABLE_COUNTS.kaomoji_category,
      inserts: promotedCategoryLinks,
      deletes: 0,
      delete_justification: null,
      expected_after: EXPECTED_TABLE_COUNTS.kaomoji_category + promotedCategoryLinks,
    },
    kaomoji_keyword: {
      before: EXPECTED_TABLE_COUNTS.kaomoji_keyword,
      inserts: promotedKeywordLinks,
      deletes: 0,
      delete_justification: null,
      expected_after: EXPECTED_TABLE_COUNTS.kaomoji_keyword + promotedKeywordLinks,
    },
    kaomoji_locale: {
      before: EXPECTED_TABLE_COUNTS.kaomoji_locale,
      inserts: promotedLocales,
      deletes: 0,
      delete_justification: null,
      expected_after: EXPECTED_TABLE_COUNTS.kaomoji_locale + promotedLocales,
    },
    source_attribution: {
      before: EXPECTED_TABLE_COUNTS.source_attribution,
      inserts: promotedAttribution,
      deletes: 0,
      delete_justification: null,
      expected_after: EXPECTED_TABLE_COUNTS.source_attribution + promotedAttribution,
    },
    search_metadata: {
      before: EXPECTED_TABLE_COUNTS.search_metadata,
      inserts: 0,
      deletes: 0,
      delete_justification: "UPDATE public_record_count and relationship_count only",
      expected_after: EXPECTED_TABLE_COUNTS.search_metadata,
    },
    collection: {
      before: EXPECTED_TABLE_COUNTS.collection,
      inserts: 0,
      deletes: 0,
      delete_justification: null,
      expected_after: EXPECTED_TABLE_COUNTS.collection,
    },
    collection_item: {
      before: EXPECTED_TABLE_COUNTS.collection_item,
      inserts: 0,
      deletes: 0,
      delete_justification: null,
      expected_after: EXPECTED_TABLE_COUNTS.collection_item,
    },
    production_release: {
      before: EXPECTED_TABLE_COUNTS.production_release,
      inserts: 0,
      deletes: 0,
      delete_justification: "No change until next release row",
      expected_after: EXPECTED_TABLE_COUNTS.production_release,
    },
  };

  // Verify relationship math — D1 expected differs from rebuild artifact by preserved hub edges
  const d1RelAfter = tables.relationship!.expected_after;
  const authRelAfter = afterRelationships.length;
  const rebuildArtifactPreserved = d1RelAfter - authRelAfter;

  const index = buildSearchIndexV2(afterEditorial);
  const notSearchable: string[] = [];
  for (const id of PROMOTED_IDS) {
    const ed = afterEditorial.find((r) => r.canonical_id === id);
    if (!ed) { notSearchable.push(id); continue; }
    if (!index.records.some((r) => r.canonical_id === id)) notSearchable.push(id);
  }

  process.env.PROMOTION_INSERT_ONLY_RELATIONSHIPS = "1";
  const incremental = buildIncrementalD1Export(rootDir, {
    previousPublicIds: beforePublicIds,
    promotedIds: PROMOTED_IDS,
    insertOnlyRelationships: true,
  });

  const sqlReview = reviewSqlFiles(join(finalDir, "d1-incremental"), PROMOTED_IDS);

  const preflightErrors: string[] = [];
  if (p12.manifest.publication_eligible !== 51338) preflightErrors.push("public count != 51338");
  if (PROMOTED_IDS.size !== 359) preflightErrors.push("promoted != 359");
  if (notSearchable.length) preflightErrors.push(`${notSearchable.length} promoted records not in search index`);
  if (sqlReview.issues.length) preflightErrors.push(...sqlReview.issues);
  if (rawShaBefore !== BASELINE.raw_sha256) preflightErrors.push("RAW SHA changed");

  // Wikipedia attribution check
  const wikiAttribution: Array<{ canonical_id: string; has_attribution: boolean; sources: string[] }> = [];
  for (const id of WIKIPEDIA_ATTRIBUTION_IDS) {
    const prov = afterProvenance.find((p) => p.canonical_id === id);
    wikiAttribution.push({
      canonical_id: id,
      has_attribution: (prov?.source_occurrences?.length ?? 0) > 0,
      sources: prov?.source_occurrences?.map((o) => o.source_id) ?? [],
    });
  }
  if (wikiAttribution.some((w) => !w.has_attribution)) {
    preflightErrors.push("Wikipedia record missing source_attribution data");
  }

  const preflight = {
    timestamp: new Date().toISOString(),
    mode: "359_PROMOTION_PREFLIGHT",
    baseline: BASELINE,
    newly_eligible: PROMOTED_IDS.size,
    proposed_public: BASELINE.public + PROMOTED_IDS.size,
    remaining_blocked: BASELINE.blocked - PROMOTED_IDS.size,
    tables,
    relationship_audit: {
      before: beforeRelationships.length,
      after_authoritative_json: afterRelationships.length,
      d1_expected_after: d1RelAfter,
      rebuild_artifact_preserved_in_d1: rebuildArtifactPreserved,
      inserts_promoted_involved: requiredRelInserts.length,
      deletes_proposed_by_rebuild: relDeletes.length,
      deletes_applied_to_d1: 0,
      delete_analysis: deleteAnalysis,
      delete_decision: "INSERT-ONLY — 329 rebuild drops rejected (hub edge pruning on existing public kao_643ba83911238b9b)",
      use_deletes: false,
    },
    search: {
      benchmark: `${p14.manifest.benchmark_pass_count}/${p14.manifest.benchmark_queries}`,
      index_records: index.records.length,
      promoted_searchable: PROMOTED_IDS.size - notSearchable.length,
      not_searchable: notSearchable,
    },
    wikipedia_attribution: wikiAttribution,
    incremental_sql: incremental.summary,
    sql_review: sqlReview,
    raw_sha256: rawShaBefore,
    raw_unchanged: rawShaBefore === BASELINE.raw_sha256,
    preflight_passes: preflightErrors.length === 0,
    preflight_errors: preflightErrors,
    sql_executed: false,
  };

  writeFileSync(join(finalDir, "359-promotion-preflight.json"), JSON.stringify(preflight, null, 2) + "\n", "utf8");

  const md = `# 359 Promotion Preflight

**Timestamp:** ${preflight.timestamp}
**Preflight passes:** ${preflight.preflight_passes ? "YES" : "NO"}

## Baseline

| Metric | Value |
|--------|------:|
| Canonical | ${BASELINE.canonical.toLocaleString()} |
| Public (before) | ${BASELINE.public.toLocaleString()} |
| Newly eligible | ${PROMOTED_IDS.size} |
| **Proposed public** | **${(BASELINE.public + PROMOTED_IDS.size).toLocaleString()}** |
| Remaining blocked | ${(BASELINE.blocked - PROMOTED_IDS.size).toLocaleString()} |

## Table deltas (BEFORE + INSERTS − DELETES = EXPECTED AFTER)

| Table | Before | Inserts | Deletes | Expected After |
|-------|-------:|--------:|--------:|---------------:|
${Object.entries(tables)
  .map(([k, v]) => `| ${k} | ${v.before.toLocaleString()} | ${v.inserts.toLocaleString()} | ${v.deletes.toLocaleString()} | ${v.expected_after.toLocaleString()} |`)
  .join("\n")}

## Relationship audit

- Before: ${beforeRelationships.length.toLocaleString()}
- After (authoritative): ${afterRelationships.length.toLocaleString()}
- Inserts (all new keys): ${relInserts.length.toLocaleString()}
- Inserts (promoted-involved): ${requiredRelInserts.length.toLocaleString()}
- Deletes (rebuild diff): ${relDeletes.length.toLocaleString()}
- Delete mode: ${useDeletes ? "INSERT+DELETE (justified)" : "INSERT-ONLY (deletes not justified)"}

## Search

- Benchmark: ${preflight.search.benchmark}
- Index records: ${preflight.search.index_records.toLocaleString()}
- Promoted searchable: ${preflight.search.promoted_searchable}/359

## Wikipedia attribution (7 records)

${wikiAttribution.map((w) => `- \`${w.canonical_id}\`: ${w.has_attribution ? "OK" : "MISSING"} (${w.sources.join(", ")})`).join("\n")}

## SQL review

- Files: ${sqlReview.stats.files}
- Issues: ${sqlReview.issues.length}${sqlReview.issues.length ? "\n" + sqlReview.issues.map((i) => `- ${i}`).join("\n") : ""}

## Errors

${preflightErrors.length ? preflightErrors.map((e) => `- ${e}`).join("\n") : "None"}
`;

  writeFileSync(join(rootDir, "r2-export/359-PROMOTION-PREFLIGHT.md"), md, "utf8");
  console.log(JSON.stringify({ preflight_passes: preflight.preflight_passes, errors: preflightErrors, tables }, null, 2));

  if (!preflight.preflight_passes) process.exit(1);
}

main();
