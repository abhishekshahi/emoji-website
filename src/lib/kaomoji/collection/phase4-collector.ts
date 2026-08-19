import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { buildRawId } from "./ids";
import { fetchEmoticonDataEntries } from "./importers/emoticon-data";
import { fetchEmoticonsTextPhase4Entries } from "./importers/emoticonstext-phase4";
import { fetchFastEmojiPhase4Entries } from "./importers/fastemoji";
import { fetchKaomojiTaggedPhase4Entries } from "./importers/kaomoji-tagged-phase4";
import { fetchMesslettersPhase4Entries } from "./importers/messletters-phase4";
import { fetchWikipediaPhase4Entries } from "./importers/wikipedia-phase4";
import type { ImportEntry } from "./importers/types";
import { getSourceById } from "../sources/registry";
import {
  getFastEmojiCheckpointPath,
  getKaomojiRawDir,
  getKaomojiRawManifestPath,
  getKaomojiRawRecordsPath,
  getPhase4ManifestPath,
  getPhase4MesslettersManifestPath,
  getPhase4FastEmojiManifestPath,
} from "../storage/paths";
import type { Phase4CollectionManifest, Phase4SourceResult } from "../discovery/phase4/types";
import type { LicenseStatus, RawKaomojiRecord, SourceRecord, UniversalContentType } from "../types";
import { runPhase2UniversalPipeline } from "../pipeline/phase2";

export const PHASE4_COLLECTOR_VERSION = "4.0.0-phase4-acquisition";

const ACTIVE_SOURCES = [
  "emoticon-data",
  "kaomoji-tagged",
  "wikipedia",
  "messletters",
  "emoticonstext",
  "fastemoji",
] as const;

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
    collector_version: PHASE4_COLLECTOR_VERSION,
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

function countUniqueTexts(records: readonly RawKaomojiRecord[]): number {
  return new Set(records.map((r) => r.original_kaomoji)).size;
}

function buildSourceResult(
  sourceId: string,
  records: readonly RawKaomojiRecord[],
  opts: {
    discovered: number;
    accessible: number;
    collected: number;
    pages_discovered: number;
    pages_processed: number;
    pages_skipped: number;
    categories: number;
    content_types: UniversalContentType[];
    license_status: LicenseStatus;
    errors: string[];
    warnings: string[];
    new_raw: number;
    raw_before: number;
    raw_after: number;
    variants?: number;
    review?: number;
    blocked?: number;
  },
): Phase4SourceResult {
  const sourceRecords = records.filter((r) => r.source_id === sourceId);
  const unique = countUniqueTexts(sourceRecords);
  return {
    source_id: sourceId,
    discovered: opts.discovered,
    accessible: opts.accessible,
    collected: opts.collected,
    unique,
    duplicates: sourceRecords.length - unique,
    variants: opts.variants ?? 0,
    review: opts.review ?? (opts.license_status === "REVIEW_REQUIRED" ? sourceRecords.length : 0),
    blocked: opts.blocked ?? 0,
    pages_discovered: opts.pages_discovered,
    pages_processed: opts.pages_processed,
    pages_skipped: opts.pages_skipped,
    categories: opts.categories,
    content_types: opts.content_types,
    license_status: opts.license_status,
    errors: opts.errors,
    warnings: opts.warnings,
    new_raw: opts.new_raw,
    raw_before: opts.raw_before,
    raw_after: opts.raw_after,
  };
}

export interface Phase4PipelineOptions {
  readonly fetchFn?: typeof fetch;
  readonly fastEmojiMaxFetch?: number;
  readonly skipFastEmoji?: boolean;
}

export interface Phase4PipelineResult {
  readonly manifest: Phase4CollectionManifest;
}

