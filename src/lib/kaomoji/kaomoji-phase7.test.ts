import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { analyzeDuplicates } from "@/lib/kaomoji/processing/phase7/duplicate-analyze";
import { processRawRecord, resolvePublicationStatus } from "@/lib/kaomoji/processing/phase7/process-record";
import { createRawSnapshot, hashRawFile, verifyRawUnchanged } from "@/lib/kaomoji/processing/phase7/raw-snapshot";
import { analyzeUnicode } from "@/lib/kaomoji/processing/phase7/unicode-analyze";
import { analyzeVariants } from "@/lib/kaomoji/processing/phase7/variant-analyze";
import { EXPECTED_RAW_BASELINE, AUTHORITATIVE_RAW_SHA256 } from "@/lib/kaomoji/processing/phase7/pipeline";
import type { RawKaomojiRecord } from "@/lib/kaomoji/types";

function sampleRaw(overrides: Partial<RawKaomojiRecord> = {}): RawKaomojiRecord {
  return {
    raw_id: "test:1",
    source_id: "generate-kaomoji",
    source_url: "https://github.com/xav-ie/generate-kaomoji",
    source_record_id: "gk:0",
    source_page: null,
    source_category: "joy",
    source_title: null,
    original_kaomoji: "(｡♥‿♥｡)",
    raw_text: "(｡♥‿♥｡)",
    raw_html_context_if_needed: null,
    collection_timestamp: "2026-08-19T00:00:00.000Z",
    collector_version: "test",
    license_status: "REVIEW_REQUIRED",
    provenance: ["generate-kaomoji", "test"],
    content_type: "KAOMOJI",
    run_id: "test-run",
    ...overrides,
  } as RawKaomojiRecord;
}

describe("phase 7 raw processing", () => {
  it("preserves original_content during normalization", () => {
    const r = processRawRecord(sampleRaw());
    assert.equal(r.normalized.original_content, "(｡♥‿♥｡)");
    assert.ok(r.normalized.normalized_content);
  });

  it("unicode analysis detects ZWJ", () => {
    const u = analyzeUnicode("👨‍👩‍👧");
    assert.equal(u.has_zwj, true);
  });

  it("validates unusual kaomoji as VALID_KAOMOJI", () => {
    const r = processRawRecord(sampleRaw({ original_kaomoji: "٩(◕‿◕｡)۶", raw_text: "٩(◕‿◕｡)۶" }));
    assert.equal(r.processed.validation_status, "VALID_KAOMOJI");
  });

  it("flags URLs as INVALID_CANDIDATE without deleting", () => {
    const r = processRawRecord(sampleRaw({ original_kaomoji: "https://example.com", raw_text: "https://example.com" }));
    assert.equal(r.processed.validation_status, "INVALID_CANDIDATE");
  });

  it("duplicate analysis preserves both exact records", () => {
    const a = processRawRecord(sampleRaw({ raw_id: "a", original_kaomoji: "(^_^)", raw_text: "(^_)" }));
    const b = processRawRecord(sampleRaw({ raw_id: "b", original_kaomoji: "(^_^)", raw_text: "(^_)", source_id: "kawaii-faces" }));
    const dup = analyzeDuplicates([a.processed, b.processed]);
    assert.ok(dup.counts.EXACT >= 2);
    assert.ok(dup.counts.CROSS_SOURCE >= 2);
  });

  it("detects formatting variants", () => {
    const a = processRawRecord(sampleRaw({ raw_id: "a", original_kaomoji: "( ^_^ )", raw_text: "( ^_^ )" }));
    const b = processRawRecord(sampleRaw({ raw_id: "b", original_kaomoji: "(^_^)", raw_text: "(^_)" }));
    const variants = analyzeVariants([a.processed, b.processed]);
    assert.ok(variants.length >= 1);
  });

  it("unclear license maps to REVIEW_REQUIRED publication", () => {
    assert.equal(resolvePublicationStatus("VALID_KAOMOJI", "UNKNOWN"), "REVIEW_REQUIRED");
  });

  it("invalid license blocks publication not raw", () => {
    assert.equal(resolvePublicationStatus("VALID_KAOMOJI", "NOT_PERMITTED"), "BLOCKED");
  });

  it("raw snapshot verifies immutability", () => {
    const records = JSON.parse(readFileSync(join(process.cwd(), "data/kaomoji/raw/records.json"), "utf8")) as RawKaomojiRecord[];
    const snap = createRawSnapshot(process.cwd(), records);
    const verify = verifyRawUnchanged(process.cwd(), snap, records);
    assert.equal(verify.ok, true);
  });

  it("baseline raw count is 236508", () => {
    const records = JSON.parse(readFileSync(join(process.cwd(), "data/kaomoji/raw/records.json"), "utf8")) as unknown[];
    assert.equal(records.length, EXPECTED_RAW_BASELINE);
  });

  it("authoritative raw sha256 stable", () => {
    const { sha256 } = hashRawFile(join(process.cwd(), "data/kaomoji/raw/records.json"));
    assert.equal(sha256, AUTHORITATIVE_RAW_SHA256);
  });
});
