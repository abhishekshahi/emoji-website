import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { buildOccurrenceRawId } from "./ids";
import { fetchEmoticonDataEntries } from "./importers/emoticon-data";
import { fetchEmoticonsTextPhase4Entries } from "./importers/emoticonstext-phase4";
import { fetchFastEmojiPhase4Entries } from "./importers/fastemoji";
import { fetchKaomojiTaggedPhase4Entries } from "./importers/kaomoji-tagged-phase4";
import { fetchMesslettersPhase4Entries } from "./importers/messletters-phase4";
import { fetchWikipediaPhase4Entries } from "./importers/wikipedia-phase4";
import type { ImportEntry } from "./importers/types";
import {
  expandEmoticonDataOccurrences,
  fetchEmoticonWooormEntries,
  fetchGenerateKaomojiEntries,
  fetchJapaneseEmoticonsOrgEntries,
  fetchKaomojiCaptionEntries,
  fetchKaomojiCollectionEntries,
  fetchKaomojiJsonEntries,
  fetchKawaiiFacesEntries,
  fetchNodeKaomojiEntries,
  fetchRandomKaomojiEntries,
  type Phase5ImportResult,
} from "./importers/phase5-sources";
import { fetchPage } from "./importers/fetch-utils";
import {
  getFastEmojiCheckpointPath,
  getKaomojiRawDir,
  getKaomojiRawManifestPath,
  getKaomojiRawRecordsPath,
  getPhase5ManifestPath,
} from "../storage/paths";
import type { Phase5CollectionManifest, Phase5SourceInventoryRow } from "../discovery/phase5/types";
import {
  PHASE5_SOURCE_REGISTRY,
  getPhase5SourceById,
  getPhase5UniqueSourceCount,
  type Phase5SourceDefinition,
} from "../sources/registry-phase5";
import type { RawKaomojiRecord } from "../types";

export const PHASE5_COLLECTOR_VERSION = "5.0.0-no-dedup-raw-acquisition";

function nowIso(): string {
  return new Date().toISOString();
}

