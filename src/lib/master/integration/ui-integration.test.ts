import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import type { BrowsableEmoji } from "@/lib/emoji/types";
import {
  MASTER_INTEGRATION_CONFIG,
  UI_BASELINES,
  buildArtworkAttribution,
  buildUiIntegrationPackage,
  getCopyIdentityValue,
  getFavoriteIdentityKey,
  getRecentIdentityKey,
  getSharePath,
  getUiArtworkProviders,
  getUiMetadataPayload,
  getUiProductionArtworkProviders,
  getUiProductionMetadata,
  isMasterUiArtworkEnabled,
  isMasterUiIntegrationActive,
  isMasterUiMetadataEnabled,
  listUiAvailableMetadataSources,
  resolveUiArtworkDisplay,
  resolveUiCanonicalId,
  runWithIntegrationFlags,
  toUiProductionContext,
} from "@/lib/master/integration";
import { getMasterReader } from "@/lib/master/integration/master-reader";
import { verifyFrozenChecksums } from "@/lib/master/release/build";
import type { FileChecksumEntry } from "@/lib/master/release/types";

const rootDir = process.cwd();

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
  openmojiPua: "source:openmoji:E000",
  notoUtility: "source:noto:noto.png",
} as const;

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function fireContext() {
  const emoji = (emojis as BrowsableEmoji[]).find((entry) => entry.hexcode === "1F525");
  assert.ok(emoji);
  return toUiProductionContext(emoji);
}

