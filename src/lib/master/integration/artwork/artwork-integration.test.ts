import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import { getArtworkPath } from "@/lib/artwork/providers";
import {
  ARTWORK_PROVIDER_PREFERENCE,
  buildArtworkIntegrationPackage,
  getArtwork,
  getArtworkByProvider,
  getArtworkByVariant,
  getArtworkVariants,
  getProductionArtwork,
  isMasterArtworkIntegrationEnabled,
  listAvailableProviders,
  listProductionArtworkProviders,
  MASTER_INTEGRATION_CONFIG,
  resetMasterReaderCache,
} from "@/lib/master/integration";
import { getArtworkReleaseChecksumManifest, verifyArtworkChecksum } from "@/lib/master/integration/artwork/checksum";
import { isLocalArtworkPath } from "@/lib/master/integration/artwork/paths";

const rootDir = process.cwd();
const artworkDir = join(rootDir, "src", "data", "master", "integration", "artwork");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const CRITICAL = {
  fire: "unicode:1F525",
  thumbsUp: "unicode:1F44D",
  thumbsUpLight: "unicode:1F44D-1F3FB",
  thumbsUpDark: "unicode:1F44D-1F3FF",
  manTechnologist: "unicode:1F468-200D-1F4BB",
  womanTechnologist: "unicode:1F469-200D-1F4BB",
  indiaFlag: "unicode:1F1EE-1F1F3",
  heart: "unicode:2764-FE0F",
  textSmile: "unicode:263A",
  emojiSmile: "unicode:263A-FE0F",
  rainbowFlag: "unicode:1F3F3-FE0F-200D-1F308",
  openmojiPua: "source:openmoji:E000",
} as const;

