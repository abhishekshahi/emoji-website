import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import { getSearchHighlightSegments, isAmbiguousSearchQuery } from "@/lib/emoji/search-highlight";
import { SEARCH_UI_CONTRACT } from "@/lib/emoji/search-ui-contract";
import { searchEmojis } from "@/lib/emoji/search";
import type { BrowsableEmoji } from "@/lib/emoji/types";
import { createPageMetadata } from "@/lib/seo/metadata";
import {
  MASTER_INTEGRATION_CONFIG,
  PRODUCTION_BASELINES,
  isMasterSearchIntegrationEnabled,
  isMasterSeoIntegrationEnabled,
  runWithIntegrationFlags,
  searchMasterIntegrated,
  searchProductionEmojis,
} from "@/lib/master/integration";
import { SEARCH_UI_PHASE } from "@/lib/master/integration/config";
import { buildSearchUiPackage } from "@/lib/master/integration/search-ui/build";
import { verifyFrozenChecksums } from "@/lib/master/release/build";
import type { FileChecksumEntry } from "@/lib/master/release/types";
import {
  getCopyIdentityValue,
  getFavoriteIdentityKey,
  getRecentIdentityKey,
} from "@/lib/master/integration/ui/production-bridge";

const rootDir = process.cwd();
const searchable = [...(emojis as BrowsableEmoji[]), ...(extras as BrowsableEmoji[])];

function readSource(relativePath: string): string {
  return readFileSync(join(rootDir, relativePath), "utf8");
}

