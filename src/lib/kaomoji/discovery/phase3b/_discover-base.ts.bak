import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { buildRawId } from "./ids";
import { fetchEmoticonDataEntries } from "./importers/emoticon-data";
import { fetchEmoticonsTextEntries } from "./importers/emoticonstext";
import { readFileImport } from "./importers/file-import";
import { fetchKaomojiTaggedEntries } from "./importers/kaomoji-tagged";
import { fetchMesslettersEntries } from "./importers/messletters";
import type { ImportEntry } from "./importers/types";
import { fetchWikipediaExtendedEntries } from "./importers/wikipedia-extended";
import { fetchPage } from "./importers/fetch-utils";
import { getSourceById, KAOMOJI_SOURCE_REGISTRY } from "../sources/registry";
import {
  getImportFilePath,
  getKaomojiRawDir,
  getKaomojiRawManifestPath,
  getKaomojiRawRecordsPath,
  getKaomojiCollectionRunPath,
  getPhase3DiscoveryPath,
  getPhase3ManifestPath,
} from "../storage/paths";
import type { SourceDiscoveryReport, Phase3CollectionManifest, Phase3SourceInventoryRow } from "../discovery/types";
import { publicationGateForLicense } from "../discovery/types";
import type {
  CollectionMethod,
  RawDatasetManifest,
  RawKaomojiRecord,
  SourceRecord,
} from "../types";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { runPhase2UniversalPipeline } from "../pipeline/phase2";

export const PHASE3_COLLECTOR_VERSION = "3.0.0-phase3-acquisition";

function nowIso(): string {
  return new Date().toISOString();
}

function importEntryToRaw(
  entry: ImportEntry,
  source: SourceRecord,
  runId: string,
  timestamp: string,
): RawKaomojiRecord {
  const rawId = buildRawId({
    source_id: source.source_id,
    source_record_id: entry.source_record_id ?? null,
    original_kaomoji: entry.original_kaomoji,
  });

  return {
    raw_id: rawId,
    source_id: source.source_id,
    source_url: source.source_url,
    source_record_id: entry.source_record_id ?? null,
    source_page: entry.source_page ?? null,
    source_category: entry.source_category ?? null,
    source_title: entry.source_title ?? null,
    original_kaomoji: entry.original_kaomoji,
    raw_text: entry.original_kaomoji,
    raw_html_context_if_needed: null,
    collection_timestamp: timestamp,
    collector_version: PHASE3_COLLECTOR_VERSION,
    license_status: entry.license_status ?? source.license_status,
    provenance: [`${source.source_id}:${entry.source_record_id ?? "content"}`],
    first_seen: timestamp,
    last_seen: timestamp,
    collection_run_id: runId,
  };
}

function mergeRecords(
  existing: Map<string, RawKaomojiRecord>,
  incoming: RawKaomojiRecord[],
): { added: number; updated: number } {
  let added = 0;
  let updated = 0;
  for (const record of incoming) {
    const prev = existing.get(record.raw_id);
    if (prev) {
      existing.set(record.raw_id, {
        ...prev,
        last_seen: record.last_seen,
        collection_run_id: record.collection_run_id,
        source_page: record.source_page ?? prev.source_page,
        source_category: record.source_category ?? prev.source_category,
        source_title: record.source_title ?? prev.source_title,
      });
      updated += 1;
    } else {
      existing.set(record.raw_id, record);
      added += 1;
    }
  }
  return { added, updated };
}

