import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CanonicalRecord } from "../processing/phase8/types";
import type { PublicationGateResult } from "../processing/phase12/types";
import type { KaomojiCollection, KaomojiEditorialRecord, KaomojiRelationship } from "../processing/phase9/types";
import type { Phase10ScoredRecord } from "../processing/phase10/types";
import { hashRawFile } from "../processing/phase7/raw-snapshot";
import {
  getKaomojiRawRecordsPath,
  getPhase12PublicQualityDir,
  getPhase14SearchIndexPath,
  getPhase15LocaleRegistryPath,
  getPhase19ExportDir,
} from "../storage/paths";
import { PRODUCTION_VERSION, SCHEMA_VERSION, KAOMOJI_D1_BATCH_SIZE, KAOMOJI_D1_KAOMOJI_BATCH_SIZE, KAOMOJI_D1_RELATIONSHIP_BATCH_SIZE, getKaomojiCloudflareMode } from "./config";
import { sha256Buffer, sha256File } from "./checksum";
import {
  buildKaomojiChecksumsKey,
  buildKaomojiLocaleRegistryKey,
  buildKaomojiManifestKey,
  buildKaomojiSearchIndexKey,
} from "./r2-keys";
import type { Phase19ExportSummary, Phase19R2Manifest, Phase19R2Object } from "./types";

const EXPECTED_PUBLIC = 50979;
const EXPECTED_RELATIONSHIPS = 392904;