describe("phase 8.11H master search UI integration", () => {
  it("keeps all feature flags disabled after controlled QA rollback", () => {
    assert.equal(MASTER_INTEGRATION_CONFIG.masterSearchEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterSEOEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterArtworkEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterMetadataEnabled, false);
    assert.equal(isMasterSearchIntegrationEnabled(), false);
    assert.equal(isMasterSeoIntegrationEnabled(), false);
  });

  describe("search input and presentation", () => {
    it("exposes search input UX contract features", () => {
      const searchBar = readSource("src/components/search/search-bar.tsx");
      assert.match(searchBar, /role="search"/);
      assert.match(searchBar, /aria-label="Clear search"/);
      assert.match(searchBar, /Escape/);
      assert.match(searchBar, /SEARCH_UI_CONTRACT\.debounceMs/);
    });

    it("highlights matching name segments without exposing scores", () => {
      const segments = getSearchHighlightSegments("fire engine", "fire");
      assert.ok(segments.some((segment) => segment.highlight && segment.text === "fire"));
      const serialized = JSON.stringify(segments);
      assert.equal(serialized.includes("score"), false);
    });

    it("preserves empty and no-results states", () => {
      const searchResults = readSource("src/components/search/search-results.tsx");
      assert.match(searchResults, /Start typing to search emojis/);
      assert.match(searchResults, /No emojis matched/);
      assert.equal(searchEmojis(searchable, "", 10).length, 0);
      assert.equal(searchEmojis(searchable, "xyzabc123", 10).length, 0);
    });

    it("shows ambiguity guidance for hot without forcing fire only", () => {
      assert.equal(isAmbiguousSearchQuery("hot"), true);
      const hot = searchMasterIntegrated("hot", rootDir, 20);
      assert.ok(hot.results.length > 1);
      assert.match(readSource("src/components/search/search-results.tsx"), /Multiple matches/);
    });
  });

  describe("ranking presentation", () => {
    it("preserves critical ranking order under master search", () => {
      const cases = [
        { query: "fire", hex: "1F525" },
        { query: "flame", hex: "1F525" },
        { query: "thumbs up", hex: "1F44D" },
        { query: "pride flag", hex: "1F3F3-FE0F-200D-1F308" },
      ] as const;

      for (const { query, hex } of cases) {
        const top = searchMasterIntegrated(query, rootDir, 5).results[0]?.productionHexcode;
        assert.equal(top?.toUpperCase(), hex.toUpperCase(), query);
      }
    });

    it("remains deterministic across repeated queries", () => {
      const first = searchMasterIntegrated("fire", rootDir, 10);
      const second = searchMasterIntegrated("fire", rootDir, 10);
      assert.deepEqual(
        first.results.map((result) => result.canonicalId),
        second.results.map((result) => result.canonicalId),
      );
    });
  });

  describe("accessibility, bundle, and network safety", () => {
    it("keeps client search modules free of filesystem dependencies", () => {
      for (const forbidden of SEARCH_UI_CONTRACT.forbiddenClientImports) {
        assert.equal(readSource("src/hooks/use-emoji-search.ts").includes(forbidden), false);
        assert.equal(readSource("src/components/search/search-bar.tsx").includes(forbidden), false);
        assert.equal(readSource("src/components/search/search-results.tsx").includes(forbidden), false);
      }
    });

    it("uses semantic labels for copy and favorite controls", () => {
      const emojiCard = readSource("src/components/emoji/emoji-card.tsx");
      assert.match(emojiCard, /Copy .* emoji/);
      assert.match(emojiCard, /favorites/);
      assert.match(emojiCard, /aria-pressed/);
    });

    it("loads only production emoji JSON on the client", () => {
      const hook = readSource("src/hooks/use-emoji-search.ts");
      assert.match(hook, /emojis\.json/);
      assert.match(hook, /openmoji-extras\.json/);
      assert.equal(hook.includes("fetch("), false);
      assert.equal(searchable.length, SEARCH_UI_CONTRACT.maxClientEmojiRecords);
    });
  });

  describe("identity, fallback, and feature flags", () => {
    it("keeps favorites, recents, and copy tied to emoji identity", () => {
      const context = Object.freeze({
        hexcode: "1F525",
        productionType: "standard" as const,
        emoji: "🔥",
        name: "fire",
        slug: "fire",
      });
      assert.equal(getFavoriteIdentityKey(context), "1F525");
      assert.equal(getRecentIdentityKey(context), "1F525");
      assert.equal(getCopyIdentityValue(context), "🔥");
    });

    it("falls back to production search when masterSearchEnabled is false", () => {
      const production = searchEmojis(searchable, "fire", 10);
      const bridged = searchProductionEmojis(searchable, "fire", 10);
      assert.deepEqual(
        production.map((result) => result.emoji.id),
        bridged.map((result) => result.emoji.id),
      );
    });

    it("activates master search only under controlled flag override", () => {
      runWithIntegrationFlags({ masterSearchEnabled: true }, () => {
        const enabled = searchProductionEmojis(searchable, "🔥", 5);
        assert.equal(enabled[0]?.emoji.emoji, "🔥");
      });
      assert.equal(MASTER_INTEGRATION_CONFIG.masterSearchEnabled, false);
    });

    it("isolates search flag from artwork, metadata, and SEO flags", () => {
      const searchOnly = runWithIntegrationFlags({ masterSearchEnabled: true }, () => ({
        search: MASTER_INTEGRATION_CONFIG.masterSearchEnabled,
        artwork: MASTER_INTEGRATION_CONFIG.masterArtworkEnabled,
        metadata: MASTER_INTEGRATION_CONFIG.masterMetadataEnabled,
        seo: MASTER_INTEGRATION_CONFIG.masterSEOEnabled,
      }));
      assert.deepEqual(searchOnly, {
        search: true,
        artwork: false,
        metadata: false,
        seo: false,
      });
    });
  });

  describe("production safety", () => {
    it("keeps SEO metadata unchanged while search UI is audited", () => {
      const metadata = createPageMetadata({
        title: "Search Emojis",
        description: "Search emojis by name, keyword, emoji character, or Unicode code point.",
        path: "/search",
      });
      assert.ok(metadata.title);
      assert.ok(metadata.description);
      assert.equal(MASTER_INTEGRATION_CONFIG.masterSEOEnabled, false);
    });

    it("preserves frozen release and production counts", () => {
      const checksums = JSON.parse(
        readFileSync(join(rootDir, "src/data/master/release/8.10/master-file-checksums.json"), "utf8"),
      ) as FileChecksumEntry[];
      assert.equal(verifyFrozenChecksums(rootDir, checksums).status, "PASS");
      assert.equal((emojis as BrowsableEmoji[]).length, PRODUCTION_BASELINES.standardRecords);
      assert.equal((extras as BrowsableEmoji[]).length, PRODUCTION_BASELINES.extrasRecords);
    });
  });

  it("passes search UI audit package", () => {
    const uiPackage = buildSearchUiPackage(rootDir);
    assert.equal(uiPackage.searchUiAudit.phase, SEARCH_UI_PHASE);
    assert.equal(uiPackage.searchUiAudit.status, "PASS");
    assert.equal(uiPackage.searchInputAudit.status, "PASS");
    assert.equal(uiPackage.searchRankingUiAudit.status, "PASS");
    assert.equal(uiPackage.searchAccessibilityAudit.status, "PASS");
    assert.equal(uiPackage.searchBundleAudit.status, "PASS");
    assert.equal(uiPackage.searchFallbackAudit.status, "PASS");
    assert.equal(uiPackage.searchFlagIsolationAudit.status, "PASS");
    assert.equal(uiPackage.searchReleaseIntegrity.status, "PASS");
    assert.equal(uiPackage.searchUiAudit.seoChanged, false);
    assert.equal(uiPackage.searchUiAudit.routesChanged, false);
  });
});