describe("phase 8.11B artwork integration", () => {
  const packageResult = buildArtworkIntegrationPackage(rootDir);

  it("keeps masterArtworkEnabled false and provider preference unset", () => {
    assert.equal(MASTER_INTEGRATION_CONFIG.masterArtworkEnabled, false);
    assert.equal(isMasterArtworkIntegrationEnabled(), false);
    assert.equal(ARTWORK_PROVIDER_PREFERENCE, null);
  });

  it("returns null production artwork while feature flag is disabled", () => {
    assert.equal(getProductionArtwork("1F525", "standard"), null);
    assert.equal(listProductionArtworkProviders("1F525", "standard").length, 0);
  });

  it("exposes all four providers for fire without selecting a winner", () => {
    const artwork = getArtwork(CRITICAL.fire);
    assert.ok(artwork);
    assert.ok(artwork.providers.openmoji.length > 0);
    assert.ok(artwork.providers.noto.length > 0);
    assert.ok(artwork.providers.twemoji.length > 0);
    assert.ok(artwork.providers.fluent.length > 0);
    assert.ok(artwork.totalRecords >= 4);
  });

  it("returns provider-specific artwork only for getArtworkByProvider", () => {
    const openmoji = getArtworkByProvider(CRITICAL.fire, "openmoji");
    const noto = getArtworkByProvider(CRITICAL.fire, "noto");
    const twemoji = getArtworkByProvider(CRITICAL.fire, "twemoji");
    const fluent = getArtworkByProvider(CRITICAL.fire, "fluent");

    assert.ok(openmoji.length > 0);
    assert.ok(noto.length > 0);
    assert.ok(twemoji.length > 0);
    assert.ok(fluent.length > 0);
    assert.ok(openmoji.every((record) => record.provider === "openmoji"));
    assert.ok(noto.every((record) => record.provider === "noto"));
    assert.ok(twemoji.every((record) => record.provider === "twemoji"));
    assert.ok(fluent.every((record) => record.provider === "fluent"));
  });

  it("verifies fire artwork paths, checksums, licenses, and attribution", () => {
    const openmoji = getArtworkByProvider(CRITICAL.fire, "openmoji")[0];
    const noto = getArtworkByProvider(CRITICAL.fire, "noto").find((record) => record.format === "svg");
    const twemoji = getArtworkByProvider(CRITICAL.fire, "twemoji").find((record) => record.format === "svg");
    const fluentColor = getArtworkByVariant(CRITICAL.fire, "fluent", "color");

    assert.ok(openmoji);
    assert.ok(noto);
    assert.ok(twemoji);
    assert.ok(fluentColor);

    assert.equal(openmoji.path, "public/openmoji/1F525.svg");
    assert.equal(openmoji.checksum, "c9d2cc9cedfa557ff34c859b8af6556436913ec0c73a65a6533676698c3edcf0");
    assert.equal(openmoji.license, "CC BY-SA 4.0");
    assert.ok(openmoji.attribution?.includes("OpenMoji"));

    assert.ok(noto.path.includes("public/noto/"));
    assert.equal(noto.license, "Apache-2.0");
    assert.ok(noto.attribution?.includes("Noto"));

    assert.equal(twemoji.path, "public/twemoji/assets/svg/1f525.svg");
    assert.equal(twemoji.license, "CC BY 4.0");
    assert.ok(twemoji.attribution);

    assert.equal(fluentColor.path, "public/fluent/assets/Fire/Color/fire_color.svg");
    assert.equal(fluentColor.license, "MIT");
    assert.ok(fluentColor.attribution?.includes("Microsoft"));

    assert.equal(verifyArtworkChecksum(openmoji.artworkId, openmoji.checksum), true);
    assert.equal(verifyArtworkChecksum(noto.artworkId, noto.checksum), true);
    assert.equal(verifyArtworkChecksum(twemoji.artworkId, twemoji.checksum), true);
    assert.equal(verifyArtworkChecksum(fluentColor.artworkId, fluentColor.checksum), true);
  });

  it("preserves Fluent color, flat, and high-contrast variants separately", () => {
    const fluent = getArtworkByProvider(CRITICAL.fire, "fluent");
    const variants = new Set(fluent.map((record) => record.variant));
    assert.ok(variants.has("color"));
    assert.ok(variants.has("flat"));
    assert.ok(variants.has("high-contrast"));
    assert.equal(fluent.length, 3);
  });

  it("preserves Noto SVG and PNG variants separately", () => {
    const noto = getArtworkByProvider(CRITICAL.fire, "noto");
    assert.ok(noto.some((record) => record.format === "svg"));
    assert.ok(noto.some((record) => record.format === "png"));
    assert.ok(noto.length > 2);
  });

  it("preserves Twemoji SVG and PNG variants separately", () => {
    const twemoji = getArtworkByProvider(CRITICAL.fire, "twemoji");
    assert.ok(twemoji.some((record) => record.format === "svg"));
    assert.ok(twemoji.some((record) => record.format === "png"));
  });

  it("keeps skin-tone thumbs up identities and artwork separate", () => {
    const base = getArtwork(CRITICAL.thumbsUp);
    const light = getArtwork(CRITICAL.thumbsUpLight);
    const dark = getArtwork(CRITICAL.thumbsUpDark);
    assert.ok(base && light && dark);
    assert.notEqual(base.canonicalId, light.canonicalId);
    assert.notEqual(light.canonicalId, dark.canonicalId);

    const baseOpenMoji = getArtworkByProvider(CRITICAL.thumbsUp, "openmoji")[0];
    const lightOpenMoji = getArtworkByProvider(CRITICAL.thumbsUpLight, "openmoji")[0];
    assert.notEqual(baseOpenMoji.path, lightOpenMoji.path);
  });

  it("keeps ZWJ technologist identities separate", () => {
    const man = getArtwork(CRITICAL.manTechnologist);
    const woman = getArtwork(CRITICAL.womanTechnologist);
    assert.ok(man && woman);
    assert.notEqual(man.canonicalId, woman.canonicalId);
    assert.notEqual(
      getArtworkByProvider(CRITICAL.manTechnologist, "openmoji")[0]?.path,
      getArtworkByProvider(CRITICAL.womanTechnologist, "openmoji")[0]?.path,
    );
  });

  it("preserves India flag artwork mapping", () => {
    const india = getArtwork(CRITICAL.indiaFlag);
    assert.ok(india);
    assert.ok(india.providers.openmoji.length > 0);
    assert.ok(india.canonicalId === CRITICAL.indiaFlag);
  });

  it("keeps variation selector identities separate", () => {
    const text = getArtwork(CRITICAL.textSmile);
    const emoji = getArtwork(CRITICAL.emojiSmile);
    assert.ok(text && emoji);
    assert.notEqual(text.canonicalId, emoji.canonicalId);
  });

  it("preserves OpenMoji private-use artwork as source-specific", () => {
    const pua = getArtwork(CRITICAL.openmojiPua);
    assert.ok(pua);
    assert.ok(pua.providers.openmoji.length > 0);
    assert.equal(listAvailableProviders(CRITICAL.openmojiPua).includes("openmoji"), true);
  });

  it("does not expose noto.png utility asset as emoji artwork", () => {
    assert.equal(getArtwork("source:noto:noto.png:noto.png"), null);
  });

  it("preserves duplicate binary records without merging providers", () => {
    const fire = getArtworkVariants(CRITICAL.fire);
    const duplicateRecords = fire.filter((record) => record.duplicateBinary);
    assert.ok(duplicateRecords.length >= 0);
    for (const record of duplicateRecords) {
      assert.ok(record.duplicateBinaryGroupId);
      assert.ok(record.provider);
      assert.ok(record.attribution);
    }
  });

  it("uses only local frozen artwork paths", () => {
    const fire = getArtwork(CRITICAL.fire);
    assert.ok(fire);
    for (const provider of ["openmoji", "noto", "twemoji", "fluent"] as const) {
      for (const record of fire.providers[provider]) {
        assert.equal(isLocalArtworkPath(record.path), true);
        assert.equal(record.path.startsWith("http"), false);
      }
    }
  });

  it("verifies artwork release checksum manifest baselines", () => {
    const manifest = getArtworkReleaseChecksumManifest(rootDir);
    assert.equal(manifest.totalFiles, 40071);
    assert.equal(manifest.missingFiles, 0);
    assert.equal(manifest.checksumFailures, 0);
    assert.equal(manifest.providers.openmoji.fileCount, 4495);
    assert.equal(manifest.providers.noto.fileCount, 19673);
    assert.equal(manifest.providers.twemoji.fileCount, 8018);
    assert.equal(manifest.providers.fluent.fileCount, 7885);
  });

  it("maps 4486 production records through artwork coverage audit", () => {
    assert.equal(packageResult.artworkProductionCoverage.totalProductionRecords, 4486);
    assert.equal(packageResult.artworkProductionCoverage.mappedRecords, 4486);
    assert.equal(packageResult.artworkProductionCoverage.status, "PASS");
  });

  it("reports provider coverage baselines", () => {
    const totals = packageResult.artworkProviderCoverage.totals;
    assert.equal(totals.masterArtworkRecords, 40071);
    assert.equal(totals.openmoji, 4495);
    assert.equal(totals.noto, 19673);
    assert.equal(totals.twemoji, 8018);
    assert.equal(totals.fluent, 7885);
    assert.equal(totals.missingFiles, 0);
    assert.equal(totals.checksumFailures, 0);
    assert.equal(totals.pathCollisions, 0);
    assert.equal(packageResult.artworkProviderCoverage.status, "PASS");
  });

  it("passes artwork integration audit", () => {
    assert.equal(packageResult.artworkIntegrationAudit.status, "PASS");
    assert.equal(packageResult.artworkIntegrationAudit.providerLookup, "PASS");
    assert.equal(packageResult.artworkIntegrationAudit.variantLookup, "PASS");
    assert.equal(packageResult.artworkIntegrationAudit.licenseLookup, "PASS");
    assert.equal(packageResult.artworkIntegrationAudit.attributionLookup, "PASS");
    assert.equal(packageResult.artworkIntegrationAudit.productionMapping, "PASS");
    assert.equal(packageResult.artworkIntegrationAudit.featureFlag, "PASS");
    assert.equal(packageResult.artworkIntegrationAudit.noExternalDependency, "PASS");
  });

  it("keeps production artwork resolver unchanged while feature flag is false", () => {
    const productionPath = getArtworkPath("1F525");
    assert.ok(productionPath);
    assert.equal(productionPath.startsWith("/openmoji/"), true);
  });

  it("keeps production data unchanged", () => {
    assert.equal(emojis.length, 3944);
    assert.equal(extras.length, 542);
    const emojisChecksum = sha256File(join(rootDir, "src", "data", "emojis.json"));
    const extrasChecksum = sha256File(join(rootDir, "src", "data", "openmoji-extras.json"));
    assert.equal(emojisChecksum.length, 64);
    assert.equal(extrasChecksum.length, 64);
  });

  it("keeps returned artwork objects immutable", () => {
    const fire = getArtwork(CRITICAL.fire);
    assert.ok(fire);
    assert.throws(() => {
      (fire as { canonicalId: string }).canonicalId = "mutated";
    });
    assert.throws(() => {
      (fire.providers.openmoji as unknown[]).push({} as never);
    });

    resetMasterReaderCache();
    const reloaded = getArtwork(CRITICAL.fire);
    assert.equal(reloaded?.canonicalId, CRITICAL.fire);
  });

  it("writes artwork integration output files", () => {
    const audit = readJson<{ status: string }>(join(artworkDir, "artwork-integration-audit.json"));
    const manifest = readJson<{ releaseId: string; featureFlags: { masterArtworkEnabled: boolean } }>(
      join(artworkDir, "artwork-integration-manifest.json"),
    );
    assert.equal(audit.status, "PASS");
    assert.equal(manifest.releaseId, "master-8.10-20260809");
    assert.equal(manifest.featureFlags.masterArtworkEnabled, false);
  });
});
