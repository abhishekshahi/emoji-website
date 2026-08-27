/**
 * Generate and execute incremental D1 SQL for maximum-coverage promotions.
 * Inserts only delta rows — does NOT use --fresh or clear existing D1 data.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CanonicalRecord } from "@/lib/kaomoji/processing/phase8/types";
import type { KaomojiEditorialRecord, KaomojiRelationship } from "@/lib/kaomoji/processing/phase9/types";
import type { Phase10ScoredRecord } from "@/lib/kaomoji/processing/phase10/types";
import type { PublicationGateResult } from "@/lib/kaomoji/processing/phase12/types";
import { executeSqlWithRetry, queryCount, EXPECTED_KAOMOJI, EXPECTED_RELATIONSHIPS } from "@/lib/kaomoji/cloudflare/d1-import";
import { getPhase12PublicQualityDir } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const incrementalDir = join(rootDir, "data/kaomoji/processed/final/d1-incremental");

function sqlEscape(value: string | null | undefined): string {
  if (value == null) return "NULL";
  return "'" + String(value).replace(/'/g, "''") + "'";
}

function sqlInt(value: boolean | number): string {
  if (typeof value === "boolean") return value ? "1" : "0";
  return String(value);
}

function writeSql(name: string, statements: string[]): string {
  const path = join(incrementalDir, name);
  writeFileSync(path, statements.join("\n") + "\n", "utf8");
  return path;
}

interface ProvenanceRow {
  canonical_id: string;
  source_occurrences: CanonicalRecord["source_occurrences"];
}

export interface IncrementalExportOptions {
  readonly previousPublicIds: Set<string>;
  readonly promotedIds: Set<string>;
  /** When true, skip relationship DELETEs and only insert promoted-involved rels. */
  readonly insertOnlyRelationships?: boolean;
}

export interface IncrementalExportResult {
  readonly summary: Record<string, number | boolean>;
  readonly sqlFiles: string[];
}

