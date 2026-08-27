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
    // Phase 5 tag expansion: one RAW occurrence per emoticon tag (1879), not unique emoticons (1562).
    assert.ok(snap.by_source["emoticon-data"]?.raw === 1879);
  });
});