/** Phase 4: maximum acquisition from 6 active sources — zero loss, no removal. */
export async function runPhase4AcquisitionPipeline(
  rootDir: string,
  options: Phase4PipelineOptions = {},
): Promise<Phase4PipelineResult> {
  const fetchFn = options.fetchFn ?? fetch;
  const runId = randomUUID();
  const timestamp = nowIso();
  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  const sourceResults: Phase4SourceResult[] = [];

  const recordsPath = getKaomojiRawRecordsPath(rootDir);
  const existingMap = new Map<string, RawKaomojiRecord>();
  if (existsSync(recordsPath)) {
    for (const r of JSON.parse(readFileSync(recordsPath, "utf8")) as RawKaomojiRecord[]) {
      existingMap.set(r.raw_id, r);
    }
  }
  const rawBefore = existingMap.size;
  let totalNew = 0;

  // Source 1: emoticon-data
  {
    const source = getSourceById("emoticon-data")!;
    const before = [...existingMap.values()].filter((r) => r.source_id === "emoticon-data").length;
    const entries = await fetchEmoticonDataEntries(fetchFn);
    const rawRecords = entries.map((e) => importEntryToRaw(e, source, runId, timestamp));
    const { added } = mergeRecords(existingMap, rawRecords);
    totalNew += added;
    const after = [...existingMap.values()].filter((r) => r.source_id === "emoticon-data").length;
    sourceResults.push(
      buildSourceResult("emoticon-data", [...existingMap.values()], {
        discovered: entries.length,
        accessible: entries.length,
        collected: after,
        pages_discovered: 1,
        pages_processed: 1,
        pages_skipped: 0,
        categories: new Set(entries.map((e) => e.source_category).filter(Boolean)).size,
        content_types: ["EMOTICON", "TEXT_FACE"],
        license_status: "APPROVED",
        errors: [],
        warnings: [],
        new_raw: added,
        raw_before: before,
        raw_after: after,
      }),
    );
  }

  // Source 2: kaomoji-tagged
  {
    const source = getSourceById("kaomoji-tagged")!;
    const before = [...existingMap.values()].filter((r) => r.source_id === "kaomoji-tagged").length;
    const result = await fetchKaomojiTaggedPhase4Entries(fetchFn);
    allErrors.push(...result.errors);
    const rawRecords = result.entries.map((e) => importEntryToRaw(e, source, runId, timestamp));
    const { added } = mergeRecords(existingMap, rawRecords);
    totalNew += added;
    const after = [...existingMap.values()].filter((r) => r.source_id === "kaomoji-tagged").length;
    sourceResults.push(
      buildSourceResult("kaomoji-tagged", [...existingMap.values()], {
        discovered: result.entries.length,
        accessible: result.entries.length,
        collected: after,
        pages_discovered: result.files_processed,
        pages_processed: result.files_processed,
        pages_skipped: 0,
        categories: new Set(result.entries.map((e) => e.source_category).filter(Boolean)).size,
        content_types: ["KAOMOJI"],
        license_status: "APPROVED",
        errors: result.errors,
        warnings: [],
        new_raw: added,
        raw_before: before,
        raw_after: after,
      }),
    );
  }

  // Source 3: Wikipedia
  {
    const source = getSourceById("wikipedia")!;
    const before = [...existingMap.values()].filter((r) => r.source_id === "wikipedia").length;
    const result = await fetchWikipediaPhase4Entries(fetchFn);
    allErrors.push(...result.errors);
    const rawRecords = result.entries.map((e) => importEntryToRaw(e, source, runId, timestamp));
    const { added } = mergeRecords(existingMap, rawRecords);
    totalNew += added;
    const after = [...existingMap.values()].filter((r) => r.source_id === "wikipedia").length;
    sourceResults.push(
      buildSourceResult("wikipedia", [...existingMap.values()], {
        discovered: result.entries.length,
        accessible: result.pages_processed,
        collected: after,
        pages_discovered: result.pages_discovered,
        pages_processed: result.pages_processed,
        pages_skipped: result.pages_discovered - result.pages_processed,
        categories: result.page_titles.length,
        content_types: ["EMOTICON", "KAOMOJI", "DESCRIPTION"],
        license_status: "ATTRIBUTION_REQUIRED",
        errors: result.errors,
        warnings: ["CC BY-SA attribution required"],
        new_raw: added,
        raw_before: before,
        raw_after: after,
      }),
    );
  }

  // Source 4: Messletters
  let messlettersGap = 0;
  {
    const source = getSourceById("messletters")!;
    const before = [...existingMap.values()].filter((r) => r.source_id === "messletters").length;
    const result = await fetchMesslettersPhase4Entries(fetchFn);
    allErrors.push(...result.errors);

    mkdirSync(getKaomojiRawDir(rootDir), { recursive: true });
    writeFileSync(
      getPhase4MesslettersManifestPath(rootDir),
      `${JSON.stringify({
        generated_at: nowIso(),
        pages_discovered: result.pages_discovered,
        pages_processed: result.pages_processed,
        html_entries: result.html_entries,
        unique_source_ids: result.unique_source_ids,
        category_appearances: result.category_appearances,
        errors: result.errors,
      }, null, 2)}\n`,
      "utf8",
    );

    const rawRecords = result.entries.map((e) => importEntryToRaw(e, source, runId, timestamp));
    const { added } = mergeRecords(existingMap, rawRecords);
    totalNew += added;
    const after = [...existingMap.values()].filter((r) => r.source_id === "messletters").length;
    const collectedIds = new Set(
      [...existingMap.values()]
        .filter((r) => r.source_id === "messletters")
        .map((r) => r.source_record_id?.split(":").pop() ?? r.source_record_id),
    );
    messlettersGap = Math.max(0, result.unique_source_ids - collectedIds.size);

    sourceResults.push(
      buildSourceResult("messletters", [...existingMap.values()], {
        discovered: result.category_appearances,
        accessible: result.html_entries,
        collected: after,
        pages_discovered: result.pages_discovered,
        pages_processed: result.pages_processed,
        pages_skipped: 0,
        categories: result.pages_discovered,
        content_types: ["KAOMOJI", "EMOTICON", "TEXT_FACE"],
        license_status: "REVIEW_REQUIRED",
        errors: result.errors,
        warnings: messlettersGap > 0 ? [`gap remaining: ${messlettersGap} source IDs`] : [],
        new_raw: added,
        raw_before: before,
        raw_after: after,
      }),
    );
  }

  // Source 5: EmoticonsText
  let emoticonstextGap = 0;
  {
    const source = getSourceById("emoticonstext")!;
    const before = [...existingMap.values()].filter((r) => r.source_id === "emoticonstext").length;
    const result = await fetchEmoticonsTextPhase4Entries(fetchFn);
    allErrors.push(...result.errors);
    const rawRecords = result.entries.map((e) => importEntryToRaw(e, source, runId, timestamp));
    const { added } = mergeRecords(existingMap, rawRecords);
    totalNew += added;
    const after = [...existingMap.values()].filter((r) => r.source_id === "emoticonstext").length;
    emoticonstextGap = Math.max(0, result.entries.length - after);

    sourceResults.push(
      buildSourceResult("emoticonstext", [...existingMap.values()], {
        discovered: result.entries.length,
        accessible: result.pages_with_data,
        collected: after,
        pages_discovered: result.pages_discovered,
        pages_processed: result.pages_processed,
        pages_skipped: result.pages_discovered - result.pages_processed,
        categories: 0,
        content_types: ["KAOMOJI", "EMOTICON", "TEXT_FACE", "SYMBOL"],
        license_status: "REVIEW_REQUIRED",
        errors: result.errors,
        warnings: [],
        new_raw: added,
        raw_before: before,
        raw_after: after,
      }),
    );
  }

  // Source 6: FastEmoji
  let fastemojiCanonical = 0;
  let fastemojiCollected = 0;
  let fastemojiRemaining = 0;
  if (!options.skipFastEmoji) {
    const source = getSourceById("fastemoji")!;
    const before = [...existingMap.values()].filter((r) => r.source_id === "fastemoji").length;
    const checkpointPath = getFastEmojiCheckpointPath(rootDir);
    const result = await fetchFastEmojiPhase4Entries(fetchFn, checkpointPath, {
      maxFetch: options.fastEmojiMaxFetch ?? 1500,
      maxCollect: 8000,
    });
    allErrors.push(...result.errors);
    allWarnings.push("FastEmoji: REVIEW_REQUIRED — raw preserved, publication blocked pending license review");

    writeFileSync(
      getPhase4FastEmojiManifestPath(rootDir),
      `${JSON.stringify({
        generated_at: nowIso(),
        stats: result.stats,
        canonical_records: result.canonical_records,
        collected: result.collected,
        remaining: result.remaining,
        pages_discovered: result.pages_discovered,
        pages_processed: result.pages_processed,
        errors: result.errors,
      }, null, 2)}\n`,
      "utf8",
    );

    const rawRecords = result.entries.map((e) => importEntryToRaw(e, source, runId, timestamp));
    const { added } = mergeRecords(existingMap, rawRecords);
    totalNew += added;
    const after = [...existingMap.values()].filter((r) => r.source_id === "fastemoji").length;
    fastemojiCanonical = result.canonical_records;
    fastemojiCollected = result.collected;
    fastemojiRemaining = result.remaining;

    sourceResults.push(
      buildSourceResult("fastemoji", [...existingMap.values()], {
        discovered: result.pages_discovered,
        accessible: result.canonical_records,
        collected: after,
        pages_discovered: result.pages_discovered,
        pages_processed: result.pages_processed,
        pages_skipped: Math.max(0, result.canonical_records - result.pages_processed),
        categories: result.stats.category,
        content_types: ["EMOJI", "EMOJI_SEQUENCE", "COMBINATION", "CATEGORY"],
        license_status: "REVIEW_REQUIRED",
        errors: result.errors,
        warnings: [`canonical=${result.canonical_records} collected=${result.collected} remaining=${result.remaining}`],
        new_raw: added,
        raw_before: before,
        raw_after: after,
      }),
    );
  }

  const records = [...existingMap.values()].sort((a, b) => a.raw_id.localeCompare(b.raw_id));
  const rawAfter = records.length;
  const removedRecords = Math.max(0, rawBefore - records.filter((r) => existingMap.has(r.raw_id)).length);

  mkdirSync(getKaomojiRawDir(rootDir), { recursive: true });
  writeFileSync(recordsPath, `${JSON.stringify(records, null, 2)}\n`, "utf8");

  const sourceCounts: Record<string, number> = {};
  for (const r of records) sourceCounts[r.source_id] = (sourceCounts[r.source_id] ?? 0) + 1;

  writeFileSync(
    getKaomojiRawManifestPath(rootDir),
    `${JSON.stringify({
      generated_at: nowIso(),
      collector_version: PHASE4_COLLECTOR_VERSION,
      run_id: runId,
      record_count: records.length,
      unique_original_count: countUniqueTexts(records),
      source_counts: sourceCounts,
    }, null, 2)}\n`,
    "utf8",
  );

  const phase2 = await runPhase2UniversalPipeline(rootDir, { fetchFn, skipNetworkCollection: true });

  const totalDiscovered = sourceResults.reduce((s, r) => s + r.discovered, 0);
  const totalCollected = sourceResults.reduce((s, r) => s + r.collected, 0);
  const totalUnique = countUniqueTexts(records);
  const totalDuplicates = records.length - totalUnique;

  const manifest: Phase4CollectionManifest = {
    phase: 4,
    timestamp: nowIso(),
    pipeline_version: "4.0.0-acquisition",
    collector_version: PHASE4_COLLECTOR_VERSION,
    raw_before: rawBefore,
    raw_after: rawAfter,
    new_raw_records: totalNew,
    removed_records: removedRecords,
    modified_existing_raw_records: rawAfter - rawBefore - totalNew,
    total_discovered: totalDiscovered,
    total_collected: totalCollected,
    total_raw: rawAfter,
    total_unique: totalUnique,
    total_duplicates: totalDuplicates,
    total_variants: 0,
    total_review: records.filter((r) => r.license_status === "REVIEW_REQUIRED").length,
    total_blocked: records.filter((r) => r.license_status === "NOT_PERMITTED").length,
    source_results: sourceResults,
    messletters_gap_remaining: messlettersGap,
    emoticonstext_gap_remaining: emoticonstextGap,
    fastemoji_canonical_records: fastemojiCanonical,
    fastemoji_collected: fastemojiCollected,
    fastemoji_remaining: fastemojiRemaining,
    textemoticons_status: "INACCESSIBLE",
    slangit_status: "INACCESSIBLE",
    provenance_coverage: phase2.manifest.provenance_coverage,
    idempotent_rerun_new_raw: null,
    warnings: allWarnings,
    errors: allErrors,
  };

  writeFileSync(getPhase4ManifestPath(rootDir), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return { manifest };
}

export function getPhase4ActiveSources(): readonly string[] {
  return ACTIVE_SOURCES;
}