export function buildIncrementalD1Export(
  rootDirArg: string,
  opts: IncrementalExportOptions,
): IncrementalExportResult {
  const libDir = getPhase12PublicQualityDir(rootDirArg);
  const editorial = JSON.parse(readFileSync(join(libDir, "editorial.json"), "utf8")) as KaomojiEditorialRecord[];
  const scores = JSON.parse(readFileSync(join(libDir, "scores.json"), "utf8")) as Phase10ScoredRecord[];
  const gates = JSON.parse(readFileSync(join(libDir, "publication-gate.json"), "utf8")) as PublicationGateResult[];
  const relationships = JSON.parse(readFileSync(join(libDir, "relationships.json"), "utf8")) as KaomojiRelationship[];
  const provenance = JSON.parse(readFileSync(join(libDir, "provenance.json"), "utf8")) as ProvenanceRow[];

  const backupRels = existsSync(join(rootDirArg, "data/kaomoji/processed/final/pre-promotion-backup/relationships.json"))
    ? (JSON.parse(
        readFileSync(join(rootDirArg, "data/kaomoji/processed/final/pre-promotion-backup/relationships.json"), "utf8"),
      ) as KaomojiRelationship[])
    : [];

  const scoresById = new Map(scores.map((s) => [s.canonical_id, s]));
  const gateById = new Map(gates.map((g) => [g.canonical_id, g]));
  const newEditorial = editorial.filter((r) => opts.promotedIds.has(r.canonical_id));

  const oldRelKeys = new Set(backupRels.map((r) => `${r.from_canonical_id}|${r.to_canonical_id}|${r.relationship_type}`));
  const newRelKeys = new Set(relationships.map((r) => `${r.from_canonical_id}|${r.to_canonical_id}|${r.relationship_type}`));
  const newRelationships = relationships.filter(
    (r) => !oldRelKeys.has(`${r.from_canonical_id}|${r.to_canonical_id}|${r.relationship_type}`),
  );
  const removedRelationships = backupRels.filter(
    (r) => !newRelKeys.has(`${r.from_canonical_id}|${r.to_canonical_id}|${r.relationship_type}`),
  );

  const relsToInsert = opts.insertOnlyRelationships
    ? newRelationships.filter(
        (r) => opts.promotedIds.has(r.from_canonical_id) || opts.promotedIds.has(r.to_canonical_id),
      )
    : newRelationships;

  // Clear stale SQL from prior runs
  if (existsSync(incrementalDir)) {
    for (const f of readdirSync(incrementalDir)) {
      if (f.endsWith(".sql") || f === "summary.json") {
        unlinkSync(join(incrementalDir, f));
      }
    }
  }
  mkdirSync(incrementalDir, { recursive: true });
  const sqlFiles: string[] = [];
  const kaomojiRows: string[][] = [];
  const categoryLinkRows: string[][] = [];
  const kaomojiKeywordRows: string[][] = [];
  const localeRows: string[][] = [];
  const attributionRows: string[][] = [];

  for (const r of newEditorial) {
    const sc = scoresById.get(r.canonical_id);
    const gate = gateById.get(r.canonical_id);
    if (!sc || !gate?.publication_eligible) {
      throw new Error(`Promoted record not eligible: ${r.canonical_id}`);
    }
    kaomojiRows.push([
      sqlEscape(r.canonical_id),
      sqlEscape(r.slug),
      sqlEscape(r.canonical_content),
      sqlEscape(r.normalized_content),
      sqlEscape(r.content_type),
      sqlEscape(r.publication_status),
      sqlEscape(r.curation_status),
      sqlEscape(r.license_status),
      sqlEscape(r.provenance_status),
      sqlInt(true),
      String(sc.overall_score_v1 ?? sc.quality_score_v2),
      sqlEscape(sc.quality_bucket),
      String(sc.beauty_score_v1),
      String(sc.overall_score_v1 ?? sc.quality_score_v2),
      sqlEscape(r.editorial_name),
      sqlEscape(r.accessible_name),
      sqlEscape(r.seo_title),
      sqlEscape(r.seo_description),
      sqlEscape(r.editorial_tier),
      sqlEscape(r.editorial_priority),
      sqlEscape(r.meaning),
      sqlEscape(r.common_usage),
      sqlEscape(r.duplicate_group_id),
      sqlEscape(r.variant_group_id),
      sqlEscape(r.popularity_status),
    ]);
    r.emojiquick_categories.forEach((c, idx) => {
      categoryLinkRows.push([sqlEscape(r.canonical_id), sqlEscape(c.slug), sqlInt(idx === 0)]);
    });
    for (const k of r.emojiquick_keywords) {
      kaomojiKeywordRows.push([sqlEscape(r.canonical_id), sqlEscape(k.toLowerCase()), sqlEscape("emojiquick")]);
    }
    for (const k of r.source_keywords) {
      kaomojiKeywordRows.push([sqlEscape(r.canonical_id), sqlEscape(k.toLowerCase()), sqlEscape("source")]);
    }
    localeRows.push([sqlEscape("en"), sqlEscape(r.canonical_id), sqlEscape("seo_title"), sqlEscape(r.seo_title)]);
    localeRows.push([sqlEscape("en"), sqlEscape(r.canonical_id), sqlEscape("seo_description"), sqlEscape(r.seo_description)]);
    localeRows.push([sqlEscape("en"), sqlEscape(r.canonical_id), sqlEscape("accessible_name"), sqlEscape(r.accessible_name)]);
    if (r.editorial_name) {
      localeRows.push([sqlEscape("en"), sqlEscape(r.canonical_id), sqlEscape("editorial_name"), sqlEscape(r.editorial_name)]);
    }
  }

  for (const p of provenance) {
    if (!opts.promotedIds.has(p.canonical_id)) continue;
    const seen = new Set<string>();
    for (const occ of p.source_occurrences ?? []) {
      if (seen.has(occ.source_id)) continue;
      seen.add(occ.source_id);
      attributionRows.push([
        sqlEscape(p.canonical_id),
        sqlEscape(occ.source_id),
        sqlEscape(occ.source_url ?? null),
        sqlEscape(occ.source_record_id ?? null),
        sqlEscape(occ.license_status),
      ]);
    }
  }

  const relationshipRows = relsToInsert.map((r) => [
    sqlEscape(r.from_canonical_id),
    sqlEscape(r.to_canonical_id),
    sqlEscape(r.relationship_type),
    sqlEscape(r.confidence),
    String(r.score),
  ]);

  function batchInsert(table: string, columns: string[], rows: string[][]): void {
    if (!rows.length) return;
    const CHUNK = table === "relationship" ? 100 : 25;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const values = chunk.map((r) => "(" + r.join(", ") + ")").join(",\n");
      const file = `${table}-batch-${String(Math.floor(i / CHUNK)).padStart(3, "0")}.sql`;
      sqlFiles.push(writeSql(file, [`INSERT INTO ${table} (${columns.join(", ")}) VALUES\n${values};`]));
    }
  }

  batchInsert("kaomoji", [
    "canonical_id", "slug", "content", "normalized_content", "content_type",
    "publication_status", "curation_status", "license_status", "provenance_status", "is_public",
    "quality_score", "quality_bucket", "beauty_score", "overall_score",
    "editorial_name", "accessible_name", "seo_title", "seo_description",
    "editorial_tier", "editorial_priority", "meaning", "common_usage",
    "duplicate_group_id", "variant_group_id", "popularity_status",
  ], kaomojiRows);

  batchInsert("kaomoji_category", ["canonical_id", "category_slug", "is_primary"], categoryLinkRows);
  batchInsert("kaomoji_keyword", ["canonical_id", "keyword", "source"], kaomojiKeywordRows);
  batchInsert("kaomoji_locale", ["locale", "canonical_id", "field_key", "field_value"], localeRows);
  batchInsert("source_attribution", [
    "canonical_id", "source_id", "source_url", "source_record_id", "license_status",
  ], attributionRows);
  batchInsert("relationship", [
    "from_canonical_id", "to_canonical_id", "relationship_type", "confidence", "score",
  ], relationshipRows);

  if (removedRelationships.length && !opts.insertOnlyRelationships) {
    const deleteStmts = removedRelationships.map(
      (r) =>
        `DELETE FROM relationship WHERE from_canonical_id = ${sqlEscape(r.from_canonical_id)} AND to_canonical_id = ${sqlEscape(r.to_canonical_id)} AND relationship_type = ${sqlEscape(r.relationship_type)};`,
    );
    sqlFiles.push(writeSql("relationship-delete.sql", deleteStmts));
  }

  const expectedRelCount = opts.insertOnlyRelationships
    ? backupRels.length + relsToInsert.length
    : relationships.length;

  sqlFiles.push(
    writeSql("search_metadata-update.sql", [
      `UPDATE search_metadata SET value = ${sqlEscape(String(editorial.length))}, updated_at = ${sqlEscape(new Date().toISOString())} WHERE key = 'public_record_count';`,
      `UPDATE search_metadata SET value = ${sqlEscape(String(expectedRelCount))}, updated_at = ${sqlEscape(new Date().toISOString())} WHERE key = 'relationship_count';`,
    ]),
  );

  const summary = {
    kaomoji: kaomojiRows.length,
    kaomoji_category: categoryLinkRows.length,
    kaomoji_keyword: kaomojiKeywordRows.length,
    kaomoji_locale: localeRows.length,
    source_attribution: attributionRows.length,
    relationship_insert: relationshipRows.length,
    relationship_delete: opts.insertOnlyRelationships ? 0 : removedRelationships.length,
    insert_only_relationships: opts.insertOnlyRelationships ?? false,
    expected_relationship_count: expectedRelCount,
    sql_files: sqlFiles.length,
  };

  writeFileSync(join(incrementalDir, "summary.json"), JSON.stringify(summary, null, 2) + "\n", "utf8");
  return { summary, sqlFiles };
}