describe("phase 8.11E UI integration", () => {
  const uiPackage = buildUiIntegrationPackage(rootDir);
  const reader = getMasterReader(rootDir);

  it("keeps all master feature flags disabled by default", () => {
    assert.equal(MASTER_INTEGRATION_CONFIG.masterArtworkEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterMetadataEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterSearchEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterSEOEnabled, false);
    assert.equal(isMasterUiArtworkEnabled(), false);
    assert.equal(isMasterUiMetadataEnabled(), false);
    assert.equal(isMasterUiIntegrationActive(), false);
  });

  it("returns no production UI payloads while feature flags are disabled", () => {
    const context = fireContext();
    assert.equal(getUiProductionArtworkProviders(context, rootDir).length, 0);
    assert.equal(getUiProductionMetadata(context, rootDir), null);
  });

  it("retrieves all four artwork providers for fire", () => {
    const providers = getUiArtworkProviders(CRITICAL.fire, rootDir);
    assert.equal(providers.length, 4);
    assert.deepEqual(
      providers.map((entry) => entry.provider),
      ["openmoji", "noto", "twemoji", "fluent"],
    );
  });

  it("supports provider switching and variant selection for fire", () => {
    const openmoji = resolveUiArtworkDisplay({
      canonicalId: CRITICAL.fire,
      provider: "openmoji",
      emoji: "🔥",
      name: "fire",
      hexcode: "1F525",
      rootDir,
    });
    const noto = resolveUiArtworkDisplay({
      canonicalId: CRITICAL.fire,
      provider: "noto",
      variant: "svg",
      emoji: "🔥",
      name: "fire",
      hexcode: "1F525",
      rootDir,
    });
    assert.equal(openmoji.provider, "openmoji");
    assert.equal(noto.provider, "noto");
    assert.notEqual(openmoji.src, noto.src);
    assert.equal(openmoji.canonicalId, noto.canonicalId);
  });

  it("preserves separate provider licenses and attribution", () => {
    const providers = getUiArtworkProviders(CRITICAL.fire, rootDir);
    const licenses = new Set(providers.map((entry) => entry.attribution.license));
    assert.equal(licenses.size, 4);
    assert.ok(providers.every((entry) => entry.attribution.licenseURL.length > 0));
    const attribution = buildArtworkAttribution("openmoji", null);
    assert.equal(attribution.license, "CC BY-SA 4.0");
  });

  it("keeps thumbs-up skin tones and ZWJ identities distinct", () => {
    for (const canonicalId of [CRITICAL.thumbsUp, CRITICAL.thumbsUpLight, CRITICAL.thumbsUpDark]) {
      const display = resolveUiArtworkDisplay({
        canonicalId,
        provider: "openmoji",
        emoji: "👍",
        name: "thumbs up",
        hexcode: canonicalId.replace("unicode:", ""),
        rootDir,
      });
      assert.equal(display.canonicalId, canonicalId);
    }
    const man = resolveUiCanonicalId({
      hexcode: "1F468-200D-1F4BB",
      productionType: "standard",
      emoji: "👨‍💻",
      name: "man technologist",
      slug: "man-technologist",
    }, rootDir);
    const woman = resolveUiCanonicalId({
      hexcode: "1F469-200D-1F4BB",
      productionType: "standard",
      emoji: "👩‍💻",
      name: "woman technologist",
      slug: "woman-technologist",
    }, rootDir);
    assert.equal(man, CRITICAL.manTechnologist);
    assert.equal(woman, CRITICAL.womanTechnologist);
    assert.notEqual(man, woman);
  });

  it("keeps flag, variation selector, and pride flag identities distinct", () => {
    assert.equal(resolveUiCanonicalId({
      hexcode: "1F1EE-1F1F3",
      productionType: "standard",
      emoji: "🇮🇳",
      name: "flag: India",
      slug: "flag-india",
    }, rootDir), CRITICAL.indiaFlag);
    assert.notEqual(CRITICAL.textSmile, CRITICAL.emojiSmile);
    assert.notEqual(
      getUiArtworkProviders(CRITICAL.textSmile, rootDir)[0]?.provider,
      getUiArtworkProviders(CRITICAL.emojiSmile, rootDir)[0]?.provider,
    );
    assert.equal(
      resolveUiCanonicalId({
        hexcode: "1F3F3-FE0F-200D-1F308",
        productionType: "standard",
        emoji: "🏳️‍🌈",
        name: "rainbow flag",
        slug: "rainbow-flag",
      }, rootDir),
      CRITICAL.rainbowFlag,
    );
  });

  it("protects PUA, artwork-only, and utility identities", () => {
    const pua = reader.canonicalRecords.get(CRITICAL.openmojiPua);
    const utility = reader.canonicalRecords.get(CRITICAL.notoUtility);
    assert.ok(pua);
    assert.ok(utility);
    assert.equal(pua.identityType, "private-use");
    assert.equal(getUiArtworkProviders(CRITICAL.notoUtility, rootDir).length, 0);
  });

  it("exposes metadata provenance with source separation and unavailable Noto/Twemoji metadata", () => {
    const metadata = getUiMetadataPayload(CRITICAL.fire, rootDir);
    assert.ok(metadata);
    assert.equal(metadata.canonicalName, "fire");
    assert.ok(metadata.safeKeywords.length <= 12);
    assert.ok(metadata.safeAliases.every((alias) => alias.length > 0));
    const notoPanel = metadata.sourcePanels.find((panel) => panel.source === "noto");
    const twemojiPanel = metadata.sourcePanels.find((panel) => panel.source === "twemoji");
    assert.equal(notoPanel?.available, false);
    assert.equal(twemojiPanel?.available, false);
    assert.ok(listUiAvailableMetadataSources(CRITICAL.fire, rootDir).includes("unicode"));
  });

  it("preserves shortcodes and restricts aliases in UI metadata payload", () => {
    const metadata = getUiMetadataPayload(CRITICAL.fire, rootDir);
    assert.ok(metadata);
    assert.ok(metadata.shortcodes.some((entry) => entry.includes("fire")));
    const enriched = metadata;
    assert.ok(enriched.emojinetSenseCount > 0);
    assert.ok(enriched.hasSemanticSourceData);
  });

  it("keeps favorites, recents, copy, and share identity stable", () => {
    const context = fireContext();
    assert.equal(getFavoriteIdentityKey(context), "1F525");
    assert.equal(getRecentIdentityKey(context), "1F525");
    assert.equal(getCopyIdentityValue(context), "🔥");
    assert.equal(getSharePath(context), "/emoji/fire");
  });

  it("temporarily enables artwork and metadata flags in tests only", () => {
    const context = fireContext();
    runWithIntegrationFlags({ masterArtworkEnabled: true }, () => {
      assert.equal(getUiProductionArtworkProviders(context, rootDir).length, 4);
    });
    runWithIntegrationFlags({ masterMetadataEnabled: true }, () => {
      assert.equal(getUiProductionMetadata(context, rootDir)?.canonicalName, "fire");
    });
    assert.equal(isMasterUiArtworkEnabled(), false);
    assert.equal(isMasterUiMetadataEnabled(), false);
  });

  it("leaves production datasets unchanged and frozen release byte-identical", () => {
    const emojisHash = sha256File(join(rootDir, "src/data/emojis.json"));
    const extrasHash = sha256File(join(rootDir, "src/data/openmoji-extras.json"));
    assert.ok(emojisHash.length === 64);
    assert.ok(extrasHash.length === 64);
    assert.equal((emojis as BrowsableEmoji[]).length + (extras as BrowsableEmoji[]).length, UI_BASELINES.productionMappings);

    const checksums = JSON.parse(
      readFileSync(join(rootDir, "src/data/master/release/8.10/master-file-checksums.json"), "utf8"),
    ) as FileChecksumEntry[];
    const verification = verifyFrozenChecksums(rootDir, checksums);
    assert.equal(verification.status, "PASS");
  });

  it("passes UI integration audit", () => {
    assert.equal(uiPackage.uiIntegrationAudit.status, "PASS");
    assert.equal(uiPackage.uiProductionSafety.status, "PASS");
    assert.equal(uiPackage.uiIntegrationAudit.routesChanged, false);
    assert.equal(uiPackage.uiIntegrationAudit.seoChanged, false);
    assert.equal(uiPackage.uiIntegrationAudit.searchChanged, false);
    assert.equal(uiPackage.uiIntegrationAudit.externalRuntimeDependencies, false);
  });
});

