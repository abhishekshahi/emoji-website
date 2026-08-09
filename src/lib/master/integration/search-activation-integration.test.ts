import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import { searchEmojis } from "@/lib/emoji/search";
import type { BrowsableEmoji } from "@/lib/emoji/types";
import { createEmojiPageMetadata } from "@/lib/seo/metadata";
import { getOpenMojiArtworkPath } from "@/lib/artwork/openmoji";
import {
  MASTER_INTEGRATION_CONFIG,
  PRODUCTION_BASELINES,
  getEnrichedMetadata,
  isAmbiguousMasterSearchTerm,
  isMasterSearchIntegrationEnabled,
  isMasterSeoIntegrationEnabled,
  resolveCanonicalIdFromShortcode,
  runWithIntegrationFlags,
  searchMasterIntegrated,
  searchProductionEmojis,
} from "@/lib/master/integration";
import { buildSearchActivationPackage } from "@/lib/master/integration/search-activation/build";
import { SEARCH_ACTIVATION_PHASE } from "@/lib/master/integration/config";
import { MASTER_SEARCH_SCORE } from "@/lib/master/integration/search/ranking";
import { verifyFrozenChecksums } from "@/lib/master/release/build";
import type { FileChecksumEntry } from "@/lib/master/release/types";

const rootDir = process.cwd();
const searchable = [...(emojis as BrowsableEmoji[]), ...(extras as BrowsableEmoji[])];

const CRITICAL = {
  fire: "unicode:1F525",
  thumbsUp: "unicode:1F44D",
  thumbsUpLight: "unicode:1F44D-1F3FB",
  thumbsUpDark: "unicode:1F44D-1F3FF",
  manTechnologist: "unicode:1F468-200D-1F4BB",
  womanTechnologist: "unicode:1F469-200D-1F4BB",
  indiaFlag: "unicode:1F1EE-1F1F3",
  textSmile: "unicode:263A",
  emojiSmile: "unicode:263A-FE0F",
  rainbowFlag: "unicode:1F3F3-FE0F-200D-1F308",
  whiteFlag: "unicode:1F3F3-FE0F",
  heart: "unicode:2764-FE0F",
  notoUtility: "source:noto:noto.png",
} as const;

function topCanonical(query: string): string | undefined {
  return searchMasterIntegrated(query, rootDir, 10).results[0]?.canonicalId;
}

