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
import { getEnrichedMetadata } from "./metadata/enrichment";
import {
  MASTER_INTEGRATION_CONFIG,
  PRODUCTION_BASELINES,
  PROVIDER_LICENSE_DEFAULTS,
  getCopyIdentityValue,
  getFavoriteIdentityKey,
  getRecentIdentityKey,
  getSharePath,
  getUiArtworkProviders,
  getUiMetadataPayload,
  getUiProductionArtworkProviders,
  getUiProductionMetadata,
  isAmbiguousMasterSearchTerm,
  isMasterSearchIntegrationEnabled,
  isMasterSeoIntegrationEnabled,
  resolveUiArtworkDisplay,
  resolveUiCanonicalId,
  runWithIntegrationFlags,
  searchProductionEmojis,
  toUiProductionContext,
} from "@/lib/master/integration";
import { buildActivationPackage } from "@/lib/master/integration/activation/build";
import { ACTIVATION_PHASE } from "@/lib/master/integration/config";
import { verifyFrozenChecksums } from "@/lib/master/release/build";
import type { FileChecksumEntry } from "@/lib/master/release/types";

const rootDir = process.cwd();
const searchableEmojis = [
  ...(emojis as BrowsableEmoji[]),
  ...(extras as BrowsableEmoji[]),
];

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

function getEmoji(hexcode: string): BrowsableEmoji {
  const emoji =
    (emojis as BrowsableEmoji[]).find((entry) => entry.hexcode === hexcode) ??
    (extras as BrowsableEmoji[]).find((entry) => entry.hexcode === hexcode);
  assert.ok(emoji, `Missing emoji ${hexcode}`);
  return emoji;
}

function fireContext() {
  return toUiProductionContext(getEmoji("1F525"));
}

