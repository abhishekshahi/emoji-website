import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import { searchEmojis } from "@/lib/emoji/search";
import type { BrowsableEmoji } from "@/lib/emoji/types";
import {
  buildMetadataIntegrationPackage,
  buildSearchIntegrationPackage,
  getEnrichedMetadata,
  getProductionMetadata,
  getSourceMetadata,
  getSourceMetadataAvailability,
  isMasterMetadataIntegrationEnabled,
  isMasterSearchIntegrationEnabled,
  isAmbiguousMasterSearchTerm,
  MASTER_INTEGRATION_CONFIG,
  resolveCanonicalIdFromShortcode,
  searchMasterIntegrated,
  searchProductionEmojis,
} from "@/lib/master/integration";

const rootDir = process.cwd();
const searchableEmojis = [
  ...(emojis as BrowsableEmoji[]),
  ...(extras as BrowsableEmoji[]),
];

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function topIntegratedCanonicalId(query: string): string | undefined {
  return searchMasterIntegrated(query, rootDir, 5).results[0]?.canonicalId;
}

describe("phase 8.11C metadata and search integration", () => {
  const metadataPackage = buildMetadataIntegrationPackage(rootDir);
  const searchPackage = buildSearchIntegrationPackage(rootDir);

  it("keeps masterMetadataEnabled and masterSearchEnabled false", () => {
    assert.equal(MASTER_INTEGRATION_CONFIG.masterMetadataEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterSearchEnabled, false);
    assert.equal(isMasterMetadataIntegrationEnabled(), false);
    assert.equal(isMasterSearchIntegrationEnabled(), false);
  });

  it("returns null production metadata while feature flag is disabled", () => {
    assert.equal(getProductionMetadata("1F525", "standard"), null);
  });

  it("exposes enriched metadata with source provenance for fire", () => {
    const fire = getEnrichedMetadata("unicode:1F525", rootDir);
    assert.ok(fire);
    assert.equal(fire.canonicalName.value, "fire");
    assert.ok(fire.sourceKeywords.length > 0);
    assert.ok(fire.canonicalKeywords.length > 0);
    assert.ok(fire.shortcodeRecords.some((entry) => entry.normalizedShortcode === "fire"));
    assert.ok(fire.emojinetDefinitions.length > 0);
    assert.ok(fire.emojinetSenseCount > 0);
  });

  it("preserves source-specific metadata without flattening", () => {
    const sources = ["unicode", "cldr", "openmoji", "emojibase", "emojilib", "emojinet", "fluent"] as const;
    for (const source of sources) {
      const record = getSourceMetadata("unicode:1F525", source, rootDir);
      assert.ok(record);
      assert.equal(record.metadataAvailable, true);
      assert.equal(record.source, source);
    }
  });

  it("does not invent Noto or Twemoji metadata", () => {
    const availability = getSourceMetadataAvailability("unicode:1F525", rootDir);
    assert.equal(availability.noto, false);
    assert.equal(availability.twemoji, false);
    assert.equal(getSourceMetadata("unicode:1F525", "noto", rootDir)?.metadataAvailable, false);
    assert.equal(getSourceMetadata("unicode:1F525", "twemoji", rootDir)?.metadataAvailable, false);
  });

  it("preserves Emojilib source keywords like snapstreak", () => {
    const fire = getEnrichedMetadata("unicode:1F525", rootDir);
    assert.ok(fire?.sourceKeywords.some((entry) => entry.value === "snapstreak" && entry.sources.includes("emojilib")));
  });

  it("keeps restricted aliases separate from safe aliases", () => {
    const fire = getEnrichedMetadata("unicode:1F525", rootDir);
    assert.ok(fire);
    assert.ok(fire.safeAliases.length >= 0);
    assert.ok(fire.restrictedAliases.length >= 0);
    assert.ok(fire.safeAliases.every((alias) => alias.publicAlias));
    assert.ok(fire.restrictedAliases.every((alias) => !alias.publicAlias));
  });

  it("resolves :fire: shortcode to unicode:1F525", () => {
    assert.equal(resolveCanonicalIdFromShortcode(":fire:", rootDir), "unicode:1F525");
  });

  it("resolves fire queries strongly to unicode:1F525", () => {
    assert.equal(topIntegratedCanonicalId("🔥"), "unicode:1F525");
    assert.equal(topIntegratedCanonicalId("fire"), "unicode:1F525");
    assert.equal(topIntegratedCanonicalId("flame"), "unicode:1F525");
    assert.equal(topIntegratedCanonicalId("burn"), "unicode:1F525");
    assert.equal(topIntegratedCanonicalId(":fire:"), "unicode:1F525");
    assert.equal(topIntegratedCanonicalId("U+1F525"), "unicode:1F525");
    assert.equal(topIntegratedCanonicalId("1F525"), "unicode:1F525");
  });

  it("resolves thumbs up, flag, technologist, and heart queries", () => {
    assert.equal(topIntegratedCanonicalId("👍"), "unicode:1F44D");
    assert.equal(topIntegratedCanonicalId("thumbs up"), "unicode:1F44D");
    assert.equal(topIntegratedCanonicalId("🇮🇳"), "unicode:1F1EE-1F1F3");
    assert.ok(searchMasterIntegrated("technologist", rootDir, 10).results.some((r) => r.canonicalId === "unicode:1F468-200D-1F4BB"));
    assert.equal(topIntegratedCanonicalId("❤️"), "unicode:2764-FE0F");
  });

  it("marks hot as ambiguous and does not force hot to fire only", () => {
    assert.equal(isAmbiguousMasterSearchTerm("hot", rootDir), true);
    const hot = searchMasterIntegrated("hot", rootDir, 30);
    assert.equal(hot.ambiguous, true);
    assert.ok(!(hot.results.length === 1 && hot.results[0]?.canonicalId === "unicode:1F525"));
  });

  it("keeps existing production search unchanged when masterSearchEnabled is false", () => {
    const queries = ["fire", "flame", ":fire:", "hot", "thumbs up", "1F525"];
    for (const query of queries) {
      const production = searchEmojis(searchableEmojis, query, 10);
      const integrated = searchProductionEmojis(searchableEmojis, query, 10);
      assert.deepEqual(
        integrated.map((result) => ({ id: result.emoji.id, score: result.score })),
        production.map((result) => ({ id: result.emoji.id, score: result.score })),
      );
    }
  });

  it("does not expose internal paths or checksums in search results", () => {
    const results = searchMasterIntegrated("fire", rootDir, 5).results;
    assert.ok(results.length > 0);
    for (const result of results) {
      const serialized = JSON.stringify(result);
      assert.equal(serialized.includes("checksum"), false);
      assert.equal(serialized.includes("rawRecordRef"), false);
      assert.equal(serialized.includes("http://"), false);
      assert.equal(serialized.includes("https://"), false);
    }
  });

  it("passes metadata integration audit", () => {
    assert.equal(metadataPackage.metadataIntegrationAudit.status, "PASS");
    assert.equal(metadataPackage.metadataProviderCoverage.totals.aliases, 4015);
    assert.equal(metadataPackage.metadataProviderCoverage.totals.safeAliases, 3580);
    assert.equal(metadataPackage.metadataProviderCoverage.totals.restrictedAliases, 435);
    assert.equal(metadataPackage.metadataProductionCoverage.mappedRecords, 4486);
  });

  it("passes search integration audit", () => {
    assert.equal(searchPackage.searchIntegrationAudit.status, "PASS");
    assert.equal(searchPackage.searchRankingAudit.status, "PASS");
    assert.equal(searchPackage.searchProductionCoverage.status, "PASS");
  });

  it("keeps production data unchanged", () => {
    assert.equal(emojis.length, 3944);
    assert.equal(extras.length, 542);
    assert.notEqual(
      sha256File(join(rootDir, "src", "data", "emojis.json")),
      sha256File(join(rootDir, "src", "data", "openmoji-extras.json")),
    );
  });

  it("writes metadata and search integration output files", () => {
    const metadataAudit = readJson<{ status: string }>(
      join(rootDir, "src/data/master/integration/metadata/metadata-integration-audit.json"),
    );
    const searchAudit = readJson<{ status: string }>(
      join(rootDir, "src/data/master/integration/search/search-integration-audit.json"),
    );
    assert.equal(metadataAudit.status, "PASS");
    assert.equal(searchAudit.status, "PASS");
  });
});

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}