async function executeIncremental(remote: boolean): Promise<void> {
  const files = readdirSync(incrementalDir)
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => {
      const order = [
        "kaomoji-batch",
        "relationship-delete",
        "kaomoji_category",
        "kaomoji_keyword",
        "kaomoji_locale",
        "source_attribution",
        "relationship-batch",
        "search_metadata",
      ];
      const ai = order.findIndex((p) => a.startsWith(p));
      const bi = order.findIndex((p) => b.startsWith(p));
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
    });

  const resume = process.argv.includes("--resume");
  let startIndex = 0;
  if (resume && remote) {
    const current = queryCount(rootDir, "kaomoji", true) ?? BASELINE_PUBLIC;
    const alreadyInserted = current - BASELINE_PUBLIC;
    if (alreadyInserted > 0) {
      const kaomojiFiles = files.filter((f) => f.startsWith("kaomoji-batch"));
      const batchesDone = Math.min(kaomojiFiles.length, Math.floor(alreadyInserted / 25));
      startIndex = batchesDone;
      console.log(`Resume: ${alreadyInserted} kaomoji inserted, skipping ${batchesDone} kaomoji batches`);
    }
  }

  console.log("Executing", files.length - startIndex, "incremental SQL files", remote ? "(remote)" : "(local)");
  for (let i = startIndex; i < files.length; i++) {
    const file = files[i]!;
    const rel = join("data", "kaomoji", "processed", "final", "d1-incremental", file).replace(/\\/g, "/");
    console.log(`  [${i + 1}/${files.length}] ${file}`);
    const result = await executeSqlWithRetry(rootDir, rel, remote);
    if (!result.ok) {
      console.error("Failed:", file, result.output.slice(-800));
      process.exit(1);
    }
  }

  if (remote) {
    const preflight = JSON.parse(
      readFileSync(join(rootDir, "data/kaomoji/processed/final/359-promotion-preflight.json"), "utf8"),
    ) as { tables: Record<string, { expected_after: number }> };
    const k = queryCount(rootDir, "kaomoji", true);
    const r = queryCount(rootDir, "relationship", true);
    console.log("D1 after incremental — kaomoji:", k, "relationship:", r);
    if (k !== preflight.tables.kaomoji?.expected_after) {
      console.error(`Kaomoji mismatch: expected ${preflight.tables.kaomoji?.expected_after}, got ${k}`);
      process.exit(1);
    }
    if (r !== preflight.tables.relationship?.expected_after) {
      console.error(`Relationship mismatch: expected ${preflight.tables.relationship?.expected_after}, got ${r}`);
      process.exit(1);
    }
  }
}

const BASELINE_PUBLIC = 50979;

const isMain = process.argv[1]?.includes("maximum-coverage-d1-incremental");
if (isMain) {
  if (process.argv.includes("--build-only")) {
    const backupDir = join(rootDir, "data/kaomoji/processed/final/pre-promotion-backup");
    const decisions = JSON.parse(
      readFileSync(join(rootDir, "data/kaomoji/processed/final/promotion-decisions.json"), "utf8"),
    ) as Array<{ canonical_id: string }>;
    const editorial = JSON.parse(readFileSync(join(backupDir, "editorial.json"), "utf8")) as Array<{ canonical_id: string }>;
    const result = buildIncrementalD1Export(rootDir, {
      previousPublicIds: new Set(editorial.map((r) => r.canonical_id)),
      promotedIds: new Set(decisions.map((d) => d.canonical_id)),
    });
    console.log(JSON.stringify(result.summary, null, 2));
  } else {
    void executeIncremental(process.argv.includes("--remote"));
  }
}