describe("phase 8.11F controlled production activation", () => {
  const activation = buildActivationPackage(rootDir);

  it("keeps all feature flags disabled by default after controlled QA", () => {
    assert.equal(MASTER_INTEGRATION_CONFIG.masterArtworkEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterMetadataEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterSearchEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterSEOEnabled, false);
    assert.equal(isMasterSearchIntegrationEnabled(), false);
    assert.equal(isMasterSeoIntegrationEnabled(), false);
  });

  describe("step 1 artwork activation QA", () => {
    it("activates artwork UI for fire with all four providers", () => {
      const context = fireContext();
      runWithIntegrationFlags({ masterArtworkEnabled: true }, () => {
        const providers = getUiProductionArtworkProviders(context, rootDir);
        assert.equal(providers.length, 4);
        assert.deepEqual(
          providers.map((entry) => entry.provider),
          ["openmoji", "noto", "twemoji", "fluent"],
        );

        const modelProviders = getUiProductionArtworkProviders(context, rootDir);
        assert.equal(modelProviders.length, 4);
      });
    });

    it("switches providers without changing identity, URL, copy, favorites, or recents", () => {
      const context = fireContext();
      runWithIntegrationFlags({ masterArtworkEnabled: true }, () => {
        for (const provider of ["openmoji", "noto", "twemoji", "fluent"] as const) {
          const display = resolveUiArtworkDisplay({
            canonicalId: CRITICAL.fire,
            provider,
            emoji: "🔥",
            name: "fire",
            hexcode: "1F525",
            rootDir,
          });
          assert.equal(display.canonicalId, CRITICAL.fire);
          assert.equal(display.fallbackEmoji, "🔥");
          assert.notEqual(display.src?.includes("node_modules"), true);
          assert.equal(display.src?.startsWith("http"), false);
        }

        assert.equal(getFavoriteIdentityKey(context), "1F525");
        assert.equal(getRecentIdentityKey(context), "1F525");
        assert.equal(getCopyIdentityValue(context), "🔥");
        assert.equal(getSharePath(context), "/emoji/fire");
      });
    });

    it("exposes supported variants for noto, twemoji, and fluent", () => {
      const providers = getUiArtworkProviders(CRITICAL.fire, rootDir);
      const noto = providers.find((entry) => entry.provider === "noto");
      const twemoji = providers.find((entry) => entry.provider === "twemoji");
      const fluent = providers.find((entry) => entry.provider === "fluent");

      assert.ok(noto?.variants.some((variant) => variant.format === "svg"));
      assert.ok(noto?.variants.some((variant) => variant.format === "png"));
      assert.ok(twemoji?.variants.some((variant) => variant.format === "svg"));
      assert.ok(twemoji?.variants.some((variant) => variant.format === "png"));
      assert.ok((fluent?.variants.length ?? 0) >= 2);
    });

    it("preserves provider-specific licenses and attribution", () => {
      const providers = getUiArtworkProviders(CRITICAL.fire, rootDir);
      for (const entry of providers) {
        assert.equal(entry.attribution.license, PROVIDER_LICENSE_DEFAULTS[entry.provider].license);
        assert.ok(entry.attribution.licenseURL.length > 0);
        assert.equal(entry.attribution.providerLabel.length > 0, true);
      }
    });

    it("falls back safely for missing variants and unknown canonical IDs", () => {
      const missingVariant = resolveUiArtworkDisplay({
        canonicalId: CRITICAL.fire,
        provider: "openmoji",
        variant: "does-not-exist",
        emoji: "🔥",
        name: "fire",
        hexcode: "1F525",
        rootDir,
      });
      assert.ok(missingVariant.state === "loaded" || missingVariant.state === "fallback");

      const unknown = resolveUiArtworkDisplay({
        canonicalId: "unicode:DEADBEEF",
        provider: "openmoji",
        emoji: "?",
        name: "unknown",
        hexcode: "DEADBEEF",
        rootDir,
      });
      assert.ok(unknown.state === "fallback" || unknown.state === "error");
      assert.equal(Boolean(unknown.src?.includes("src/data")), false);
    });

    it("keeps critical identities distinct under artwork activation", () => {
      assert.notEqual(CRITICAL.thumbsUp, CRITICAL.thumbsUpLight);
      assert.notEqual(CRITICAL.thumbsUpLight, CRITICAL.thumbsUpDark);
      assert.notEqual(CRITICAL.manTechnologist, CRITICAL.womanTechnologist);
      assert.notEqual(CRITICAL.textSmile, CRITICAL.emojiSmile);
      assert.equal(
        resolveUiCanonicalId({
          hexcode: "1F1EE-1F1F3",
          productionType: "standard",
          emoji: "🇮🇳",
          name: "flag: India",
          slug: "flag-india",
        }, rootDir),
        CRITICAL.indiaFlag,
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

    it("blocks utility and artwork-only records from emoji artwork UI", () => {
      assert.equal(getUiArtworkProviders(CRITICAL.notoUtility, rootDir).length, 0);
    });

    it("loads only canonical-scoped artwork data for one emoji", () => {
      runWithIntegrationFlags({ masterArtworkEnabled: true }, () => {
        const providers = getUiProductionArtworkProviders(fireContext(), rootDir);
        assert.ok(providers.length < 100);
        const totalVariants = providers.reduce(
          (sum, provider) => sum + provider.variants.length,
          0,
        );
        assert.ok(totalVariants < 50);
      });
    });
  });

  describe("step 2 metadata activation QA", () => {
    it("activates metadata for fire with source separation", () => {
      const context = fireContext();
      runWithIntegrationFlags(
        { masterArtworkEnabled: true, masterMetadataEnabled: true },
        () => {
          const metadata = getUiProductionMetadata(context, rootDir);
          assert.ok(metadata);
          assert.equal(metadata.canonicalName, "fire");
          assert.equal(metadata.canonicalId, CRITICAL.fire);

          const noto = metadata.sourcePanels.find((panel) => panel.source === "noto");
          const twemoji = metadata.sourcePanels.find((panel) => panel.source === "twemoji");
          const unicode = metadata.sourcePanels.find((panel) => panel.source === "unicode");
          const emojinet = metadata.sourcePanels.find((panel) => panel.source === "emojinet");
          const enriched = getEnrichedMetadata(CRITICAL.fire, rootDir);
          assert.ok(enriched);

          assert.equal(noto?.available, false);
          assert.equal(twemoji?.available, false);
          assert.equal(unicode?.available, true);
          assert.equal(emojinet?.available, undefined);
          assert.ok(metadata.shortcodes.some((entry) => entry.includes("fire")));
          assert.ok(metadata.safeKeywords.length <= 12);
          assert.ok(metadata.safeAliases.length <= 8);
          assert.ok(enriched.emojinetSenseCount > 0);
        },
      );
    });

    it("does not invent noto or twemoji metadata", () => {
      const metadata = getUiMetadataPayload(CRITICAL.fire, rootDir);
      assert.ok(metadata);
      const noto = metadata.sourcePanels.find((panel) => panel.source === "noto");
      const twemoji = metadata.sourcePanels.find((panel) => panel.source === "twemoji");
      assert.equal(noto?.available, false);
      assert.equal(twemoji?.available, false);
      assert.equal(noto?.name, null);
      assert.equal(twemoji?.name, null);
    });

    it("marks hot as ambiguous without forcing fire-only meaning", () => {
      assert.equal(isAmbiguousMasterSearchTerm("hot", rootDir), true);
      const hotResults = searchEmojis(searchableEmojis, "hot", 20);
      assert.ok(hotResults.length > 1);
    });
  });

  describe("production safety and rollback", () => {
    it("keeps search and SEO unchanged while master flags are disabled", () => {
      const production = searchEmojis(searchableEmojis, "fire", 5);
      const bridged = searchProductionEmojis(searchableEmojis, "fire", 5);
      assert.deepEqual(
        production.map((entry) => entry.emoji.hexcode),
        bridged.map((entry) => entry.emoji.hexcode),
      );

      const fire = getEmoji("1F525");
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

    it("preserves frozen release and production data", () => {
      const checksums = JSON.parse(
        readFileSync(join(rootDir, "src/data/master/release/8.10/master-file-checksums.json"), "utf8"),
      ) as FileChecksumEntry[];
      assert.equal(verifyFrozenChecksums(rootDir, checksums).status, "PASS");
      assert.equal((emojis as BrowsableEmoji[]).length, PRODUCTION_BASELINES.standardRecords);
      assert.equal((extras as BrowsableEmoji[]).length, PRODUCTION_BASELINES.extrasRecords);
    });

    it("keeps client modules free of filesystem imports", () => {
      const clientPaths = [
        "src/components/master/artwork/artwork-gallery.tsx",
        "src/components/master/master-emoji-panels-client.tsx",
        "src/lib/master/integration/ui/provider-state.client.ts",
      ];
      for (const path of clientPaths) {
        const source = readFileSync(join(rootDir, path), "utf8");
        assert.equal(source.includes("node:fs"), false);
        assert.equal(source.includes("node:path"), false);
        assert.equal(source.includes("master-reader"), false);
      }
    });
  });

  it("passes activation audit package", () => {
    assert.equal(activation.activationAudit.phase, ACTIVATION_PHASE);
    assert.equal(activation.activationAudit.status, "PASS");
    assert.equal(activation.artworkActivationAudit.status, "PASS");
    assert.equal(activation.metadataActivationAudit.status, "PASS");
    assert.equal(activation.providerQaReport.status, "PASS");
    assert.equal(activation.responsiveQaReport.status, "PASS");
    assert.equal(activation.accessibilityQaReport.status, "PASS");
    assert.equal(activation.featureFlagAudit.status, "PASS");
    assert.equal(activation.activationAudit.routesChanged, false);
    assert.equal(activation.activationAudit.searchChanged, false);
    assert.equal(activation.activationAudit.seoChanged, false);
  });
});
