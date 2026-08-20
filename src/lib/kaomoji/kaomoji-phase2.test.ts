import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAllSourceReports } from "@/lib/kaomoji/collection/all-sources";
import { buildRawId } from "@/lib/kaomoji/collection/ids";
import { analyzeDeduplication } from "@/lib/kaomoji/dedup/analyze";
import { buildSourceCoverageMatrix } from "@/lib/kaomoji/coverage/matrix";
import { KAOMOJI_SOURCE_REGISTRY } from "@/lib/kaomoji/sources/registry";
import { kaomojiRecordToSourceItem } from "@/lib/kaomoji/universal/adapter";
import { aggregateSourceItems } from "@/lib/kaomoji/universal/aggregate";
import { classifyContentType } from "@/lib/kaomoji/universal/content-type";
import { runNoLossAudit } from "@/lib/kaomoji/universal/loss-audit";
import { normalizeSourceItems } from "@/lib/kaomoji/universal/normalize";
import { buildUniversalProvenanceGraph } from "@/lib/kaomoji/universal/provenance";
import { validateAggregatedItems } from "@/lib/kaomoji/universal/validate";
import type { RawKaomojiRecord } from "@/lib/kaomoji/types";

function makeRaw(
  overrides: Partial<RawKaomojiRecord> & Pick<RawKaomojiRecord, "source_id" | "original_kaomoji">,
): RawKaomojiRecord {
  const ts = "2026-03-20T00:00:00.000Z";
  const raw_id =
    overrides.raw_id ??
    buildRawId({
      source_id: overrides.source_id,
      source_record_id: overrides.source_record_id ?? null,
      original_kaomoji: overrides.original_kaomoji,
    });
  return {
    raw_id,
    source_url: "https://example.com",
    source_record_id: null,
    source_page: null,
    source_category: null,
    source_title: null,
    raw_text: overrides.original_kaomoji,
    raw_html_context_if_needed: null,
    collection_timestamp: ts,
    collector_version: "2.0.0-test",
    license_status: "APPROVED",
    provenance: [],
    first_seen: ts,
    last_seen: ts,
    collection_run_id: "test",
    ...overrides,
  };
}

describe("phase 2 universal registry", () => {
  it("registers all 10 sources", () => {
    assert.equal(KAOMOJI_SOURCE_REGISTRY.length, 10);
    const ids = KAOMOJI_SOURCE_REGISTRY.map((s) => s.source_id).sort();
    assert.deepEqual(ids, [
      "emoticon-data",
      "emoticonstext",
      "fastemoji",
      "kaomoji-tagged",
      "kaomojis-org",
      "messletters",
      "slangit",
      "textemoticons",
      "toolcalculator",
      "wikipedia",
    ]);
  });

  it("builds source reports for all 10 sources", () => {
    const reports = buildAllSourceReports(process.cwd(), [], []);
    assert.equal(reports.length, 10);
  });
});

describe("phase 2 universal adapter", () => {
  it("preserves original_content exactly", () => {
    const raw = makeRaw({ source_id: "kaomoji-tagged", original_kaomoji: "（；´Д｀）" });
    const item = kaomojiRecordToSourceItem(raw);
    assert.equal(item.original_content, "（；´Д｀）");
    assert.equal(item.raw_content, raw.raw_text);
  });

  it("classifies content types reversibly", () => {
    const kaomoji = classifyContentType({
      content: "(＾▽＾)",
      source_id: "kaomoji-tagged",
      source_category: "happy",
    });
    assert.equal(kaomoji.content_type, "KAOMOJI");
    assert.equal(kaomoji.source_content_type, "KAOMOJI");
  });
});

describe("phase 2 critical preservation tests", () => {
  it("CRITICAL: unique single-source item survives", () => {
    const raw = [makeRaw({ source_id: "emoticon-data", original_kaomoji: "(；´Д｀)", source_record_id: "unique-1" })];
    const items = raw.map(kaomojiRecordToSourceItem);
    const aggregated = aggregateSourceItems(items);
    assert.equal(aggregated.length, 1);
    assert.equal(aggregated[0]!.source_refs.length, 1);
    const noLoss = runNoLossAudit({
      rawItems: items,
      aggregated,
      normalized: normalizeSourceItems(aggregated),
      validation: validateAggregatedItems(aggregated),
      provenance: buildUniversalProvenanceGraph(aggregated),
      dedup: analyzeDeduplication(aggregated),
    });
    assert.equal(noLoss.silent_deletions, 0);
  });

  it("CRITICAL: five-source identical item keeps one canonical + five refs", () => {
    const sources = ["emoticon-data", "kaomoji-tagged", "wikipedia", "emoticon-data", "kaomoji-tagged"] as const;
    const raw = sources.map((source_id, i) =>
      makeRaw({ source_id, original_kaomoji: "(^_^)", source_record_id: `ref-${i}` }),
    );
    const items = raw.map(kaomojiRecordToSourceItem);
    const aggregated = aggregateSourceItems(items);
    assert.equal(aggregated.length, 1);
    assert.equal(aggregated[0]!.source_refs.length, 5);
    const uniqueSources = new Set(aggregated[0]!.source_refs.map((r) => r.source_id));
    assert.ok(uniqueSources.size >= 2);
  });

  it("CRITICAL: two meaningful variants both survive", () => {
    const raw = [
      makeRaw({ source_id: "emoticon-data", original_kaomoji: "(^_^)", source_record_id: "a" }),
      makeRaw({ source_id: "emoticon-data", original_kaomoji: "( ^_^ )", source_record_id: "b" }),
    ];
    const items = raw.map(kaomojiRecordToSourceItem);
    const aggregated = aggregateSourceItems(items);
    assert.equal(aggregated.length, 2);
    const dedup = analyzeDeduplication(aggregated);
    assert.ok(dedup.legitimate_variants >= 2 || dedup.unique_items >= 2);
  });
});

describe("phase 2 provenance and coverage", () => {
  it("achieves full provenance coverage", () => {
    const raw = [
      makeRaw({ source_id: "emoticon-data", original_kaomoji: "(^_^)", source_record_id: "1" }),
      makeRaw({ source_id: "kaomoji-tagged", original_kaomoji: "(-_-)", source_record_id: "2" }),
    ];
    const items = raw.map(kaomojiRecordToSourceItem);
    const aggregated = aggregateSourceItems(items);
    const provenance = buildUniversalProvenanceGraph(aggregated);
    const refs = provenance.reduce((sum, p) => sum + p.source_item_ids.length, 0);
    assert.equal(refs, 2);
  });

  it("builds source coverage matrix", () => {
    const raw = [
      makeRaw({ source_id: "emoticon-data", original_kaomoji: "(^_^)", source_record_id: "1" }),
      makeRaw({ source_id: "kaomoji-tagged", original_kaomoji: "(^_^)", source_record_id: "2" }),
    ];
    const items = raw.map(kaomojiRecordToSourceItem);
    const aggregated = aggregateSourceItems(items);
    const validation = validateAggregatedItems(aggregated);
    const matrix = buildSourceCoverageMatrix(items, aggregated, validation);
    assert.equal(matrix.rows.length, 10);
    assert.equal(matrix.shared_by_2, 1);
  });
});
