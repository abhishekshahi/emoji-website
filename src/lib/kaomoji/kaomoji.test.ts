import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import { aggregateRawRecords } from "@/lib/kaomoji/aggregate/aggregate";
import { runPreservationAudit } from "@/lib/kaomoji/audit/preservation";
import { buildRawId, buildAggregatedId, buildCandidateKey } from "@/lib/kaomoji/collection/ids";
import { runCollection, COLLECTOR_VERSION } from "@/lib/kaomoji/collection/collector";
import { parseEmoticonDataJson } from "@/lib/kaomoji/collection/importers/emoticon-data";
import { parseKaomojiTaggedJson } from "@/lib/kaomoji/collection/importers/kaomoji-tagged";
import { parseWikipediaWikitext } from "@/lib/kaomoji/collection/importers/wikipedia";
import { classifyCandidate } from "@/lib/kaomoji/classify/classify";
import { normalizeKaomoji, NORMALIZATION_VERSION } from "@/lib/kaomoji/normalize/normalize";
import { buildProvenanceGraph } from "@/lib/kaomoji/provenance/graph";
import {
  buildLicenseAuditRecords,
  mergeLicenseStatuses,
  summarizeLicenseStatuses,
} from "@/lib/kaomoji/sources/license-audit";
import {
  getSourceById,
  KAOMOJI_SOURCE_REGISTRY,
  listCollectionEnabledSources,
} from "@/lib/kaomoji/sources/registry";
import type { RawKaomojiRecord } from "@/lib/kaomoji/types";

function makeRaw(
  overrides: Partial<RawKaomojiRecord> & Pick<RawKaomojiRecord, "raw_id" | "original_kaomoji" | "source_id">,
): RawKaomojiRecord {
  const ts = "2026-03-20T00:00:00.000Z";
  return {
    source_url: "https://example.com",
    source_record_id: null,
    source_page: null,
    source_category: null,
    source_title: null,
    raw_text: overrides.original_kaomoji,
    raw_html_context_if_needed: null,
    collection_timestamp: ts,
    collector_version: COLLECTOR_VERSION,
    license_status: "APPROVED",
    provenance: [],
    first_seen: ts,
    last_seen: ts,
    collection_run_id: "test-run",
    ...overrides,
  };
}

const mockEmoticonPayload = {
  emoticons: [
    { id: "1", string: "(^_^)", tags: ["happy"] },
    { id: "2", string: "(-_-)", tags: ["bored"] },
  ],
};

const mockKaomojiPayload = [
  { text: "(^_^)", slug: "happy-1", categories: ["happy"], tags: ["smile"] },
  { text: "(＾▽＾)", slug: "happy-2", categories: ["happy"], tags: ["smile"] },
];

const mockWikiWikitext = `
* "(^_^)" — happy face
* "(-_-)" — bored face
* "(；´Д｀)" — crying
`;

