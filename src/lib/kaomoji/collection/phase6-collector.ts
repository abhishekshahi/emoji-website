import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { buildOccurrenceRawId } from "./ids";
import { fetchFastEmojiPhase4Entries, loadFastEmojiStats } from "./importers/fastemoji";
import { fetchPage } from "./importers/fetch-utils";
import type { ImportEntry } from "./importers/types";
import {
  fetchGenerateKaomojiPhase6,
  fetchJapaneseEmoticonsOrgPhase6,
  fetchKaomojiCaptionPhase6,
  fetchKaomojiJsonPhase6,
  fetchKawaiiFacesPhase6,
  fetchNpmKaomojiPhase6,
  probeSlangIt,
  probeTextEmoticons,
  searchJapaneseEmoticonsRecovery,
} from "./importers/phase6-gaps";
import { reauditEmoticonData, reauditKaomojiCollection, reauditKaomojiTagged } from "./importers/source-reaudit-phase6";
import { fetchWikipediaPhase6Retry } from "./importers/wikipedia-phase6";
import { expandEmoticonDataOccurrences } from "./importers/phase5-sources";
import {
  getFastEmojiCheckpointPath,
  getKaomojiRawDir,
  getKaomojiRawManifestPath,
  getKaomojiRawRecordsPath,
  getPhase6ManifestPath,
} from "../storage/paths";
import type { Phase6CollectionManifest, Phase6SourceInventoryRow } from "../discovery/phase6/types";
import {
  PHASE5_SOURCE_REGISTRY,
  getPhase5SourceById,
  getPhase5UniqueSourceCount,
  type Phase5SourceDefinition,
} from "../sources/registry-phase5";
import type { RawKaomojiRecord } from "../types";

export const PHASE6_COLLECTOR_VERSION = "6.0.0-gap-closure-no-dedup";

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
    collector_version: PHASE6_COLLECTOR_VERSION,
    license_status: entry.license_status ?? source.license_status,
    provenance: [
      source.source_id,
      source.source_url,
      entry.source_page ?? entry.source_file ?? "direct",
      entry.source_record_id ?? "content",
      runId,
    ],
    first_seen: timestamp,
    last_seen: timestamp,
    collection_run_id: runId,
  };
}