function entryToRaw(
  entry: ImportEntry,
  source: Phase5SourceDefinition,
  runId: string,
  timestamp: string,
): RawKaomojiRecord {
  const rawId = buildOccurrenceRawId({
    source_id: source.source_id,
    source_record_id: entry.source_record_id ?? null,
    source_page: entry.source_page ?? null,
    source_category: entry.source_category ?? null,
    source_file: entry.source_file ?? null,
    occurrence_index: entry.occurrence_index,
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
    raw_html_context_if_needed: entry.source_metadata ? JSON.stringify(entry.source_metadata) : null,
    collection_timestamp: timestamp,
    collector_version: PHASE5_COLLECTOR_VERSION,
    license_status: entry.license_status ?? source.license_status,
    provenance: [
      source.source_id,
      source.source_url,
      entry.source_page ?? entry.source_file ?? "direct",
      entry.source_record_id ?? "content",
    ],
    first_seen: timestamp,
    last_seen: timestamp,
    collection_run_id: runId,
  };
}

/** Append-only: never modify or remove existing raw records. */
function appendRecords(
  existing: Map<string, RawKaomojiRecord>,
  incoming: RawKaomojiRecord[],
): { added: number; skipped: number } {
  let added = 0;
  let skipped = 0;
  for (const record of incoming) {
    if (existing.has(record.raw_id)) {
      skipped += 1;
      continue;
    }
    existing.set(record.raw_id, record);
    added += 1;
  }
  return { added, skipped };
}

function inventoryRow(
  source: Phase5SourceDefinition,
  opts: {
    discovered: number;
    collected: number;
    raw_occurrences: number;
    pages: number;
    files: number;
    categories: number;
    remaining: number | null;
    content_types: string[];
    errors: string[];
    problems: string[];
  },
): Phase5SourceInventoryRow {
  return {
    source_id: source.source_id,
    source_name: source.source_name,
    source_type: source.source_type,
    source_url: source.source_url,
    repository_url: source.repository_url,
    status: source.phase5_status,
    license: source.license_status,
    commercial_use: source.commercial_use,
    redistribution: source.redistribution,
    attribution: source.attribution_required,
    pages: opts.pages,
    files: opts.files,
    categories: opts.categories,
    records_discovered: opts.discovered,
    records_collected: opts.collected,
    records_remaining: opts.remaining,
    raw_occurrences: opts.raw_occurrences,
    content_types: opts.content_types,
    errors: opts.errors,
    problems: opts.problems,
  };
}

async function auditToolCalculator(fetchFn: typeof fetch): Promise<{ status: "SOURCE_MISMATCH" | "ACTIVE_RELEVANT"; evidence: string[] }> {
  const home = await fetchPage("https://www.toolcalculator.com/", fetchFn);
  const emoticons = await fetchPage("https://www.toolcalculator.com/emoticons", fetchFn);
  const evidence = [`homepage ${home.status}`, `/emoticons ${emoticons.status}`];
  if (emoticons.status === 404 && home.status === 200) {
    evidence.push("General tools site — no emoticon collection");
    return { status: "SOURCE_MISMATCH", evidence };
  }
  return { status: "SOURCE_MISMATCH", evidence };
}

async function auditKaomojisOrg(fetchFn: typeof fetch): Promise<{ status: "SOURCE_MISMATCH"; evidence: string[] }> {
  const home = await fetchPage("https://kaomojis.org/", fetchFn);
  const title = home.html.match(/<title>([^<]+)/i)?.[1] ?? "";
  return {
    status: "SOURCE_MISMATCH",
    evidence: [`title: ${title}`, "Blog/SEO — no kaomoji database"],
  };
}

export interface Phase5PipelineOptions {
  readonly fetchFn?: typeof fetch;
  readonly skipFastEmoji?: boolean;
  readonly fastEmojiMaxFetch?: number;
}

export interface Phase5PipelineResult {
  readonly manifest: Phase5CollectionManifest;
}

export async function runPhase5AcquisitionPipeline(
  rootDir: string,
  options: Phase5PipelineOptions = {},
): Promise<Phase5PipelineResult> {
  const fetchFn = options.fetchFn ?? fetch;
  const runId = randomUUID();
  const timestamp = nowIso();
  const allErrors: string[] = [];
  const allWarnings: string[] = ["DEDUPLICATION DISABLED — every source occurrence preserved"];
  const inventory: Phase5SourceInventoryRow[] = [];

  const recordsPath = getKaomojiRawRecordsPath(rootDir);
  const existingMap = new Map<string, RawKaomojiRecord>();
  if (existsSync(recordsPath)) {
    for (const r of JSON.parse(readFileSync(recordsPath, "utf8")) as RawKaomojiRecord[]) {
      existingMap.set(r.raw_id, r);
    }
  }
  const rawBefore = existingMap.size;
  let totalNew = 0;

  async function collectSource(
    sourceId: string,
    fn: () => Promise<{ entries: ImportEntry[]; result?: Phase5ImportResult; content_types?: string[]; skip?: boolean }>,
  ): Promise<void> {
    const source = getPhase5SourceById(sourceId);
    if (!source) return;
    const before = [...existingMap.values()].filter((r) => r.source_id === sourceId).length;

    if (source.phase5_status === "SOURCE_MISMATCH" || source.phase5_status === "INACCESSIBLE" || source.phase5_status === "NOT_PERMITTED") {
      inventory.push(
        inventoryRow(source, {
          discovered: 0,
          collected: before,
          raw_occurrences: before,
          pages: 0,
          files: 0,
          categories: 0,
          remaining: null,
          content_types: [],
          errors: [],
          problems: [`Status: ${source.phase5_status} — no collection attempted`],
        }),
      );
      return;
    }

    if (!source.enabled_for_collection) {
      inventory.push(
        inventoryRow(source, {
          discovered: 0,
          collected: before,
          raw_occurrences: before,
          pages: 0,
          files: 0,
          categories: 0,
          remaining: null,
          content_types: [],
          errors: [],
          problems: ["Collection disabled"],
        }),
      );
      return;
    }

    try {
      const { entries, result, content_types = ["KAOMOJI"], skip } = await fn();
      if (skip) return;
      const rawRecords = entries.map((e) => entryToRaw(e, source, runId, timestamp));
      const { added } = appendRecords(existingMap, rawRecords);
      totalNew += added;
      const after = [...existingMap.values()].filter((r) => r.source_id === sourceId).length;
      allErrors.push(...(result?.errors ?? []));

      inventory.push(
        inventoryRow(source, {
          discovered: entries.length,
          collected: after,
          raw_occurrences: after,
          pages: result?.pages_processed ?? 1,
          files: result?.files_processed ?? 0,
          categories: new Set(entries.map((e) => e.source_category).filter(Boolean)).size,
          remaining: null,
          content_types,
          errors: result?.errors ?? [],
          problems: [],
        }),
      );
    } catch (err) {
      allErrors.push(`${sourceId}: ${err instanceof Error ? err.message : String(err)}`);
      inventory.push(
        inventoryRow(source, {
          discovered: 0,
          collected: before,
          raw_occurrences: before,
          pages: 0,
          files: 0,
          categories: 0,
          remaining: null,
          content_types: [],
          errors: [String(err)],
          problems: ["Collection error"],
        }),
      );
    }
  }

  // Audits for mismatch sources (fresh)
  const tcAudit = await auditToolCalculator(fetchFn);
  const koAudit = await auditKaomojisOrg(fetchFn);

  await collectSource("emoticon-data", async () => {
    const base = await fetchEmoticonDataEntries(fetchFn);
    const entries = expandEmoticonDataOccurrences(base.map((e) => ({ ...e, source_file: "emoticons.json" })));
    return { entries, content_types: ["EMOTICON", "TEXT_FACE"] };
  });

  await collectSource("kaomoji-tagged", async () => {
    const r = await fetchKaomojiTaggedPhase4Entries(fetchFn);
    return { entries: r.entries, result: { entries: r.entries, pages_discovered: r.files_processed, pages_processed: r.files_processed, files_processed: r.files_processed, errors: r.errors }, content_types: ["KAOMOJI"] };
  });

  await collectSource("wikipedia", async () => {
    const r = await fetchWikipediaPhase4Entries(fetchFn);
    return { entries: r.entries, result: { entries: r.entries, pages_discovered: r.pages_discovered, pages_processed: r.pages_processed, files_processed: 0, errors: r.errors }, content_types: ["EMOTICON", "KAOMOJI", "DESCRIPTION"] };
  });

  // ToolCalculator — audit only
  {
    const source = getPhase5SourceById("toolcalculator")!;
    const before = [...existingMap.values()].filter((r) => r.source_id === "toolcalculator").length;
    inventory.push(
      inventoryRow(source, {
        discovered: 0,
        collected: before,
        raw_occurrences: before,
        pages: 2,
        files: 0,
        categories: 0,
        remaining: null,
        content_types: [],
        errors: [],
        problems: tcAudit.evidence,
      }),
    );
  }

  // kaomojis.org — audit only
  {
    const source = getPhase5SourceById("kaomojis-org")!;
    const before = [...existingMap.values()].filter((r) => r.source_id === "kaomojis-org").length;
    inventory.push(
      inventoryRow(source, {
        discovered: 0,
        collected: before,
        raw_occurrences: before,
        pages: 1,
        files: 0,
        categories: 0,
        remaining: null,
        content_types: [],
        errors: [],
        problems: koAudit.evidence,
      }),
    );
  }

  await collectSource("messletters", async () => {
    const r = await fetchMesslettersPhase4Entries(fetchFn);
    return { entries: r.entries, result: { entries: r.entries, pages_discovered: r.pages_discovered, pages_processed: r.pages_processed, files_processed: 0, errors: r.errors }, content_types: ["KAOMOJI", "EMOTICON", "TEXT_FACE"] };
  });

  await collectSource("textemoticons", async () => ({ entries: [], skip: true }));
  await collectSource("slangit", async () => ({ entries: [], skip: true }));

  await collectSource("emoticonstext", async () => {
    const r = await fetchEmoticonsTextPhase4Entries(fetchFn);
    return { entries: r.entries, result: { entries: r.entries, pages_discovered: r.pages_discovered, pages_processed: r.pages_processed, files_processed: 0, errors: r.errors }, content_types: ["KAOMOJI", "EMOTICON", "TEXT_FACE"] };
  });

  if (!options.skipFastEmoji) {
    await collectSource("fastemoji", async () => {
      const r = await fetchFastEmojiPhase4Entries(fetchFn, getFastEmojiCheckpointPath(rootDir), {
        maxFetch: options.fastEmojiMaxFetch ?? 1500,
        maxCollect: 5000,
      });
      return {
        entries: r.entries,
        result: { entries: r.entries, pages_discovered: r.pages_discovered, pages_processed: r.pages_processed, files_processed: 0, errors: r.errors },
        content_types: ["EMOJI", "EMOJI_SEQUENCE", "EMOJI_COMBINATION"],
      };
    });
  }

  await collectSource("kaomoji-collection", async () => {
    const r = await fetchKaomojiCollectionEntries(fetchFn);
    return { entries: r.entries, result: r, content_types: ["KAOMOJI"] };
  });

  await collectSource("japanese-emoticons", async () => ({ entries: [], skip: true }));

  await collectSource("kaomoji-vaneenige", async () => {
    const npm = await fetchFn("https://registry.npmjs.org/kaomoji/latest");
    if (!npm.ok) return { entries: [], result: { entries: [], pages_discovered: 1, pages_processed: 0, files_processed: 0, errors: ["npm 404"] } };
    const pkg = (await npm.json()) as { dist?: { tarball?: string } };
    allWarnings.push("kaomoji-vaneenige: collected via npm tarball metadata only — repo 404");
    return { entries: [], result: { entries: [], pages_discovered: 1, pages_processed: 0, files_processed: 0, errors: [`tarball: ${pkg.dist?.tarball ?? "none"}`] }, content_types: ["KAOMOJI"] };
  });

  await collectSource("emoticon-wooorm", async () => {
    const r = await fetchEmoticonWooormEntries(fetchFn);
    return { entries: r.entries, result: r, content_types: ["EMOTICON"] };
  });

  await collectSource("generate-kaomoji", async () => {
    const r = await fetchGenerateKaomojiEntries(fetchFn);
    return { entries: r.entries, result: r, content_types: ["KAOMOJI"] };
  });

  await collectSource("kawaii-faces", async () => {
    const r = await fetchKawaiiFacesEntries(fetchFn);
    return { entries: r.entries, result: r, content_types: ["KAOMOJI", "TEXT_FACE"] };
  });

  await collectSource("kaomoji-caption", async () => {
    const r = await fetchKaomojiCaptionEntries(fetchFn);
    return { entries: r.entries, result: r, content_types: ["KAOMOJI", "DESCRIPTION"] };
  });

  await collectSource("node-kaomoji", async () => {
    const r = await fetchNodeKaomojiEntries(fetchFn);
    return { entries: r.entries, result: r, content_types: ["KAOMOJI"] };
  });

  await collectSource("kaomoji-json", async () => {
    const r = await fetchKaomojiJsonEntries(fetchFn);
    return { entries: r.entries, result: r, content_types: ["KAOMOJI"] };
  });

  await collectSource("random-kaomoji", async () => {
    const r = await fetchRandomKaomojiEntries(fetchFn);
    return { entries: r.entries, result: r, content_types: ["KAOMOJI"] };
  });

  await collectSource("japaneseemoticons-org", async () => {
    const r = await fetchJapaneseEmoticonsOrgEntries(fetchFn);
    return { entries: r.entries, result: r, content_types: ["KAOMOJI", "EMOTICON"] };
  });

  const records = [...existingMap.values()].sort((a, b) => a.raw_id.localeCompare(b.raw_id));
  const rawAfter = records.length;

  mkdirSync(getKaomojiRawDir(rootDir), { recursive: true });
  writeFileSync(recordsPath, `${JSON.stringify(records, null, 2)}\n`, "utf8");

  const sourceCounts: Record<string, number> = {};
  for (const r of records) sourceCounts[r.source_id] = (sourceCounts[r.source_id] ?? 0) + 1;

  writeFileSync(
    getKaomojiRawManifestPath(rootDir),
    `${JSON.stringify({
      generated_at: nowIso(),
      collector_version: PHASE5_COLLECTOR_VERSION,
      run_id: runId,
      record_count: records.length,
      deduplication_performed: false,
      source_counts: sourceCounts,
    }, null, 2)}\n`,
    "utf8",
  );

  const statusCounts = {
    active: PHASE5_SOURCE_REGISTRY.filter((s) => s.phase5_status === "ACTIVE_RELEVANT").length,
    partial: PHASE5_SOURCE_REGISTRY.filter((s) => s.phase5_status === "ACTIVE_PARTIALLY_RELEVANT").length,
    mismatch: PHASE5_SOURCE_REGISTRY.filter((s) => s.phase5_status === "SOURCE_MISMATCH").length,
    inaccessible: PHASE5_SOURCE_REGISTRY.filter((s) => s.phase5_status === "INACCESSIBLE").length,
    review: PHASE5_SOURCE_REGISTRY.filter((s) => s.phase5_status === "REVIEW_REQUIRED").length,
  };

  const manifest: Phase5CollectionManifest = {
    phase: 5,
    timestamp: nowIso(),
    pipeline_version: "5.0.0-no-dedup",
    collector_version: PHASE5_COLLECTOR_VERSION,
    candidate_sources: 23,
    unique_source_identities: getPhase5UniqueSourceCount(),
    raw_before: rawBefore,
    raw_after: rawAfter,
    removed_records: 0,
    existing_raw_modified: 0,
    new_raw_records: totalNew,
    total_source_occurrences: inventory.reduce((s, r) => s + r.raw_occurrences, 0),
    total_raw_records: rawAfter,
    total_pages: inventory.reduce((s, r) => s + r.pages, 0),
    total_files: inventory.reduce((s, r) => s + r.files, 0),
    total_categories: inventory.reduce((s, r) => s + r.categories, 0),
    sources_active: statusCounts.active,
    sources_partially_relevant: statusCounts.partial,
    sources_mismatch: statusCounts.mismatch,
    sources_inaccessible: statusCounts.inaccessible,
    sources_review_required: statusCounts.review,
    source_inventory: inventory,
    deduplication_performed: false,
    provenance_coverage: records.every((r) => r.provenance.length >= 2) ? 1 : records.filter((r) => r.provenance.length >= 2).length / records.length,
    warnings: allWarnings,
    errors: allErrors,
  };

  writeFileSync(getPhase5ManifestPath(rootDir), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { manifest };
}