function createMockFetch(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("emoticon-data")) {
      return new Response(JSON.stringify(mockEmoticonPayload), { status: 200 });
    }
    if (url.includes("kaomoji-data")) {
      return new Response(JSON.stringify(mockKaomojiPayload), { status: 200 });
    }
    if (url.includes("wikipedia.org")) {
      return new Response(
        JSON.stringify({ parse: { wikitext: { "*": mockWikiWikitext } } }),
        { status: 200 },
      );
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

describe("kaomoji registry", () => {
  it("lists all registered sources", () => {
    assert.ok(KAOMOJI_SOURCE_REGISTRY.length >= 10);
    assert.ok(getSourceById("emoticon-data"));
    assert.ok(getSourceById("kaomoji-tagged"));
    assert.ok(getSourceById("wikipedia"));
  });

  it("enables three collection sources in phase 1", () => {
    const enabled = listCollectionEnabledSources();
    assert.equal(enabled.length, 3);
    assert.deepEqual(
      enabled.map((s) => s.source_id).sort(),
      ["emoticon-data", "kaomoji-tagged", "wikipedia"],
    );
  });
});

describe("kaomoji license audit", () => {
  it("builds license audit records from registry", () => {
    const records = buildLicenseAuditRecords();
    assert.equal(records.length, KAOMOJI_SOURCE_REGISTRY.length);
    const emoticon = records.find((r) => r.source_id === "emoticon-data");
    assert.ok(emoticon);
    assert.equal(emoticon!.license_status, "APPROVED");
    assert.equal(emoticon!.license_name, "MIT");
  });

  it("summarizes license statuses", () => {
    const summary = summarizeLicenseStatuses();
    assert.equal(summary.total, KAOMOJI_SOURCE_REGISTRY.length);
    assert.equal(summary.collection_enabled, 3);
    assert.ok((summary.by_status.APPROVED ?? 0) >= 2);
    assert.ok((summary.by_status.ATTRIBUTION_REQUIRED ?? 0) >= 1);
  });

  it("merges license statuses by restrictiveness", () => {
    assert.equal(
      mergeLicenseStatuses(["APPROVED", "ATTRIBUTION_REQUIRED"]),
      "ATTRIBUTION_REQUIRED",
    );
    assert.equal(
      mergeLicenseStatuses(["APPROVED", "REVIEW_REQUIRED", "UNKNOWN"]),
      "REVIEW_REQUIRED",
    );
  });
});

describe("kaomoji ids", () => {
  it("builds deterministic raw_id from source_record_id", () => {
    const a = buildRawId({
      source_id: "emoticon-data",
      source_record_id: "42",
      original_kaomoji: "(^_^)",
    });
    const b = buildRawId({
      source_id: "emoticon-data",
      source_record_id: "42",
      original_kaomoji: "(^_^)",
    });
    assert.equal(a, b);
  });

  it("builds content-hash raw_id when source_record_id absent", () => {
    const id = buildRawId({
      source_id: "wikipedia",
      source_record_id: null,
      original_kaomoji: "(^_^)",
    });
    assert.match(id, /^[a-f0-9]{64}$/);
  });

  it("builds aggregated_id from candidate_key", () => {
    const key = buildCandidateKey("(^_^)");
    const id = buildAggregatedId(key);
    assert.match(id, /^[a-f0-9]{64}$/);
    assert.equal(buildAggregatedId(key), id);
  });
});

describe("kaomoji normalization", () => {
  it("exports normalization version", () => {
    assert.equal(NORMALIZATION_VERSION, "1.0.0");
  });

  it("applies NFC unicode normalization", () => {
    const decomposed = "e\u0301";
    const result = normalizeKaomoji(decomposed);
    assert.equal(result.normalized_kaomoji, "\u00E9");
    assert.ok(result.normalization_changes.some((c) => c.kind === "unicode"));
  });

  it("preserves intentional internal spaces", () => {
    const result = normalizeKaomoji("( ^_^ )");
    assert.equal(result.normalized_kaomoji, "( ^_^ )");
  });

  it("strips HTML entities", () => {
    const result = normalizeKaomoji("&lt;(^_^)&gt;");
    assert.equal(result.normalized_kaomoji, "<(^_^)>");
    assert.ok(result.normalization_changes.some((c) => c.kind === "html"));
  });

  it("normalizes line endings", () => {
    const result = normalizeKaomoji("(^_^)\r\n");
    assert.equal(result.normalized_kaomoji, "(^_^)");
    assert.ok(result.normalization_changes.some((c) => c.kind === "line_ending"));
  });
});

describe("kaomoji classification", () => {
  it("marks empty as INVALID_CANDIDATE", () => {
    const result = classifyCandidate({
      aggregated_id: "x",
      normalized_kaomoji: "   ",
      source_refs: [],
    });
    assert.equal(result.classification, "INVALID_CANDIDATE");
  });

  it("marks URLs as INVALID_CANDIDATE", () => {
    const result = classifyCandidate({
      aggregated_id: "x",
      normalized_kaomoji: "visit https://spam.example",
      source_refs: [],
    });
    assert.equal(result.classification, "INVALID_CANDIDATE");
  });

  it("keeps unusual kaomoji as VALID_CANDIDATE", () => {
    const result = classifyCandidate({
      aggregated_id: "x",
      normalized_kaomoji: "（；´Д｀）",
      source_refs: [],
    });
    assert.equal(result.classification, "VALID_CANDIDATE");
  });
});

describe("kaomoji aggregation and preservation", () => {
  it("groups by candidate_key but keeps all source_refs", () => {
    const raw = [
      makeRaw({
        raw_id: "a",
        source_id: "emoticon-data",
        original_kaomoji: "(^_^)",
        source_record_id: "1",
      }),
      makeRaw({
        raw_id: "b",
        source_id: "kaomoji-tagged",
        original_kaomoji: "(^_^)",
        source_record_id: "2",
      }),
    ];
    const aggregated = aggregateRawRecords(raw);
    assert.equal(aggregated.length, 1);
    assert.equal(aggregated[0]!.source_refs.length, 2);
    assert.equal(aggregated[0]!.source_count, 2);
  });

  it("preserves unique single-source records", () => {
    const raw = [
      makeRaw({ raw_id: "a", source_id: "emoticon-data", original_kaomoji: "(^_^)" }),
      makeRaw({ raw_id: "b", source_id: "emoticon-data", original_kaomoji: "(；´Д｀)" }),
    ];
    const aggregated = aggregateRawRecords(raw);
    assert.equal(aggregated.length, 2);
    const audit = runPreservationAudit(raw, aggregated);
    assert.equal(audit.silent_deletions, 0);
    assert.equal(audit.single_source_candidates, 2);
  });

  it("preserves variants as separate candidates", () => {
    const raw = [
      makeRaw({ raw_id: "a", source_id: "emoticon-data", original_kaomoji: "(^_^)" }),
      makeRaw({ raw_id: "b", source_id: "emoticon-data", original_kaomoji: "( ^_^ )" }),
    ];
    const aggregated = aggregateRawRecords(raw);
    assert.equal(aggregated.length, 2);
    assert.equal(aggregated[0]!.original_forms.length, 1);
  });

  it("passes preservation audit with no silent deletions", () => {
    const raw = [
      makeRaw({ raw_id: "a", source_id: "emoticon-data", original_kaomoji: "(^_^)" }),
      makeRaw({ raw_id: "b", source_id: "kaomoji-tagged", original_kaomoji: "(^_^)" }),
      makeRaw({ raw_id: "c", source_id: "wikipedia", original_kaomoji: "(-_-)" }),
    ];
    const aggregated = aggregateRawRecords(raw);
    const audit = runPreservationAudit(raw, aggregated);
    assert.equal(audit.silent_deletions, 0);
    assert.ok(audit.raw_gte_aggregated);
    assert.equal(audit.multi_source_candidates, 1);
    assert.equal(audit.single_source_candidates, 1);
  });
});

describe("kaomoji provenance", () => {
  it("builds provenance graph with five source refs", () => {
    const raw = [
      makeRaw({ raw_id: "1", source_id: "emoticon-data", original_kaomoji: "(^_^)" }),
      makeRaw({ raw_id: "2", source_id: "kaomoji-tagged", original_kaomoji: "(^_^)" }),
      makeRaw({ raw_id: "3", source_id: "wikipedia", original_kaomoji: "(^_^)" }),
      makeRaw({ raw_id: "4", source_id: "emoticon-data", original_kaomoji: "(-_-)" }),
      makeRaw({ raw_id: "5", source_id: "kaomoji-tagged", original_kaomoji: "(；´Д｀)" }),
    ];
    const aggregated = aggregateRawRecords(raw);
    const graph = buildProvenanceGraph(aggregated);
    const totalRefs = graph.reduce((sum, g) => sum + g.raw_ids.length, 0);
    assert.equal(totalRefs, 5);
    const happy = graph.find((g) => g.raw_ids.length === 3);
    assert.ok(happy);
    assert.equal(happy!.source_ids.length, 3);
  });
});

describe("kaomoji importers", () => {
  it("parses emoticon-data JSON", () => {
    const entries = parseEmoticonDataJson(mockEmoticonPayload);
    assert.equal(entries.length, 2);
    assert.equal(entries[0]!.original_kaomoji, "(^_^)");
    assert.equal(entries[0]!.source_record_id, "1");
  });

  it("parses kaomoji-tagged JSON", () => {
    const entries = parseKaomojiTaggedJson(mockKaomojiPayload);
    assert.equal(entries.length, 2);
    assert.equal(entries[1]!.source_record_id, "happy-2");
  });

  it("parses wikipedia wikitext with attribution", () => {
    const entries = parseWikipediaWikitext(mockWikiWikitext);
    assert.ok(entries.length >= 2);
    assert.equal(entries[0]!.license_status, "ATTRIBUTION_REQUIRED");
  });
});

describe("kaomoji idempotent collection", () => {
  it("merges by raw_id and updates last_seen", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "kaomoji-test-"));
    try {
      const fetchFn = createMockFetch();
      const first = await runCollection(tempDir, { fetchFn, runId: "run-1" });
      assert.ok(first.records.length >= 4);

      const firstSeenMap = new Map(first.records.map((r) => [r.raw_id, r.first_seen]));
      await new Promise((r) => setTimeout(r, 10));

      const second = await runCollection(tempDir, { fetchFn, runId: "run-2" });
      assert.equal(second.records.length, first.records.length);

      for (const record of second.records) {
        assert.equal(record.first_seen, firstSeenMap.get(record.raw_id));
        assert.ok(record.last_seen >= firstSeenMap.get(record.raw_id)!);
      }

      const recordsPath = join(tempDir, "data", "kaomoji", "raw", "records.json");
      const onDisk = JSON.parse(readFileSync(recordsPath, "utf8")) as RawKaomojiRecord[];
      assert.equal(onDisk.length, first.records.length);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("adds new records without duplicating existing raw_ids", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "kaomoji-test-"));
    try {
      const fetchFn = createMockFetch();
      const first = await runCollection(tempDir, { fetchFn });
      const countBefore = first.records.length;

      const importDir = join(tempDir, "data", "kaomoji", "imports");
      mkdirSync(importDir, { recursive: true });
      const importPath = join(importDir, "emoticon-data.json");
      writeFileSync(
        importPath,
        JSON.stringify({ entries: [{ original_kaomoji: "(^_^)", source_record_id: "1" }] }),
        "utf8",
      );

      const second = await runCollection(tempDir, { fetchFn });
      assert.equal(second.records.length, countBefore);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