function appendRecords(existing: Map<string, RawKaomojiRecord>, incoming: RawKaomojiRecord[]): { added: number; skipped: number } {
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
): Phase6SourceInventoryRow {
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

async function auditToolCalculator(fetchFn: typeof fetch): Promise<string[]> {
  const home = await fetchPage("https://www.toolcalculator.com/", fetchFn);
  const emoticons = await fetchPage("https://www.toolcalculator.com/emoticons", fetchFn);
  return [`homepage ${home.status}`, `/emoticons ${emoticons.status}`, "General tools site — SOURCE_MISMATCH"];
}

async function auditKaomojisOrg(fetchFn: typeof fetch): Promise<string[]> {
  const home = await fetchPage("https://kaomojis.org/", fetchFn);
  const title = home.html.match(/<title>([^<]+)/i)?.[1] ?? "";
  return [`title: ${title}`, "Blog/SEO content — SOURCE_MISMATCH"];
}

export interface Phase6PipelineOptions {
  readonly fetchFn?: typeof fetch;
  readonly skipFastEmoji?: boolean;
  readonly fastEmojiMaxFetch?: number;
  readonly fastEmojiMaxCollect?: number;
}

export interface Phase6PipelineResult {
  readonly manifest: Phase6CollectionManifest;
}

export async function runPhase6Collection(rootDir: string, options: Phase6PipelineOptions = {}): Promise<Phase6PipelineResult> {
  const fetchFn = options.fetchFn ?? fetch;
  const runId = randomUUID();
  const timestamp = nowIso();
  const recordsPath = getKaomojiRawRecordsPath(rootDir);
  const existingMap = new Map<string, RawKaomojiRecord>();
  if (existsSync(recordsPath)) {
    const existing = JSON.parse(readFileSync(recordsPath, "utf8")) as RawKaomojiRecord[];
    for (const r of existing) existingMap.set(r.raw_id, r);
  }
  const rawBefore = existingMap.size;
  let totalNew = 0;
  const inventory: Phase6SourceInventoryRow[] = [];
  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  const gapsClosed: string[] = [];
  let feDiscovered: number | null = null;
  let feCollected: number | null = null;
  let feRemaining: number | null = null;

  async function collectSource(
    sourceId: string,
    fn: () => Promise<{ entries: ImportEntry[]; result?: { pages_discovered?: number; pages_processed?: number; files_processed?: number; errors?: string[] }; content_types?: string[]; skip?: boolean }>,
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
          problems: [`Status: ${source.phase5_status}`],
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
      if (added > 0) gapsClosed.push(sourceId);
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

  // Gap closure parsers
  await collectSource("generate-kaomoji", async () => {
    const r = await fetchGenerateKaomojiPhase6(fetchFn);
    return { entries: r.entries, result: r, content_types: ["KAOMOJI"] };
  });

  await collectSource("kawaii-faces", async () => {
    const r = await fetchKawaiiFacesPhase6(fetchFn);
    return { entries: r.entries, result: r, content_types: ["KAOMOJI", "TEXT_FACE"] };
  });

  await collectSource("kaomoji-caption", async () => {
    const r = await fetchKaomojiCaptionPhase6(fetchFn);
    return { entries: r.entries, result: r, content_types: ["KAOMOJI", "DESCRIPTION"] };
  });

  await collectSource("japaneseemoticons-org", async () => {
    const r = await fetchJapaneseEmoticonsOrgPhase6(fetchFn);
    return { entries: r.entries, result: r, content_types: ["KAOMOJI", "EMOTICON"] };
  });

  await collectSource("kaomoji-json", async () => {
    const r = await fetchKaomojiJsonPhase6(fetchFn);
    return { entries: r.entries, result: r, content_types: ["KAOMOJI"] };
  });

  await collectSource("kaomoji-vaneenige", async () => {
    const r = await fetchNpmKaomojiPhase6(fetchFn);
    return { entries: r.entries, result: r, content_types: ["KAOMOJI"] };
  });

  await collectSource("japanese-emoticons", async () => {
    const recovery = await searchJapaneseEmoticonsRecovery(fetchFn);
    return {
      entries: recovery.entries,
      result: { entries: recovery.entries, pages_discovered: 1, pages_processed: recovery.status === "RECOVERED" ? 1 : 0, files_processed: 0, errors: recovery.errors },
      content_types: ["KAOMOJI"],
    };
  });

  // FastEmoji resume from checkpoint
  if (!options.skipFastEmoji) {
    await collectSource("fastemoji", async () => {
      const checkpoint = getFastEmojiCheckpointPath(rootDir);
      const r = await fetchFastEmojiPhase4Entries(fetchFn, checkpoint, {
        maxFetch: options.fastEmojiMaxFetch ?? 3000,
        maxCollect: options.fastEmojiMaxCollect ?? 12000,
      });
      const stats = loadFastEmojiStats(checkpoint);
      feDiscovered = (stats?.emoji ?? 0) + (stats?.sequence ?? 0) + (stats?.combination ?? 0);
      feCollected = r.collected;
      feRemaining = r.remaining;
      return {
        entries: r.entries,
        result: { entries: r.entries, pages_discovered: r.pages_discovered, pages_processed: r.pages_processed, files_processed: 0, errors: r.errors },
        content_types: ["EMOJI", "EMOJI_SEQUENCE", "EMOJI_COMBINATION"],
      };
    });
  }

  // Wikipedia retry with backoff
  await collectSource("wikipedia", async () => {
    const r = await fetchWikipediaPhase6Retry(fetchFn);
    if (r.rate_limited_remaining.length) allWarnings.push(`Wikipedia rate-limited: ${r.rate_limited_remaining.join(", ")}`);
    return {
      entries: r.entries,
      result: { entries: r.entries, pages_discovered: r.pages_discovered, pages_processed: r.pages_processed, files_processed: 0, errors: r.errors },
      content_types: ["EMOTICON", "KAOMOJI", "DESCRIPTION"],
    };
  });

  // TextEmoticons / SlangIt recovery probes
  {
    const source = getPhase5SourceById("textemoticons")!;
    const before = [...existingMap.values()].filter((r) => r.source_id === "textemoticons").length;
    const probe = await probeTextEmoticons(fetchFn);
    inventory.push(
      inventoryRow(source, {
        discovered: 0,
        collected: before,
        raw_occurrences: before,
        pages: 3,
        files: 0,
        categories: 0,
        remaining: null,
        content_types: [],
        errors: probe.errors,
        problems: probe.accessible ? ["Accessible — collection not yet implemented"] : ["INACCESSIBLE"],
      }),
    );
  }
  {
    const source = getPhase5SourceById("slangit")!;
    const before = [...existingMap.values()].filter((r) => r.source_id === "slangit").length;
    const probe = await probeSlangIt(fetchFn);
    inventory.push(
      inventoryRow(source, {
        discovered: 0,
        collected: before,
        raw_occurrences: before,
        pages: 3,
        files: 0,
        categories: 0,
        remaining: null,
        content_types: [],
        errors: probe.errors,
        problems: probe.accessible ? ["Accessible — collection not yet implemented"] : ["INACCESSIBLE"],
      }),
    );
  }

  // SOURCE_MISMATCH audits
  {
    const tc = getPhase5SourceById("toolcalculator")!;
    const before = [...existingMap.values()].filter((r) => r.source_id === "toolcalculator").length;
    inventory.push(inventoryRow(tc, { discovered: 0, collected: before, raw_occurrences: before, pages: 2, files: 0, categories: 0, remaining: null, content_types: [], errors: [], problems: await auditToolCalculator(fetchFn) }));
  }
  {
    const ko = getPhase5SourceById("kaomojis-org")!;
    const before = [...existingMap.values()].filter((r) => r.source_id === "kaomojis-org").length;
    inventory.push(inventoryRow(ko, { discovered: 0, collected: before, raw_occurrences: before, pages: 1, files: 0, categories: 0, remaining: null, content_types: [], errors: [], problems: await auditKaomojisOrg(fetchFn) }));
  }

  // Re-audit active sources for missed files (append-only)
  for (const reaudit of [reauditEmoticonData, reauditKaomojiTagged, reauditKaomojiCollection]) {
    const result = await reaudit(fetchFn);
    const source = getPhase5SourceById(result.source_id);
    if (!source) continue;
    const before = [...existingMap.values()].filter((r) => r.source_id === result.source_id).length;
    const expanded = result.source_id === "emoticon-data" ? expandEmoticonDataOccurrences(result.entries) : result.entries;
    const rawRecords = expanded.map((e) => entryToRaw(e, source, runId, timestamp));
    const { added } = appendRecords(existingMap, rawRecords);
    totalNew += added;
    if (added > 0) gapsClosed.push(`${result.source_id}:reaudit`);
    const after = [...existingMap.values()].filter((r) => r.source_id === result.source_id).length;
    inventory.push(
      inventoryRow(source, {
        discovered: expanded.length,
        collected: after,
        raw_occurrences: after,
        pages: 1,
        files: expanded.length > 0 ? 1 : 0,
        categories: new Set(expanded.map((e) => e.source_category).filter(Boolean)).size,
        remaining: null,
        content_types: ["KAOMOJI", "EMOTICON"],
        errors: [...result.errors],
        problems: added > 0 ? [`Re-audit added ${added} new occurrences`] : ["Re-audit complete — no new occurrences"],
      }),
    );
  }

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
      collector_version: PHASE6_COLLECTOR_VERSION,
      run_id: runId,
      record_count: records.length,
      deduplication_performed: false,
      source_counts: sourceCounts,
    }, null, 2)}\n`,
    "utf8",
  );

  const manifest: Phase6CollectionManifest = {
    phase: 6,
    timestamp: nowIso(),
    pipeline_version: "6.0.0-gap-closure",
    collector_version: PHASE6_COLLECTOR_VERSION,
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
    sources_active: PHASE5_SOURCE_REGISTRY.filter((s) => s.phase5_status === "ACTIVE_RELEVANT").length,
    sources_partially_relevant: PHASE5_SOURCE_REGISTRY.filter((s) => s.phase5_status === "ACTIVE_PARTIALLY_RELEVANT").length,
    sources_mismatch: PHASE5_SOURCE_REGISTRY.filter((s) => s.phase5_status === "SOURCE_MISMATCH").length,
    sources_inaccessible: PHASE5_SOURCE_REGISTRY.filter((s) => s.phase5_status === "INACCESSIBLE").length,
    sources_review_required: PHASE5_SOURCE_REGISTRY.filter((s) => s.phase5_status === "REVIEW_REQUIRED").length,
    source_inventory: inventory,
    deduplication_performed: false,
    provenance_coverage: records.every((r) => r.provenance.length >= 2) ? 1 : records.filter((r) => r.provenance.length >= 2).length / records.length,
    warnings: allWarnings,
    errors: allErrors,
    phase6_gaps_closed: gapsClosed,
    fastemoji_canonical_discovered: feDiscovered,
    fastemoji_canonical_collected: feCollected,
    fastemoji_canonical_remaining: feRemaining,
  };

  writeFileSync(getPhase6ManifestPath(rootDir), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { manifest };
}