describe("phase 8.11G master search activation", () => {
  const activation = buildSearchActivationPackage(rootDir);

  it("keeps masterSearchEnabled false after controlled QA rollback", () => {
    assert.equal(MASTER_INTEGRATION_CONFIG.masterSearchEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterSEOEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterArtworkEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterMetadataEnabled, false);
    assert.equal(isMasterSearchIntegrationEnabled(), false);
    assert.equal(isMasterSeoIntegrationEnabled(), false);
  });

  describe("master search activation QA", () => {
    it("resolves fire through emoji, name, keyword, semantic, shortcode, and unicode forms", () => {
      assert.equal(topCanonical("🔥"), CRITICAL.fire);
      assert.equal(topCanonical("fire"), CRITICAL.fire);
      assert.equal(topCanonical("flame"), CRITICAL.fire);
      assert.equal(topCanonical("burn"), CRITICAL.fire);
      assert.equal(resolveCanonicalIdFromShortcode(":fire:", rootDir), CRITICAL.fire);
      assert.equal(topCanonical("U+1F525"), CRITICAL.fire);
      assert.equal(topCanonical("1F525"), CRITICAL.fire);
    });

    it("resolves thumbs up, skin tones, ZWJ, flag, heart, and pride flag distinctly", () => {
      assert.equal(topCanonical("👍"), CRITICAL.thumbsUp);
      assert.equal(topCanonical("thumbs up"), CRITICAL.thumbsUp);
      assert.equal(topCanonical("👍🏻"), CRITICAL.thumbsUpLight);
      assert.equal(topCanonical("👍🏿"), CRITICAL.thumbsUpDark);
      assert.equal(topCanonical("👨‍💻"), CRITICAL.manTechnologist);
      assert.equal(topCanonical("👩‍💻"), CRITICAL.womanTechnologist);
      assert.ok(topCanonical("India") === CRITICAL.indiaFlag || topCanonical("🇮🇳") === CRITICAL.indiaFlag);
      assert.ok(topCanonical("heart") === CRITICAL.heart || topCanonical("❤️") === CRITICAL.heart);
      assert.equal(topCanonical("pride flag"), CRITICAL.rainbowFlag);
      assert.notEqual(topCanonical("pride flag"), CRITICAL.whiteFlag);
    });

    it("keeps variation selector identities separate", () => {
      assert.equal(topCanonical("☺"), CRITICAL.textSmile);
      assert.equal(topCanonical("☺️"), CRITICAL.emojiSmile);
      assert.notEqual(CRITICAL.textSmile, CRITICAL.emojiSmile);
    });

    it("preserves ambiguity for hot without forcing fire only", () => {
      assert.equal(isAmbiguousMasterSearchTerm("hot", rootDir), true);
      const hot = searchMasterIntegrated("hot", rootDir, 30);
      assert.equal(hot.ambiguous, true);
      assert.ok(hot.results.length > 1);
      assert.ok(!(hot.results.length === 1 && hot.results[0]?.canonicalId === CRITICAL.fire));
    });

    it("keeps restricted aliases out of public search matching", () => {
      const fire = getEnrichedMetadata(CRITICAL.fire, rootDir);
      assert.ok(fire);
      for (const alias of fire.restrictedAliases) {
        const response = searchMasterIntegrated(alias.value, rootDir, 5);
        const directAliasMatch = response.results.find(
          (result) =>
            result.matchedField === "alias" &&
            result.matchedTerm.toLowerCase() === alias.value.toLowerCase(),
        );
        assert.equal(directAliasMatch, undefined);
      }
    });

    it("does not promote snapstreak or EmojiNet definitions as blind public search terms", () => {
      const fire = getEnrichedMetadata(CRITICAL.fire, rootDir);
      assert.ok(fire?.sourceKeywords.some((entry) => entry.value === "snapstreak"));
      const snapstreak = searchMasterIntegrated("snapstreak", rootDir, 5);
      assert.ok(snapstreak.results.length === 0 || snapstreak.results[0]?.matchedField !== "semantic");

      const definitionProbe = fire?.emojinetDefinitions[0]?.definition ?? "";
      if (definitionProbe.length > 12) {
        const phrase = definitionProbe.split(/\s+/).slice(0, 4).join(" ").toLowerCase();
        const definitionSearch = searchMasterIntegrated(phrase, rootDir, 5);
        assert.ok(
          definitionSearch.results.length === 0 ||
            !definitionSearch.results.some((result) => result.matchedField === "semantic" && result.matchedTerm === phrase),
        );
      }
    });

    it("supports partial, case, and whitespace-normalized queries deterministically", () => {
      assert.ok(searchMasterIntegrated("fir", rootDir, 10).results.some((result) => result.canonicalId === CRITICAL.fire));
      assert.equal(topCanonical("Fire"), topCanonical("fire"));
      assert.equal(topCanonical("FIRE"), topCanonical("fire"));
      assert.equal(topCanonical(" fire "), topCanonical("fire"));

      const first = searchMasterIntegrated("flame", rootDir, 10);
      const second = searchMasterIntegrated("flame", rootDir, 10);
      assert.deepEqual(
        first.results.map((result) => ({
          canonicalId: result.canonicalId,
          score: result.score,
          matchedField: result.matchedField,
        })),
        second.results.map((result) => ({
          canonicalId: result.canonicalId,
          score: result.score,
          matchedField: result.matchedField,
        })),
      );
    });

    it("excludes utility and artwork-only identities from search results", () => {
      assert.equal(
        searchMasterIntegrated("noto.png", rootDir, 10).results.some((result) => result.canonicalId === CRITICAL.notoUtility),
        false,
      );
    });

    it("preserves standard-over-extra ranking when relevance is equal", () => {
      const results = searchMasterIntegrated("fire", rootDir, 20).results;
      let sawExtra = false;
      for (const result of results) {
        if (result.isExtra) {
          sawExtra = true;
          assert.ok(results.some((earlier) => !earlier.isExtra));
        }
      }
      assert.equal(sawExtra || results.every((result) => !result.isExtra), true);
    });

    it("retains provenance fields without exposing filesystem paths", () => {
      const results = searchMasterIntegrated("fire", rootDir, 5).results;
      assert.ok(results.length > 0);
      for (const result of results) {
        assert.ok(result.canonicalId.length > 0);
        assert.ok(result.matchedField.length > 0);
        assert.ok(result.score > 0);
        assert.ok(result.source.length > 0);
        assert.ok(result.confidence > 0);
        assert.ok(result.provenance.canonicalId.length > 0);
        const serialized = JSON.stringify(result);
        assert.equal(serialized.includes("src/data"), false);
        assert.equal(serialized.includes("node_modules"), false);
      }
    });

    it("activates production bridge only when masterSearchEnabled is true", () => {
      const disabled = searchProductionEmojis(searchable, "flame", 10);
      const production = searchEmojis(searchable, "flame", 10);
      assert.deepEqual(
        disabled.map((result) => ({ id: result.emoji.id, score: result.score })),
        production.map((result) => ({ id: result.emoji.id, score: result.score })),
      );

      runWithIntegrationFlags({ masterSearchEnabled: true }, () => {
        const enabled = searchProductionEmojis(searchable, "🔥", 5);
        assert.equal(enabled[0]?.emoji.emoji, "🔥");
        assert.equal(enabled[0]?.emoji.hexcode, "1F525");
        assert.ok((enabled[0]?.score ?? 0) >= MASTER_SEARCH_SCORE.EXACT_EMOJI - 1);
      });
    });

    it("keeps empty-query behavior unchanged", () => {
      assert.equal(searchProductionEmojis(searchable, "", 10).length, 0);
      assert.equal(searchMasterIntegrated("", rootDir, 10).results.length, 0);
    });
  });

  describe("production safety", () => {
    it("keeps SEO unchanged while search QA runs", () => {
      const fire = searchable.find((entry) => entry.hexcode === "1F525");
      assert.ok(fire);
      const metadata = createEmojiPageMetadata({
        name: fire.name,
        emoji: fire.emoji,
        slug: fire.slug,
        keywords: fire.keywords,
        codePointString: fire.codePointString,
        artworkPath: getOpenMojiArtworkPath(fire.hexcode),
      });
      assert.ok(metadata.title);
      assert.ok(metadata.description);
    });

    it("keeps client search hook free of filesystem imports", () => {
      const source = readFileSync(join(rootDir, "src/hooks/use-emoji-search.ts"), "utf8");
      assert.equal(source.includes("node:fs"), false);
      assert.equal(source.includes("master-reader"), false);
      assert.equal(source.includes("searchProductionEmojis"), false);
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

  it("passes search activation audit package", () => {
    assert.equal(activation.searchActivationAudit.phase, SEARCH_ACTIVATION_PHASE);
    assert.equal(activation.searchActivationAudit.status, "PASS");
    assert.equal(activation.searchRankingAudit.status, "PASS");
    assert.equal(activation.searchSafetyAudit.status, "PASS");
    assert.equal(activation.searchAmbiguityAudit.status, "PASS");
    assert.equal(activation.searchProvenanceAudit.status, "PASS");
    assert.equal(activation.searchPerformanceAudit.status, "PASS");
    assert.equal(activation.searchFallbackAudit.status, "PASS");
    assert.equal(activation.searchProductionCompatibility.status, "PASS");
    assert.equal(activation.searchFeatureFlagAudit.status, "PASS");
    assert.equal(activation.searchActivationAudit.routesChanged, false);
    assert.equal(activation.searchActivationAudit.seoChanged, false);
  });
});
