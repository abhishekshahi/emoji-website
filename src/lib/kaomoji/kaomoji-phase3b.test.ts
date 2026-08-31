import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getRegistryCount } from "@/lib/kaomoji/discovery/phase3b/discover";
import { loadCollectedSnapshot } from "@/lib/kaomoji/discovery/phase3b/snapshot";
import { KAOMOJI_SOURCE_REGISTRY } from "@/lib/kaomoji/sources/registry";
import { join } from "node:path";

describe("phase 3B discovery", () => {
  it("registers all 10 sources", () => {
    assert.equal(getRegistryCount(), 10);
    assert.equal(KAOMOJI_SOURCE_REGISTRY.length, 10);
  });

  it("loads collected snapshot without loss baseline", () => {
    const root = join(process.cwd());
    const snap = loadCollectedSnapshot(root);
    assert.ok(snap.total_raw >= 3372);
    // Snapshot is computed live from RAW. Authoritative emoticon-data occurrence count in
    // current RAW is 6617 (unique content 3176). Historical: upstream ~1562 unique;
    // early Phase-5 tag-expansion baseline ~1879 — those are not the RAW source count.
    assert.equal(snap.by_source["emoticon-data"]?.raw, 6617);
  });
});