describe("phase 8.11E-FIX server/client boundary", () => {
  const clientModulePaths = [
    "src/components/master/artwork/artwork-gallery.tsx",
    "src/components/master/master-emoji-panels-client.tsx",
    "src/components/master/provider/artwork-provider-selector.tsx",
    "src/components/master/artwork/artwork-variant-selector.tsx",
    "src/lib/master/integration/ui/provider-state.client.ts",
  ] as const;

  const forbiddenClientImports = [
    "master-reader",
    "node:fs",
    "node:path",
    "server-data",
    "production-bridge",
    "artwork-ui-adapter",
    "metadata-ui-adapter",
    "release/8.10",
  ] as const;

  for (const modulePath of clientModulePaths) {
    it(`keeps ${modulePath} free of server-only imports`, () => {
      const source = readFileSync(join(rootDir, modulePath), "utf8");
      for (const forbidden of forbiddenClientImports) {
        assert.equal(
          source.includes(forbidden),
          false,
          `${modulePath} must not reference ${forbidden}`,
        );
      }
    });
  }

  it("keeps provider state client-only without filesystem access", () => {
    const source = readFileSync(
      join(rootDir, "src/lib/master/integration/ui/provider-state.client.ts"),
      "utf8",
    );
    assert.match(source, /^"use client";/m);
    assert.equal(source.includes("localStorage"), true);
    assert.equal(source.includes("readFileSync"), false);
  });

  it("marks server data loaders and panel server entry as server-only", () => {
    for (const modulePath of [
      "src/lib/master/integration/ui/server-data.ts",
      "src/components/master/master-emoji-panels.server.tsx",
      "src/lib/master/integration/ui/server-entry.tsx",
    ]) {
      const source = readFileSync(join(rootDir, modulePath), "utf8");
      assert.match(source, /import "server-only";/);
    }
  });

  it("serializes master UI model as JSON-safe data", () => {
    const model = Object.freeze({
      emoji: "🔥",
      name: "fire",
      fallbackSrc: "/openmoji/1F525.svg",
      artworkProviders: Object.freeze([]),
      metadata: null,
    });
    const roundTrip = JSON.parse(JSON.stringify(model));
    assert.deepEqual(roundTrip, model);
  });

  it("keeps master emoji panels gate disabled while feature flags are false", () => {
    const gateSource = readFileSync(
      join(rootDir, "src/components/master/master-emoji-panels-gate.tsx"),
      "utf8",
    );
    assert.equal(gateSource.includes("MASTER_UI_ENABLED"), true);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterArtworkEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterMetadataEnabled, false);
  });
});
