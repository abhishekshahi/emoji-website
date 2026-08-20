import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOccurrenceRawId } from "@/lib/kaomoji/collection/ids";
import { expandEmoticonDataOccurrences } from "@/lib/kaomoji/collection/importers/phase5-sources";
import { parseWooormEmoticonAlias } from "@/lib/kaomoji/collection/importers/github-repo";
import { getPhase5UniqueSourceCount, PHASE5_SOURCE_REGISTRY } from "@/lib/kaomoji/sources/registry-phase5";

describe("phase 5 no-dedup acquisition", () => {
  it("registers 21 unique source identities from 23 candidates", () => {
    assert.equal(getPhase5UniqueSourceCount(), 21);
    assert.equal(PHASE5_SOURCE_REGISTRY.length, 21);
    const ids = PHASE5_SOURCE_REGISTRY.map((s) => s.source_id);
    assert.equal(new Set(ids).size, 21);
    assert.equal(ids.filter((id) => id === "toolcalculator").length, 1);
  });

  it("buildOccurrenceRawId preserves separate category occurrences", () => {
    const a = buildOccurrenceRawId({
      source_id: "messletters",
      source_record_id: "123",
      source_page: "https://example.com/happy/",
      source_category: "happy",
      source_file: null,
    });
    const b = buildOccurrenceRawId({
      source_id: "messletters",
      source_record_id: "123",
      source_page: "https://example.com/sad/",
      source_category: "sad",
      source_file: null,
    });
    assert.notEqual(a, b);
  });

  it("expands emoticon-data to one occurrence per tag", () => {
    const expanded = expandEmoticonDataOccurrences([
      { original_kaomoji: ":-)", source_record_id: "1", source_category: "happy, sad" },
    ]);
    assert.equal(expanded.length, 2);
    assert.equal(expanded[0]!.source_category, "happy");
    assert.equal(expanded[1]!.source_category, "sad");
  });

  it("parses wooorm emoticon aliases as separate occurrences", () => {
    const entries = parseWooormEmoticonAlias({ smile: [":)", ":-)"] }, "alias.json");
    assert.equal(entries.length, 2);
  });
});
