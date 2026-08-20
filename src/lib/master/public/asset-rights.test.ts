import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  canDownloadRegistryEntry,
  canDownloadArtworkProvider,
  canPublicServeRegistryEntry,
  canPublicServeArtworkProvider,
  filterPublicDefinitions,
  getAssetRightsRegistry,
  getRightsDashboardStats,
  isRestrictedMetadataSource,
  isRestrictedProvider,
  sanitizePublicProvenanceSource,
} from "@/lib/master/public/asset-rights";
import { LICENSE_REGISTRY } from "@/lib/master/public/license-registry";

describe("asset rights registry", () => {
  it("marks EmojiNet as restricted with no public serve or download", () => {
    const emojinet = LICENSE_REGISTRY.find((e) => e.provider === "EmojiNet");
    assert.ok(emojinet);
    assert.equal(isRestrictedProvider("EmojiNet"), true);
    assert.equal(canPublicServeRegistryEntry(emojinet!), false);
    assert.equal(canDownloadRegistryEntry(emojinet!), false);
    const rights = getAssetRightsRegistry().find((r) => r.provider === "EmojiNet");
    assert.equal(rights?.verificationStatus, "RESTRICTED");
    assert.equal(rights?.publicServeAllowed, false);
    assert.equal(rights?.downloadAllowed, false);
  });

  it("allows verified OpenMoji and Twemoji public serve", () => {
    const openmoji = LICENSE_REGISTRY.find((e) => e.provider === "OpenMoji");
    const twemoji = LICENSE_REGISTRY.find((e) => e.provider === "Twemoji");
    assert.ok(openmoji && twemoji);
    assert.equal(canPublicServeRegistryEntry(openmoji!), true);
    assert.equal(canDownloadRegistryEntry(openmoji!), true);
    assert.equal(canPublicServeRegistryEntry(twemoji!), true);
  });

  it("allows verified Noto and Fluent public serve and download", () => {
    const notoImage = LICENSE_REGISTRY.find(
      (e) => e.provider === "Noto Emoji" && e.assetType.includes("image"),
    );
    const notoFont = LICENSE_REGISTRY.find(
      (e) => e.provider === "Noto Emoji" && e.assetType.includes("font"),
    );
    const fluent = LICENSE_REGISTRY.find((e) => e.provider === "Fluent Emoji");
    assert.ok(notoImage && notoFont && fluent);
    assert.equal(canPublicServeRegistryEntry(notoImage!), true);
    assert.equal(canDownloadRegistryEntry(notoImage!), true);
    assert.equal(canPublicServeRegistryEntry(notoFont!), true);
    assert.equal(canDownloadRegistryEntry(notoFont!), true);
    assert.equal(notoFont!.license, "SIL Open Font License 1.1");
    assert.equal(canPublicServeRegistryEntry(fluent!), true);
    assert.equal(canDownloadRegistryEntry(fluent!), true);
    assert.equal(fluent!.commercialUseAllowed, true);
    const rights = getAssetRightsRegistry();
    const notoAttr = rights.find((r) => r.provider === "Noto Emoji" && r.assetType.includes("image"));
    const fluentAttr = rights.find((r) => r.provider === "Fluent Emoji");
    assert.ok(notoAttr?.attributionText.includes("Apache"));
    assert.ok(fluentAttr?.attributionText.includes("Microsoft"));
    assert.equal(canPublicServeArtworkProvider("noto"), true);
    assert.equal(canDownloadArtworkProvider("noto"), true);
    assert.equal(canPublicServeArtworkProvider("fluent"), true);
    assert.equal(canDownloadArtworkProvider("fluent"), true);
  });

  it("filters EmojiNet from public definitions and provenance", () => {
    const filtered = filterPublicDefinitions([
      { text: "a flame", source: "emojinet" },
      { text: "heat", source: "unicode" },
    ]);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.source, "unicode");
    assert.equal(isRestrictedMetadataSource("emojinet"), true);
    assert.equal(sanitizePublicProvenanceSource("emojinet"), "restricted-source");
  });

  it("calculates dashboard stats from registry without hard-coded counts", () => {
    const stats = getRightsDashboardStats();
    assert.equal(stats.totals.registryEntries, LICENSE_REGISTRY.length);
    assert.ok(stats.totals.artworkRecordsIndexed > 0);
    assert.ok(stats.providers.some((p) => p.provider === "EmojiNet" && p.restricted > 0));
  });

  it("fails if public enrichment JSON references EmojiNet", () => {
    for (const rel of ["src/data/emoji-enrichment.json", "src/data/emoji-search-enrichment.json"]) {
      const raw = readFileSync(join(process.cwd(), rel), "utf8");
      assert.equal(/emojinet/i.test(raw), false, `${rel} must not reference EmojiNet`);
    }
  });
});