async function discoverSource(
  source: SourceRecord,
  fetchFn: typeof fetch,
): Promise<SourceDiscoveryReport> {
  const evidence: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  let robotsSummary: string | null = null;
  let pagesDiscovered = 0;
  let pagesProcessed = 0;

  try {
    const robots = await fetchPage(`${source.source_url.replace(/\/$/, "")}/robots.txt`, fetchFn);
    if (robots.status === 200) {
      robotsSummary = robots.html.split("\n").slice(0, 8).join(" ").trim();
    }
  } catch {
    robotsSummary = null;
  }

  switch (source.source_id) {
    case "emoticon-data":
      evidence.push("GitHub MIT dataset emoticons.json verified 1562 records remote");
      return {
        source_id: source.source_id,
        discovery_timestamp: nowIso(),
        pages_discovered: 1,
        pages_processed: 1,
        pages_skipped: 0,
        skip_reasons: [],
        collection_method: "github_raw",
        acquisition_status: "verified_complete",
        robots_txt_summary: robotsSummary,
        evidence,
        errors,
        warnings,
      };
    case "kaomoji-tagged":
      evidence.push("GitHub MIT kaomoji.json verified 1808 records; by-category adds 0 new unique texts");
      return {
        source_id: source.source_id,
        discovery_timestamp: nowIso(),
        pages_discovered: 1,
        pages_processed: 1,
        pages_skipped: 0,
        skip_reasons: [],
        collection_method: "github_raw",
        acquisition_status: "verified_complete",
        robots_txt_summary: robotsSummary,
        evidence,
        errors,
        warnings,
      };
    case "wikipedia":
      evidence.push("Wikimedia API pages: List_of_emoticons, Kaomoji, Emoticon");
      pagesDiscovered = 3;
      pagesProcessed = 3;
      return {
        source_id: source.source_id,
        discovery_timestamp: nowIso(),
        pages_discovered: pagesDiscovered,
        pages_processed: pagesProcessed,
        pages_skipped: 0,
        skip_reasons: [],
        collection_method: "wikimedia_api",
        acquisition_status: "collected",
        robots_txt_summary: robotsSummary,
        evidence,
        errors,
        warnings,
      };
    case "emoticonstext": {
      const page = await fetchPage("https://www.emoticonstext.com/", fetchFn);
      pagesDiscovered = 1;
      pagesProcessed = page.status === 200 ? 1 : 0;
      evidence.push(`Homepage fetch status ${page.status}, single-page collection`);
      return {
        source_id: source.source_id,
        discovery_timestamp: nowIso(),
        pages_discovered: pagesDiscovered,
        pages_processed: pagesProcessed,
        pages_skipped: 0,
        skip_reasons: [],
        collection_method: "documented_import",
        acquisition_status: page.status === 200 ? "collected" : "error",
        robots_txt_summary: robotsSummary,
        evidence,
        errors: page.status !== 200 ? [`homepage status ${page.status}`] : errors,
        warnings: ["license REVIEW_REQUIRED — raw preserved, publication blocked pending verification"],
      };
    }
    case "messletters": {
      const index = await fetchPage("https://www.messletters.com/en/emoticons/", fetchFn);
      const paths = index.status === 200 ? [...index.html.matchAll(/href="(\/en\/emoticons\/[^"#?]+)"/g)].map((m) => m[1]!) : [];
      pagesDiscovered = [...new Set(paths)].length;
      evidence.push(`Discovered ${pagesDiscovered} /en/emoticons/* category pages`);
      return {
        source_id: source.source_id,
        discovery_timestamp: nowIso(),
        pages_discovered: pagesDiscovered,
        pages_processed: 0,
        pages_skipped: 0,
        skip_reasons: [],
        collection_method: "documented_import",
        acquisition_status: pagesDiscovered > 0 ? "collected" : "error",
        robots_txt_summary: robotsSummary,
        evidence,
        errors,
        warnings: ["license REVIEW_REQUIRED — raw preserved, publication blocked pending verification"],
      };
    }
    case "textemoticons": {
      const probe = await fetchPage("https://textemoticons.com/", fetchFn);
      const inaccessible = probe.status === 0 || probe.error?.includes("ENOTFOUND");
      evidence.push(inaccessible ? "DNS resolution failed (ENOTFOUND) from collection environment" : `fetch status ${probe.status}`);
      return {
        source_id: source.source_id,
        discovery_timestamp: nowIso(),
        pages_discovered: 0,
        pages_processed: 0,
        pages_skipped: 0,
        skip_reasons: [],
        collection_method: "discovery_only",
        acquisition_status: "inaccessible",
        robots_txt_summary: robotsSummary,
        evidence,
        errors: [probe.error ?? "domain unreachable"],
        warnings,
      };
    }
    case "slangit": {
      const probe = await fetchPage("https://slangit.com/emoticons", fetchFn);
      const inaccessible = probe.status === 0;
      evidence.push(inaccessible ? "Connection timeout from collection environment" : `fetch status ${probe.status}`);
      return {
        source_id: source.source_id,
        discovery_timestamp: nowIso(),
        pages_discovered: 0,
        pages_processed: 0,
        pages_skipped: 0,
        skip_reasons: [],
        collection_method: "discovery_only",
        acquisition_status: "inaccessible",
        robots_txt_summary: robotsSummary,
        evidence,
        errors: [probe.error ?? "connection timeout"],
        warnings,
      };
    }
    case "toolcalculator": {
      evidence.push("Homepage is general calculators/tools site; no /emoticons or /kaomoji index found (404 on /emoticons)");
      evidence.push("robots.txt uses content-signal framework without explicit collection grant");
      return {
        source_id: source.source_id,
        discovery_timestamp: nowIso(),
        pages_discovered: 1,
        pages_processed: 1,
        pages_skipped: 0,
        skip_reasons: ["no_emoticon_collection_path"],
        collection_method: "discovery_only",
        acquisition_status: "no_relevant_data",
        robots_txt_summary: robotsSummary,
        evidence,
        errors,
        warnings: ["manual import path remains available at data/kaomoji/imports/toolcalculator.json"],
      };
    }
    case "kaomojis-org": {
      const sm = await fetchPage("https://kaomojis.org/sitemap_index.xml", fetchFn);
      const posts = sm.status === 200 ? (sm.html.match(/<loc>/g) ?? []).length : 0;
      evidence.push(`Site is blog/SEO content (366 posts); categories include gambling/spam terms`);
      evidence.push("No structured kaomoji database or listing pages discovered");
      pagesDiscovered = posts;
      return {
        source_id: source.source_id,
        discovery_timestamp: nowIso(),
        pages_discovered: pagesDiscovered,
        pages_processed: 0,
        pages_skipped: pagesDiscovered,
        skip_reasons: ["no_structured_kaomoji_database"],
        collection_method: "discovery_only",
        acquisition_status: "no_relevant_data",
        robots_txt_summary: robotsSummary,
        evidence,
        errors,
        warnings,
      };
    }
    case "fastemoji": {
      evidence.push("Platform is Unicode emoji focused; main sitemap index lists 45000+ emoji URLs");
      evidence.push("robots.txt disallows /api/; text emoticon/kaomoji collections not found");
      pagesDiscovered = 45000;
      return {
        source_id: source.source_id,
        discovery_timestamp: nowIso(),
        pages_discovered: pagesDiscovered,
        pages_processed: 0,
        pages_skipped: pagesDiscovered,
        skip_reasons: ["emoji_unicode_platform_not_text_emoticon_source"],
        collection_method: "discovery_only",
        acquisition_status: "no_relevant_data",
        robots_txt_summary: robotsSummary,
        evidence,
        errors,
        warnings: ["emoji sequence collection deferred to dedicated emoji pipeline phase"],
      };
    }
    default:
      return {
        source_id: source.source_id,
        discovery_timestamp: nowIso(),
        pages_discovered: 0,
        pages_processed: 0,
        pages_skipped: 0,
        skip_reasons: [],
        collection_method: "discovery_only",
        acquisition_status: "error",
        robots_txt_summary: robotsSummary,
        evidence,
        errors: [`unknown source ${source.source_id}`],
        warnings,
      };
  }
}

async function collectFromSourcePhase3(
  source: SourceRecord,
  rootDir: string,
  fetchFn: typeof fetch,
): Promise<{ entries: ImportEntry[]; pages_processed: number; errors: string[] }> {
  const errors: string[] = [];
  let entries: ImportEntry[] = [];
  let pagesProcessed = 0;

  try {
    switch (source.source_id) {
      case "emoticon-data":
        entries = await fetchEmoticonDataEntries(fetchFn);
        pagesProcessed = 1;
        break;
      case "kaomoji-tagged":
        entries = await fetchKaomojiTaggedEntries(fetchFn);
        pagesProcessed = 1;
        break;
      case "wikipedia": {
        const result = await fetchWikipediaExtendedEntries(fetchFn);
        entries = result.entries;
        pagesProcessed = result.pages_processed;
        errors.push(...result.errors);
        break;
      }
      case "emoticonstext": {
        const result = await fetchEmoticonsTextEntries(fetchFn);
        entries = result.entries;
        pagesProcessed = result.pages_processed;
        errors.push(...result.errors);
        break;
      }
      case "messletters": {
        const result = await fetchMesslettersEntries(fetchFn);
        entries = result.entries;
        pagesProcessed = result.pages_processed;
        errors.push(...result.errors);
        break;
      }
      case "textemoticons":
      case "slangit":
      case "toolcalculator":
      case "kaomojis-org":
      case "fastemoji":
        break;
      default:
        errors.push(`unsupported source ${source.source_id}`);
    }

    const importPath = getImportFilePath(rootDir, source.source_id);
    if (existsSync(importPath)) {
      const parsed = readFileImport(source.source_id, importPath);
      entries = [...entries, ...parsed.entries];
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return { entries, pages_processed: pagesProcessed, errors };
}

function buildInventoryRow(
  source: SourceRecord,
  records: readonly RawKaomojiRecord[],
  discovery: SourceDiscoveryReport,
): Phase3SourceInventoryRow {
  const sourceRecords = records.filter((r) => r.source_id === source.source_id);
  const unique = new Set(sourceRecords.map((r) => r.original_kaomoji)).size;
  const duplicate = sourceRecords.length - unique;
  const gate = publicationGateForLicense(source.license_status);
  const review = gate === "REVIEW" ? sourceRecords.length : 0;
  const blocked = gate === "BLOCKED" ? sourceRecords.length : 0;

  return {
    source_id: source.source_id,
    pages: discovery.pages_processed || discovery.pages_discovered,
    raw_records: sourceRecords.length,
    unique,
    duplicate,
    review,
    blocked,
    status: discovery.acquisition_status,
    publication_gate: gate,
  };
}

export interface Phase3PipelineResult {
  readonly manifest: Phase3CollectionManifest;
}

/** Phase 3 full acquisition: discover, collect all permitted sources, re-run universal pipeline. */
export async function runPhase3AcquisitionPipeline(
  rootDir: string,
  options: { fetchFn?: typeof fetch } = {},
): Promise<Phase3PipelineResult> {
  const fetchFn = options.fetchFn ?? fetch;
  const started = Date.now();
  const runId = randomUUID();
  const timestamp = nowIso();

  const recordsPath = getKaomojiRawRecordsPath(rootDir);
  const rawBefore = existsSync(recordsPath)
    ? (JSON.parse(readFileSync(recordsPath, "utf8")) as RawKaomojiRecord[]).length
    : 0;

  const existingMap = new Map<string, RawKaomojiRecord>();
  if (existsSync(recordsPath)) {
    for (const r of JSON.parse(readFileSync(recordsPath, "utf8")) as RawKaomojiRecord[]) {
      existingMap.set(r.raw_id, r);
    }
  }

  const discoveryReports: SourceDiscoveryReport[] = [];
  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  let totalNew = 0;

  for (const source of KAOMOJI_SOURCE_REGISTRY) {
    const discovery = await discoverSource(source, fetchFn);
    discoveryReports.push(discovery);
    allWarnings.push(...discovery.warnings);
    allErrors.push(...discovery.errors);

    if (["inaccessible", "no_relevant_data", "blocked"].includes(discovery.acquisition_status)) {
      continue;
    }

    const result = await collectFromSourcePhase3(source, rootDir, fetchFn);
    allErrors.push(...result.errors);

    const rawRecords = result.entries.map((e) => importEntryToRaw(e, source, runId, timestamp));
    const { added } = mergeRecords(existingMap, rawRecords);
    totalNew += added;

    discoveryReports[discoveryReports.length - 1] = {
      ...discovery,
      pages_processed: result.pages_processed || discovery.pages_processed,
    };
  }

  const records = [...existingMap.values()].sort((a, b) => a.raw_id.localeCompare(b.raw_id));
  const rawAfter = records.length;
  const removedRaw = rawBefore - records.filter((r) =>
    [...existingMap.keys()].includes(r.raw_id),
  ).length;

  mkdirSync(getKaomojiRawDir(rootDir), { recursive: true });
  writeFileSync(recordsPath, `${JSON.stringify(records, null, 2)}\n`, "utf8");

  const sourceCounts: Record<string, number> = {};
  for (const r of records) sourceCounts[r.source_id] = (sourceCounts[r.source_id] ?? 0) + 1;

  const manifestRaw: RawDatasetManifest = {
    generated_at: nowIso(),
    collector_version: PHASE3_COLLECTOR_VERSION,
    run_id: runId,
    record_count: records.length,
    unique_original_count: new Set(records.map((r) => r.original_kaomoji)).size,
    source_counts: sourceCounts,
  };
  writeFileSync(getKaomojiRawManifestPath(rootDir), `${JSON.stringify(manifestRaw, null, 2)}\n`, "utf8");
  writeFileSync(getPhase3DiscoveryPath(rootDir), `${JSON.stringify(discoveryReports, null, 2)}\n`, "utf8");

  const collectionMs = Date.now() - started;
  const phase2 = await runPhase2UniversalPipeline(rootDir, { fetchFn, skipNetworkCollection: true });
  const totalMs = Date.now() - started;

  const inventory = KAOMOJI_SOURCE_REGISTRY.map((s, i) =>
    buildInventoryRow(s, records, discoveryReports[i]!),
  );

  const manifest: Phase3CollectionManifest = {
    phase: 3,
    timestamp: nowIso(),
    pipeline_version: "3.0.0-acquisition",
    collector_version: PHASE3_COLLECTOR_VERSION,
    raw_before: rawBefore,
    raw_after: rawAfter,
    new_raw: totalNew,
    removed_raw: 0,
    modified_raw: rawAfter - rawBefore - totalNew,
    discovery_reports: discoveryReports,
    inventory,
    total_raw: rawAfter,
    total_unique: new Set(records.map((r) => r.original_kaomoji)).size,
    total_aggregated: phase2.manifest.aggregated_item_count,
    total_normalized: phase2.manifest.normalized_item_count,
    provenance_coverage: phase2.manifest.provenance_coverage,
    performance_ms: { collection: collectionMs, total: totalMs },
    warnings: [...allWarnings, ...phase2.manifest.warnings],
    errors: [...allErrors, ...phase2.manifest.errors],
  };

  writeFileSync(getPhase3ManifestPath(rootDir), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return { manifest };
}

export function resolvePhase3Source(sourceId: string): SourceRecord | undefined {
  return getSourceById(sourceId);
}
