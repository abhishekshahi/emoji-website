import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { buildRawId } from "./ids";
import { fetchEmoticonDataEntries } from "./importers/emoticon-data";
import { readFileImport } from "./importers/file-import";
import { fetchKaomojiTaggedEntries } from "./importers/kaomoji-tagged";
import type { CollectionResult, ImportEntry } from "./importers/types";
import { fetchWikipediaEntries } from "./importers/wikipedia";
import { getSourceById, listCollectionEnabledSources } from "../sources/registry";
import {
  getImportFilePath,
  getKaomojiRawDir,
  getKaomojiRawManifestPath,
  getKaomojiRawRecordsPath,
  getKaomojiCollectionRunPath,
} from "../storage/paths";
import type {
  CollectionRunManifest,
  CollectionMethod,
  RawDatasetManifest,
  RawKaomojiRecord,
  SourceRecord,
} from "../types";

export const COLLECTOR_VERSION = "1.0.0-phase1";

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
    collector_version: COLLECTOR_VERSION,
    license_status: entry.license_status ?? source.license_status,
    provenance: [`${source.source_id}:${entry.source_record_id ?? "content"}`],
    first_seen: timestamp,
    last_seen: timestamp,
    collection_run_id: runId,
  };
}

async function collectFromSource(
  source: SourceRecord,
  rootDir: string,
  fetchFn: typeof fetch,
): Promise<CollectionResult> {
  const errors: string[] = [];
  let entries: ImportEntry[] = [];

  try {
    switch (source.collection_method) {
      case "github_raw":
        if (source.source_id === "emoticon-data") {
          entries = await fetchEmoticonDataEntries(fetchFn);
        } else if (source.source_id === "kaomoji-tagged") {
          entries = await fetchKaomojiTaggedEntries(fetchFn);
        } else {
          errors.push(`unsupported github_raw source: ${source.source_id}`);
        }
        break;
      case "wikimedia_api":
        if (source.source_id === "wikipedia") {
          const result = await fetchWikipediaEntries(fetchFn);
          entries = result.entries;
          errors.push(...result.errors);
        } else {
          errors.push(`unsupported wikimedia source: ${source.source_id}`);
        }
        break;
      case "manual_import":
      case "documented_import": {
        const importPath = getImportFilePath(rootDir, source.source_id);
        if (!existsSync(importPath)) {
          return {
            source_id: source.source_id,
            collected: 0,
            skipped: 0,
            errors: [`import file not found: ${importPath}`],
            entries: [],
          };
        }
        const parsed = readFileImport(source.source_id, importPath);
        entries = [...parsed.entries];
        break;
      }
      default:
        errors.push(`unsupported collection method: ${source.collection_method}`);
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return {
    source_id: source.source_id,
    collected: entries.length,
    skipped: 0,
    errors,
    entries,
  };
}

function mergeRecords(
  existing: Map<string, RawKaomojiRecord>,
  incoming: RawKaomojiRecord[],
): { merged: Map<string, RawKaomojiRecord>; added: number; updated: number } {
  let added = 0;
  let updated = 0;
  const merged = new Map(existing);

  for (const record of incoming) {
    const prev = merged.get(record.raw_id);
    if (prev) {
      merged.set(record.raw_id, {
        ...prev,
        last_seen: record.last_seen,
        collection_run_id: record.collection_run_id,
        source_page: record.source_page ?? prev.source_page,
        source_category: record.source_category ?? prev.source_category,
        source_title: record.source_title ?? prev.source_title,
      });
      updated += 1;
    } else {
      merged.set(record.raw_id, record);
      added += 1;
    }
  }

  return { merged, added, updated };
}

export interface CollectionOutput {
  readonly records: RawKaomojiRecord[];
  readonly manifest: RawDatasetManifest;
  readonly runManifest: CollectionRunManifest;
}

/** Idempotent collection merge by raw_id with first_seen/last_seen tracking. */
export async function runCollection(
  rootDir: string,
  options: { fetchFn?: typeof fetch; runId?: string } = {},
): Promise<CollectionOutput> {
  const fetchFn = options.fetchFn ?? fetch;
  const runId = options.runId ?? randomUUID();
  const startedAt = nowIso();
  const timestamp = startedAt;

  const rawDir = getKaomojiRawDir(rootDir);
  mkdirSync(rawDir, { recursive: true });

  const recordsPath = getKaomojiRawRecordsPath(rootDir);
  let existingRecords: RawKaomojiRecord[] = [];
  if (existsSync(recordsPath)) {
    existingRecords = JSON.parse(readFileSync(recordsPath, "utf8")) as RawKaomojiRecord[];
  }

  const existingMap = new Map(existingRecords.map((r) => [r.raw_id, r]));
  const sourceResults: Record<
    string,
    {
      collected: number;
      skipped: number;
      errors: string[];
      method: CollectionMethod;
    }
  > = {};
  let totalAdded = 0;

  const enabledSources = listCollectionEnabledSources();

  for (const source of enabledSources) {
    const result = await collectFromSource(source, rootDir, fetchFn);
    const rawRecords = result.entries.map((entry) =>
      importEntryToRaw(entry, source, runId, timestamp),
    );
    const { merged, added } = mergeRecords(existingMap, rawRecords);
    for (const [id, record] of merged) existingMap.set(id, record);
    totalAdded += added;

    sourceResults[source.source_id] = {
      collected: result.collected,
      skipped: result.skipped,
      errors: [...result.errors],
      method: source.collection_method as CollectionMethod,
    };
  }

  const records = [...existingMap.values()].sort((a, b) => a.raw_id.localeCompare(b.raw_id));
  const sourceCounts: Record<string, number> = {};
  for (const record of records) {
    sourceCounts[record.source_id] = (sourceCounts[record.source_id] ?? 0) + 1;
  }

  const uniqueOriginal = new Set(records.map((r) => r.original_kaomoji)).size;
  const manifest: RawDatasetManifest = {
    generated_at: nowIso(),
    collector_version: COLLECTOR_VERSION,
    run_id: runId,
    record_count: records.length,
    unique_original_count: uniqueOriginal,
    source_counts: sourceCounts,
  };

  const completedAt = nowIso();
  const runManifest: CollectionRunManifest = {
    run_id: runId,
    started_at: startedAt,
    completed_at: completedAt,
    collector_version: COLLECTOR_VERSION,
    source_results: sourceResults,
  };

  writeFileSync(recordsPath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  writeFileSync(getKaomojiRawManifestPath(rootDir), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  writeFileSync(getKaomojiCollectionRunPath(rootDir), `${JSON.stringify(runManifest, null, 2)}\n`, "utf8");

  return { records, manifest, runManifest };
}

/** Resolve a source record by id (re-export for pipeline use). */
export function resolveSource(sourceId: string): SourceRecord | undefined {
  return getSourceById(sourceId);
}
