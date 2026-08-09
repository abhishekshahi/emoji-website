import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import {
  buildIntegrationPackage,
  getArtwork,
  getCanonicalEmoji,
  getMasterReader,
  getMetadata,
  getMasterSEO,
  isAmbiguousMasterSearchTerm,
  mapProductionExtra,
  mapProductionStandard,
  MASTER_INTEGRATION_CONFIG,
  PRODUCTION_BASELINES,
  resetMasterReaderCache,
  searchMaster,
} from "@/lib/master/integration";

const rootDir = process.cwd();
const integrationDir = join(rootDir, "src", "data", "master", "integration");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function findProductionEmoji(hexcode: string): { hexcode: string } {
  const record = (emojis as Array<{ hexcode: string }>).find((entry) => entry.hexcode === hexcode);
  assert.ok(record, `Missing production emoji ${hexcode}`);
  return record;
}

describe("phase 8.11A master integration adapters", () => {
  const packageResult = buildIntegrationPackage(rootDir);
  const reader = getMasterReader(rootDir);

  it("verifies frozen release master-8.10-20260809", () => {
    assert.equal(reader.manifest.releaseId, "master-8.10-20260809");
    assert.equal(reader.manifest.status, "frozen");
    assert.equal(reader.manifest.phase, "8.10");
    assert.equal(reader.releaseVerification.verified, true);
    assert.equal(reader.releaseVerification.checksumStatus, "PASS");
  });

  it("defaults all integration feature flags to false", () => {
    assert.equal(MASTER_INTEGRATION_CONFIG.masterIntegrationEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterArtworkEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterMetadataEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterSearchEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterSEOEnabled, false);
  });

  it("resolves canonical fire identity with provenance", () => {
    const fire = getCanonicalEmoji("unicode:1F525");
    assert.ok(fire);
    assert.equal(fire.canonicalName?.value, "fire");
    assert.equal(fire.canonicalName?.canonicalId, "unicode:1F525");
    assert.equal(fire.identity.emoji, "🔥");
    assert.ok(fire.identity.sourceRecords.length > 1);
  });

  it("keeps thumbs up skin-tone variants as distinct canonical identities", () => {
    const base = getCanonicalEmoji("unicode:1F44D");
    const light = getCanonicalEmoji("unicode:1F44D-1F3FB");
    const dark = getCanonicalEmoji("unicode:1F44D-1F3FF");
    assert.ok(base && light && dark);
    assert.notEqual(base.canonicalId, light.canonicalId);
    assert.notEqual(light.canonicalId, dark.canonicalId);
  });

  it("keeps technologist gender sequences separate", () => {
    const man = getCanonicalEmoji("unicode:1F468-200D-1F4BB");
    const woman = getCanonicalEmoji("unicode:1F469-200D-1F4BB");
    assert.ok(man && woman);
    assert.notEqual(man.canonicalId, woman.canonicalId);
    assert.equal(man.identity.emoji, "👨‍💻");
    assert.equal(woman.identity.emoji, "👩‍💻");
  });

  it("preserves India flag sequence", () => {
    const india = getCanonicalEmoji("unicode:1F1EE-1F1F3");
    assert.ok(india);
    assert.equal(india.identity.emoji, "🇮🇳");
  });

  it("keeps U+263A and U+263A-FE0F as separate canonical identities", () => {
    const text = getCanonicalEmoji("unicode:263A");
    const emojiQualified = getCanonicalEmoji("unicode:263A-FE0F");
    assert.ok(text && emojiQualified);
    assert.notEqual(text.canonicalId, emojiQualified.canonicalId);
  });

  it("preserves rainbow flag sequence", () => {
    const rainbow = getCanonicalEmoji("unicode:1F3F3-FE0F-200D-1F308");
    assert.ok(rainbow);
    assert.equal(rainbow.identity.emoji, "🏳️‍🌈");
  });

  it("preserves OpenMoji private-use identity", () => {
    const pua = getCanonicalEmoji("source:openmoji:E000");
    assert.ok(pua);
    assert.equal(pua.identity.isUnicode, false);
    assert.equal(pua.identity.identityType, "private-use");
  });

  it("maps all 3944 production standard records to master identities", () => {
    assert.equal(packageResult.productionToMasterMap.standardRecords.total, PRODUCTION_BASELINES.standardRecords);
    assert.equal(packageResult.productionToMasterMap.standardRecords.mapped, PRODUCTION_BASELINES.standardRecords);
    for (const record of emojis) {
      const canonicalId = mapProductionStandard(record.hexcode);
      assert.ok(reader.canonicalRecords.has(canonicalId), `Missing canonical for ${record.hexcode}`);
    }
  });

  it("maps all 542 production extras to master identities", () => {
    assert.equal(packageResult.productionToMasterMap.extrasRecords.total, PRODUCTION_BASELINES.extrasRecords);
    assert.equal(packageResult.productionToMasterMap.extrasRecords.mapped, PRODUCTION_BASELINES.extrasRecords);
    for (const record of extras) {
      const canonicalId = mapProductionExtra(record.hexcode);
      assert.ok(reader.canonicalRecords.has(canonicalId), `Missing canonical for extra ${record.hexcode}`);
    }
  });

  it("maps 4486 / 4486 total production records", () => {
    assert.equal(packageResult.productionToMasterMap.totalMapped, PRODUCTION_BASELINES.totalSearchable);
    assert.equal(packageResult.productionToMasterMap.totalExpected, PRODUCTION_BASELINES.totalSearchable);
    assert.equal(packageResult.productionToMasterMap.status, "PASS");
  });

  it("returns all four artwork providers for fire without selecting a winner", () => {
    const artwork = getArtwork("unicode:1F525");
    assert.ok(artwork);
    assert.ok(artwork.providers.openmoji.length > 0);
    assert.ok(artwork.providers.noto.length > 0);
    assert.ok(artwork.providers.twemoji.length > 0);
    assert.ok(artwork.providers.fluent.length > 0);

    for (const provider of ["openmoji", "noto", "twemoji", "fluent"] as const) {
      for (const entry of artwork.providers[provider]) {
        assert.equal(entry.provider, provider);
        assert.ok(entry.license.length > 0);
        assert.ok(entry.licenseURL.length > 0);
        assert.ok(entry.checksum.length > 0);
      }
    }
  });

  it("exposes source metadata from Unicode, CLDR, OpenMoji, Emojibase, Emojilib, EmojiNet, and Fluent", () => {
    const metadata = getMetadata("unicode:1F525");
    assert.ok(metadata);
    const sources = new Set(metadata.sourceMetadata.map((entry) => entry.source));
    assert.ok(sources.has("unicode"));
    assert.ok(sources.has("cldr"));
    assert.ok(sources.has("openmoji"));
    assert.ok(sources.has("emojibase"));
    assert.ok(sources.has("emojilib"));
    assert.ok(sources.has("emojinet"));
    assert.ok(sources.has("fluent"));
  });

  it("marks hot as ambiguous and does not use it as a public semantic search term", () => {
    assert.equal(isAmbiguousMasterSearchTerm("hot"), true);
    const hotSearch = searchMaster("hot");
    assert.equal(hotSearch.ambiguous, true);
    const semanticTerm = reader.semanticSearchTerms.get("hot");
    assert.ok(semanticTerm);
    assert.equal(semanticTerm.ambiguous, true);
    assert.equal(semanticTerm.publicSearch, false);
    assert.ok(semanticTerm.canonicalIds.includes("unicode:1F525"));
    assert.ok(semanticTerm.canonicalIds.length >= 8);
  });

  it("searches master index for fire without connecting to production search", () => {
    const results = searchMaster("fire");
    assert.ok(results.results.some((result) => result.canonicalId === "unicode:1F525"));
  });

  it("returns frozen SEO record for fire", () => {
    const seo = getMasterSEO("unicode:1F525");
    assert.ok(seo);
    assert.equal(seo.canonicalName, "fire");
    assert.equal(seo.slug, "fire");
    assert.ok(seo.seoTitle.length > 0);
    assert.ok(seo.seoDescription.length > 0);
  });

  it("keeps returned master objects immutable", () => {
    const fire = getCanonicalEmoji("unicode:1F525");
    const artwork = getArtwork("unicode:1F525");
    const metadata = getMetadata("unicode:1F525");
    assert.ok(fire && artwork && metadata);

    assert.throws(() => {
      (fire as { canonicalId: string }).canonicalId = "mutated";
    });
    assert.throws(() => {
      (artwork.providers.openmoji as unknown[]).push({} as never);
    });
    assert.throws(() => {
      (metadata.sourceMetadata as unknown[]).push({} as never);
    });

    resetMasterReaderCache();
    const reloaded = getCanonicalEmoji("unicode:1F525");
    assert.equal(reloaded?.canonicalName?.value, "fire");
  });

  it("passes integration audit report", () => {
    assert.equal(packageResult.integrationAuditReport.status, "PASS");
    assert.equal(packageResult.integrationAuditReport.adapters.canonical, "PASS");
    assert.equal(packageResult.integrationAuditReport.adapters.artwork, "PASS");
    assert.equal(packageResult.integrationAuditReport.adapters.metadata, "PASS");
    assert.equal(packageResult.integrationAuditReport.adapters.search, "PASS");
    assert.equal(packageResult.integrationAuditReport.adapters.seo, "PASS");
    assert.equal(packageResult.integrationAuditReport.productionSafety.status, "PASS");
  });

  it("keeps production data unchanged", () => {
    assert.equal(emojis.length, PRODUCTION_BASELINES.standardRecords);
    assert.equal(extras.length, PRODUCTION_BASELINES.extrasRecords);
    assert.equal(findProductionEmoji("1F525").hexcode, "1F525");
    assert.equal(packageResult.integrationAuditReport.productionSafety.emojisJsonCount, 3944);
    assert.equal(packageResult.integrationAuditReport.productionSafety.openmojiExtrasCount, 542);
  });

  it("writes integration output files with stable production mapping", () => {
    const map = readJson<{ totalMapped: number; status: string }>(
      join(integrationDir, "production-to-master-map.json"),
    );
    const audit = readJson<{ status: string }>(join(integrationDir, "integration-audit-report.json"));
    const manifest = readJson<{ releaseId: string; readOnly: boolean }>(
      join(integrationDir, "integration-manifest.json"),
    );

    assert.equal(map.totalMapped, 4486);
    assert.equal(map.status, "PASS");
    assert.equal(audit.status, "PASS");
    assert.equal(manifest.releaseId, "master-8.10-20260809");
    assert.equal(manifest.readOnly, true);
  });

  it("verifies production json checksums remain stable", () => {
    const emojisChecksum = sha256File(join(rootDir, "src", "data", "emojis.json"));
    const extrasChecksum = sha256File(join(rootDir, "src", "data", "openmoji-extras.json"));
    assert.equal(emojisChecksum.length, 64);
    assert.equal(extrasChecksum.length, 64);
    assert.notEqual(emojisChecksum, extrasChecksum);
  });
});