function writeJson(path: string, data: unknown): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function sqlEscape(value: string | null | undefined): string {
  if (value == null) return "NULL";
  return "'" + String(value).replace(/'/g, "''") + "'";
}

function sqlInt(value: boolean | number): string {
  if (typeof value === "boolean") return value ? "1" : "0";
  return String(value);
}

function writeSqlBatch(baseDir: string, table: string, batchIndex: number, statements: readonly string[]): string {
  const dir = join(baseDir, table);
  const name = `${table}-batch-${String(batchIndex).padStart(3, "0")}.sql`;
  const path = join(dir, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, statements.join("\n") + "\n", "utf8");
  return join(table, name).replace(/\\/g, "/");
}

function batchInsert(
  baseDir: string,
  table: string,
  columns: readonly string[],
  rows: readonly (readonly string[])[],
  batchSize: number = KAOMOJI_D1_BATCH_SIZE,
): string[] {
  if (rows.length === 0) return [];
  const files: string[] = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const values = chunk.map((r) => "(" + r.join(", ") + ")").join(",\n");
    const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES\n${values};`;
    files.push(writeSqlBatch(baseDir, table, Math.floor(i / batchSize), [sql]));
  }
  return files;
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function fileBytes(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

export function buildPhase19Export(rootDir: string): Phase19ExportSummary {
  const libDir = getPhase12PublicQualityDir(rootDir);
  const exportDir = getPhase19ExportDir(rootDir);
  const d1Root = join(exportDir, "d1");
  const r2Public = join(exportDir, "r2", "public");
  const r2Rebuildable = join(exportDir, "r2", "rebuildable");
  const r2Backup = join(exportDir, "r2", "backup");
  mkdirSync(d1Root, { recursive: true });
  mkdirSync(r2Public, { recursive: true });
  mkdirSync(r2Rebuildable, { recursive: true });
  mkdirSync(r2Backup, { recursive: true });

  const editorial = loadJson<KaomojiEditorialRecord[]>(join(libDir, "editorial.json")).filter((r) => r.is_public);
  const scores = loadJson<Phase10ScoredRecord[]>(join(libDir, "scores.json"));
  const gates = loadJson<PublicationGateResult[]>(join(libDir, "publication-gate.json"));
  const relationshipsRaw = loadJson<KaomojiRelationship[]>(join(libDir, "relationships.json"));
  const collections = loadJson<KaomojiCollection[]>(join(libDir, "collections.json"));
  const provenance = loadJson<Array<{
    canonical_id: string;
    source_occurrences: CanonicalRecord["source_occurrences"];
  }>>(join(libDir, "provenance.json"));

  const scoresById = new Map(scores.map((s) => [s.canonical_id, s]));
  const gateById = new Map(gates.map((g) => [g.canonical_id, g]));
  const publicIds = new Set(editorial.map((r) => r.canonical_id));

  const validRelationships = relationshipsRaw.filter(
    (r) => publicIds.has(r.from_canonical_id) && publicIds.has(r.to_canonical_id),
  );
  const relationshipsRejected = relationshipsRaw.length - validRelationships.length;

  if (editorial.length !== EXPECTED_PUBLIC) {
    throw new Error(`Phase 19 export expected ${EXPECTED_PUBLIC} public records, got ${editorial.length}`);
  }
  if (validRelationships.length !== EXPECTED_RELATIONSHIPS) {
    throw new Error(
      `Phase 19 export expected ${EXPECTED_RELATIONSHIPS} valid relationships, got ${validRelationships.length} (rejected ${relationshipsRejected})`,
    );
  }

  const categoryMap = new Map<string, { group_name: string; label: string }>();
  for (const r of editorial) {
    for (const c of r.emojiquick_categories) {
      if (!categoryMap.has(c.slug)) categoryMap.set(c.slug, { group_name: c.group, label: c.label });
    }
  }

  const keywordSet = new Set<string>();
  for (const r of editorial) {
    for (const k of r.emojiquick_keywords) keywordSet.add(k.toLowerCase());
    for (const k of r.source_keywords) keywordSet.add(k.toLowerCase());
  }

  const kaomojiRows: string[][] = [];
  const categoryLinkRows: string[][] = [];
  const kaomojiKeywordRows: string[][] = [];
  const localeRows: string[][] = [];
  const attributionRows: string[][] = [];

  for (const r of editorial) {
    const sc = scoresById.get(r.canonical_id);
    const gate = gateById.get(r.canonical_id);
    if (!sc || !gate?.publication_eligible) {
      throw new Error(`Missing or ineligible public record: ${r.canonical_id}`);
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

  const categoryRows = [...categoryMap.entries()].map(([slug, meta]) => [
    sqlEscape(slug),
    sqlEscape(meta.group_name),
    sqlEscape(meta.label),
  ]);

  const keywordRowsData = [...keywordSet].sort().map((k) => [sqlEscape(k)]);

  const relationshipRows = validRelationships.map((r) => [
    sqlEscape(r.from_canonical_id),
    sqlEscape(r.to_canonical_id),
    sqlEscape(r.relationship_type),
    sqlEscape(r.confidence),
    String(r.score),
  ]);

  const collectionRows = collections.map((c) => [
    sqlEscape(c.slug),
    sqlEscape(c.title),
    sqlEscape(c.description),
    sqlEscape(c.rule),
    String(c.canonical_ids.length),
  ]);

  const collectionItemRows: string[][] = [];
  for (const c of collections) {
    c.canonical_ids.forEach((id, idx) => {
      if (!publicIds.has(id)) throw new Error(`Collection ${c.slug} references non-public id ${id}`);
      collectionItemRows.push([sqlEscape(c.slug), sqlEscape(id), String(idx)]);
    });
  }

  for (const p of provenance) {
    if (!publicIds.has(p.canonical_id)) continue;
    const seen = new Set<string>();
    for (const occ of p.source_occurrences ?? []) {
      const key = occ.source_id;
      if (seen.has(key)) continue;
      seen.add(key);
      attributionRows.push([
        sqlEscape(p.canonical_id),
        sqlEscape(occ.source_id),
        sqlEscape(occ.source_url ?? null),
        sqlEscape(occ.source_record_id ?? null),
        sqlEscape(occ.license_status),
      ]);
    }
  }

  const localeRegistryPath = getPhase15LocaleRegistryPath(rootDir);
  const localeRegistry = loadJson<Record<string, unknown>>(localeRegistryPath);
  for (const bundle of (localeRegistry.bundles as Array<{ locale: string; status: string }>)) {
    if (bundle.status !== "PUBLISHED") continue;
    localeRows.push([sqlEscape(bundle.locale), sqlEscape(""), sqlEscape("bundle_status"), sqlEscape(bundle.status)]);
  }

  const searchMetaRows = [
    [sqlEscape("public_record_count"), sqlEscape(String(editorial.length)), sqlEscape(new Date().toISOString())],
    [sqlEscape("relationship_count"), sqlEscape(String(validRelationships.length)), sqlEscape(new Date().toISOString())],
    [sqlEscape("schema_version"), sqlEscape(SCHEMA_VERSION), sqlEscape(new Date().toISOString())],
    [sqlEscape("production_version"), sqlEscape(PRODUCTION_VERSION), sqlEscape(new Date().toISOString())],
  ];

  const releaseChecksum = sha256Buffer(JSON.stringify({ editorial: editorial.length, relationships: validRelationships.length }));
  const productionReleaseRows = [[
    sqlEscape(PRODUCTION_VERSION),
    sqlEscape(SCHEMA_VERSION),
    sqlEscape(PRODUCTION_VERSION),
    String(editorial.length),
    String(validRelationships.length),
    String(collections.length),
    sqlEscape(new Date().toISOString()),
    sqlEscape(releaseChecksum),
    "NULL",
    sqlEscape(buildKaomojiManifestKey()),
    sqlEscape("0001_schema.sql"),
  ]];

  const sqlFiles: string[] = [];
  sqlFiles.push(...batchInsert(d1Root, "kaomoji", [
    "canonical_id", "slug", "content", "normalized_content", "content_type",
    "publication_status", "curation_status", "license_status", "provenance_status", "is_public",
    "quality_score", "quality_bucket", "beauty_score", "overall_score",
    "editorial_name", "accessible_name", "seo_title", "seo_description",
    "editorial_tier", "editorial_priority", "meaning", "common_usage",
    "duplicate_group_id", "variant_group_id", "popularity_status",
  ], kaomojiRows, KAOMOJI_D1_KAOMOJI_BATCH_SIZE));
  sqlFiles.push(...batchInsert(d1Root, "category", ["slug", "group_name", "label"], categoryRows));
  sqlFiles.push(...batchInsert(d1Root, "kaomoji_category", ["canonical_id", "category_slug", "is_primary"], categoryLinkRows));
  sqlFiles.push(...batchInsert(d1Root, "keyword", ["keyword"], keywordRowsData));
  sqlFiles.push(...batchInsert(d1Root, "kaomoji_keyword", ["canonical_id", "keyword", "source"], kaomojiKeywordRows));
  sqlFiles.push(...batchInsert(d1Root, "relationship", [
    "from_canonical_id", "to_canonical_id", "relationship_type", "confidence", "score",
  ], relationshipRows, KAOMOJI_D1_RELATIONSHIP_BATCH_SIZE));
  sqlFiles.push(...batchInsert(d1Root, "collection", ["slug", "title", "description", "rule", "item_count"], collectionRows));
  sqlFiles.push(...batchInsert(d1Root, "collection_item", ["collection_slug", "canonical_id", "sort_order"], collectionItemRows));
  sqlFiles.push(...batchInsert(d1Root, "kaomoji_locale", ["locale", "canonical_id", "field_key", "field_value"], localeRows));
  sqlFiles.push(...batchInsert(d1Root, "search_metadata", ["key", "value", "updated_at"], searchMetaRows));
  sqlFiles.push(...batchInsert(d1Root, "production_release", [
    "version", "schema_version", "production_version", "record_count", "relationship_count",
    "collection_count", "released_at", "checksum_sha256", "rollback_version", "r2_manifest_key", "d1_migration",
  ], productionReleaseRows));
  sqlFiles.push(...batchInsert(d1Root, "source_attribution", [
    "canonical_id", "source_id", "source_url", "source_record_id", "license_status",
  ], attributionRows));

  const searchIndexSrc = getPhase14SearchIndexPath(rootDir);
  const searchIndexDest = join(r2Public, "search-index-v2.json");
  const localeDest = join(r2Public, "locale-registry.json");
  writeFileSync(searchIndexDest, readFileSync(searchIndexSrc));
  writeFileSync(localeDest, readFileSync(localeRegistryPath));

  const checksumEntries: Array<{ path: string; sha256: string; bytes: number }> = [];
  const r2Objects: Phase19R2Object[] = [];

  function trackR2(localPath: string, key: string, contentType: string, category: Phase19R2Object["category"]): void {
    const { sha256, bytes } = sha256File(localPath);
    checksumEntries.push({ path: key, sha256, bytes });
    r2Objects.push({ key, content_type: contentType, bytes, sha256, category });
  }

  trackR2(searchIndexDest, buildKaomojiSearchIndexKey(), "application/json", "public");
  trackR2(localeDest, buildKaomojiLocaleRegistryKey(), "application/json", "public");

  function walkSqlFiles(dir: string, prefix = ""): void {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walkSqlFiles(full, rel);
      else if (entry.name.endsWith(".sql")) {
        const key = buildKaomojiManifestKey().replace("/manifest.json", "/d1/" + rel);
        trackR2(full, key, "application/sql", "rebuildable");
      }
    }
  }
  walkSqlFiles(d1Root);

  const manifestPath = join(r2Rebuildable, "manifest.json");
  const checksumsPath = join(r2Rebuildable, "checksums.json");
  const rollbackPath = join(r2Backup, "rollback-manifest.json");

  const r2Manifest: Phase19R2Manifest = {
    production_version: PRODUCTION_VERSION,
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    public_records: editorial.length,
    relationships: validRelationships.length,
    collections: collections.length,
    objects: r2Objects,
    checksums: checksumEntries,
  };
  writeJson(manifestPath, r2Manifest);
  writeJson(checksumsPath, { version: PRODUCTION_VERSION, entries: checksumEntries });
  writeJson(rollbackPath, {
    version: PRODUCTION_VERSION,
    schema_version: SCHEMA_VERSION,
    cloudflare_mode: getKaomojiCloudflareMode(),
    previous_version: null,
    rollback_steps: [
      "Restore prior production_release row",
      "Re-upload rollback R2 manifest",
      "Set KAOMOJI_CLOUDFLARE_MODE=OFF",
    ],
    manifest_key: buildKaomojiManifestKey(),
    checksums_key: buildKaomojiChecksumsKey(),
    raw_sha256: hashRawFile(getKaomojiRawRecordsPath(rootDir)).sha256,
  });

  trackR2(manifestPath, buildKaomojiManifestKey(), "application/json", "rebuildable");
  trackR2(checksumsPath, buildKaomojiChecksumsKey(), "application/json", "rebuildable");

  const d1BatchCount = Math.ceil(kaomojiRows.length / KAOMOJI_D1_KAOMOJI_BATCH_SIZE);
  const rowEstimate =
    kaomojiRows.length +
    categoryRows.length +
    categoryLinkRows.length +
    keywordRowsData.length +
    kaomojiKeywordRows.length +
    relationshipRows.length +
    collectionRows.length +
    collectionItemRows.length +
    localeRows.length +
    searchMetaRows.length +
    productionReleaseRows.length +
    attributionRows.length;

  return {
    public_records: editorial.length,
    relationships: validRelationships.length,
    relationships_rejected: relationshipsRejected,
    collections: collections.length,
    categories: categoryRows.length,
    keywords: keywordRowsData.length,
    d1_batches: d1BatchCount,
    d1_sql_files: sqlFiles.length,
    d1_row_estimate: rowEstimate,
    r2_manifest_path: manifestPath,
    checksums_path: checksumsPath,
    export_dir: exportDir,
  };
}
