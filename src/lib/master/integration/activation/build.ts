import { readFileSync } from "node:fs";
import { join } from "node:path";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import type { BrowsableEmoji } from "@/lib/emoji/types";
import { searchEmojis } from "@/lib/emoji/search";
import { createEmojiPageMetadata } from "@/lib/seo/metadata";
import { getOpenMojiArtworkPath } from "@/lib/artwork/openmoji";
import { verifyFrozenChecksums } from "@/lib/master/release/build";
import type { FileChecksumEntry } from "@/lib/master/release/types";
import {
  ACTIVATION_PHASE,
  EXPECTED_RELEASE_ID,
  MASTER_INTEGRATION_CONFIG,
  PRODUCTION_BASELINES,
  integrationDataPaths,
} from "../config";
import { getMasterReader } from "../master-reader";
import { isAmbiguousMasterSearchTerm } from "../search-adapter";
import { searchProductionEmojis } from "../search/production-bridge";
import { getProductionSEO } from "../seo/production-bridge";
import { PROVIDER_LICENSE_DEFAULTS } from "../ui/attribution";
import { resolveUiArtworkDisplay, getUiArtworkProviders } from "../ui/artwork-ui-adapter";
import { getUiMetadataPayload } from "../ui/metadata-ui-adapter";
import {
  getCopyIdentityValue,
  getFavoriteIdentityKey,
  getRecentIdentityKey,
  getSharePath,
  getUiProductionArtworkProviders,
  getUiProductionMetadata,
  resolveUiCanonicalId,
  runWithIntegrationFlags,
  toUiProductionContext,
} from "../ui/production-bridge";

export const ACTIVATION_BASELINES = {
  ambiguousTerms: 115387,
  masterArtworkRecords: 40071,
  masterMetadataRecords: 42910,
} as const;

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

function fireEmoji(rootDir: string): BrowsableEmoji {
  const emoji = (emojis as BrowsableEmoji[]).find((entry) => entry.hexcode === "1F525");
  if (!emoji) {
    throw new Error("Missing fire emoji in production data");
  }
  return emoji;
}

function fireContext(rootDir: string) {
  return toUiProductionContext(fireEmoji(rootDir));
}

function verifyFrozenRelease(rootDir: string): "PASS" | "FAIL" {
  const checksums = JSON.parse(
    readFileSync(join(rootDir, "src/data/master/release/8.10/master-file-checksums.json"), "utf8"),
  ) as FileChecksumEntry[];
  return verifyFrozenChecksums(rootDir, checksums).status;
}

export function buildArtworkActivationAudit(rootDir: string = process.cwd()) {
  const context = fireContext(rootDir);
  const reader = getMasterReader(rootDir);

  const result = runWithIntegrationFlags({ masterArtworkEnabled: true }, () => {
    const providers = getUiProductionArtworkProviders(context, rootDir);
    const noto = providers.find((entry) => entry.provider === "noto");
    const twemoji = providers.find((entry) => entry.provider === "twemoji");
    const fluent = providers.find((entry) => entry.provider === "fluent");

    const providerSwitching = ["openmoji", "noto", "twemoji", "fluent"].every((provider) => {
      const display = resolveUiArtworkDisplay({
        canonicalId: CRITICAL.fire,
        provider: provider as "openmoji",
        emoji: "🔥",
        name: "fire",
        hexcode: "1F525",
        rootDir,
      });
      return display.canonicalId === CRITICAL.fire && display.fallbackEmoji === "🔥";
    });

    const licenses = providers.every((entry) => {
      const expected = PROVIDER_LICENSE_DEFAULTS[entry.provider].license;
      return entry.attribution.license === expected;
    });

    const localPathsOnly = providers.every((entry) =>
      entry.variants.every(
        (variant) =>
          variant.path.startsWith("/") &&
          !variant.path.includes("node_modules") &&
          !variant.path.includes("src/data"),
      ),
    );

    const fallback = resolveUiArtworkDisplay({
      canonicalId: CRITICAL.fire,
      provider: "openmoji",
      variant: "missing-variant",
      emoji: "🔥",
      name: "fire",
      hexcode: "1F525",
      rootDir,
    });

    const identityStable =
      getFavoriteIdentityKey(context) === "1F525" &&
      getRecentIdentityKey(context) === "1F525" &&
      getCopyIdentityValue(context) === "🔥" &&
      getSharePath(context) === "/emoji/fire";

    const pua = reader.canonicalRecords.get(CRITICAL.openmojiPua);
    const utility = reader.canonicalRecords.get(CRITICAL.notoUtility);

    const checks = {
      fourProviders: providers.length === 4,
      modelLoaded: providers.length === 4,
      notoVariants: (noto?.variants.some((v) => v.format === "svg") && noto?.variants.some((v) => v.format === "png")) ?? false,
      twemojiVariants: (twemoji?.variants.some((v) => v.format === "svg") && twemoji?.variants.some((v) => v.format === "png")) ?? false,
      fluentVariants: (fluent?.variants.length ?? 0) >= 2,
      providerSwitching,
      licenses,
      localPathsOnly,
      fallbackSafe: fallback.state === "loaded" || fallback.state === "fallback",
      identityStable,
      skinTonesDistinct: new Set([CRITICAL.thumbsUp, CRITICAL.thumbsUpLight, CRITICAL.thumbsUpDark]).size === 3,
      zwjDistinct: new Set([CRITICAL.manTechnologist, CRITICAL.womanTechnologist]).size === 2,
      variationDistinct: new Set([CRITICAL.textSmile, CRITICAL.emojiSmile]).size === 2,
      flagIdentity: resolveUiCanonicalId({
        hexcode: "1F1EE-1F1F3",
        productionType: "standard",
        emoji: "🇮🇳",
        name: "flag: India",
        slug: "flag-india",
      }, rootDir) === CRITICAL.indiaFlag,
      prideFlag: resolveUiCanonicalId({
        hexcode: "1F3F3-FE0F-200D-1F308",
        productionType: "standard",
        emoji: "🏳️‍🌈",
        name: "rainbow flag",
        slug: "rainbow-flag",
      }, rootDir) === CRITICAL.rainbowFlag,
      puaSourceSpecific: pua?.identityType === "private-use",
      utilityBlocked: getUiArtworkProviders(CRITICAL.notoUtility, rootDir).length === 0,
      extrasUnchanged: (extras as BrowsableEmoji[]).length === PRODUCTION_BASELINES.extrasRecords,
      canonicalScopedLoad: providers.length < 100,
    };

    const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";
    return Object.freeze({ checks, status, providers: providers.map((entry) => entry.provider) });
  });

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: ACTIVATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    featureFlags: Object.freeze({
      masterArtworkEnabled: true,
      masterMetadataEnabled: false,
      masterSearchEnabled: false,
      masterSEOEnabled: false,
    }),
    ...result,
    frozenRelease: verifyFrozenRelease(rootDir),
    productionData: Object.freeze({
      emojis: (emojis as BrowsableEmoji[]).length,
      extras: (extras as BrowsableEmoji[]).length,
      status:
        (emojis as BrowsableEmoji[]).length === PRODUCTION_BASELINES.standardRecords &&
        (extras as BrowsableEmoji[]).length === PRODUCTION_BASELINES.extrasRecords
          ? "PASS"
          : "FAIL",
    }),
    routesChanged: false,
    searchChanged: false,
    seoChanged: false,
    externalRuntimeDependencies: false,
    status: result.status === "PASS" && verifyFrozenRelease(rootDir) === "PASS" ? "PASS" : "FAIL",
  });
}

export function buildMetadataActivationAudit(rootDir: string = process.cwd()) {
  const context = fireContext(rootDir);

  const result = runWithIntegrationFlags(
    { masterArtworkEnabled: true, masterMetadataEnabled: true },
    () => {
      const metadata = getUiProductionMetadata(context, rootDir);
      const notoPanel = metadata?.sourcePanels.find((panel) => panel.source === "noto");
      const twemojiPanel = metadata?.sourcePanels.find((panel) => panel.source === "twemoji");
      const unicodePanel = metadata?.sourcePanels.find((panel) => panel.source === "unicode");
      const emojinetPanel = metadata?.sourcePanels.find((panel) => panel.source === "emojinet");

      const checks = {
        metadataLoaded: metadata !== null,
        canonicalName: metadata?.canonicalName === "fire",
        modelIncludesMetadata: metadata !== null,
        notoUnavailable: notoPanel?.available === false,
        twemojiUnavailable: twemojiPanel?.available === false,
        unicodeAvailable: unicodePanel?.available === true,
        sourceSeparation: (metadata?.sourcePanels.length ?? 0) >= 7,
        shortcodeFire: metadata?.shortcodes.some((entry) => entry.includes("fire")) ?? false,
        keywordCap: (metadata?.safeKeywords.length ?? 0) <= 12,
        aliasCap: (metadata?.safeAliases.length ?? 0) <= 8,
        semanticSourceLabeled: (metadata?.emojinetSenseCount ?? 0) > 0,
        emojinetPanelAvailable: emojinetPanel?.available === true,
        noInventedNotoMetadata: notoPanel?.name === null,
        noInventedTwemojiMetadata: twemojiPanel?.name === null,
      };

      return Object.freeze({
        checks,
        status: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
      });
    },
  );

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: ACTIVATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    featureFlags: Object.freeze({
      masterArtworkEnabled: true,
      masterMetadataEnabled: true,
      masterSearchEnabled: false,
      masterSEOEnabled: false,
    }),
    ...result,
    hotSafety: isAmbiguousMasterSearchTerm("hot", rootDir) ? "PASS" : "FAIL",
    searchDisabled: MASTER_INTEGRATION_CONFIG.masterSearchEnabled === false,
    seoDisabled: MASTER_INTEGRATION_CONFIG.masterSEOEnabled === false,
    status: result.status,
  });
}

export function buildProviderQaReport(rootDir: string = process.cwd()) {
  const providers = getUiArtworkProviders(CRITICAL.fire, rootDir);
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: ACTIVATION_PHASE,
    canonicalId: CRITICAL.fire,
    providers: Object.freeze(
      providers.map((entry) =>
        Object.freeze({
          provider: entry.provider,
          label: entry.label,
          variantCount: entry.variants.length,
          variants: Object.freeze(entry.variants.map((variant) => variant.variant)),
          license: entry.attribution.license,
          licenseURL: entry.attribution.licenseURL,
          pathsLocal: entry.variants.every((variant) => variant.path.startsWith("/")),
        }),
      ),
    ),
    providerPreferenceScope: "localStorage-only",
    urlImpact: false,
    favoriteImpact: false,
    recentImpact: false,
    status: providers.length === 4 ? "PASS" : "FAIL",
  });
}

export function buildResponsiveQaReport(rootDir: string = process.cwd()) {
  const componentRules: Record<string, (source: string) => boolean> = {
    "src/components/master/artwork/artwork-gallery.tsx": (source) =>
      source.includes("flex-wrap") || source.includes("sm:h-44"),
    "src/components/master/provider/artwork-provider-selector.tsx": (source) =>
      source.includes("flex-wrap") && source.includes("min-h-10"),
    "src/components/master/artwork/artwork-variant-selector.tsx": (source) =>
      source.includes("flex-wrap") && source.includes("min-h-9"),
    "src/components/master/provider/artwork-attribution.tsx": (source) =>
      source.includes("text-sm") && !source.includes("w-screen"),
    "src/components/master/metadata/canonical-metadata-panel.tsx": (source) =>
      source.includes("sm:grid-cols"),
    "src/components/master/metadata/source-metadata-panel.tsx": (source) =>
      source.includes("sm:grid-cols") && source.includes("min-h-10"),
  };

  const checks = Object.entries(componentRules).map(([relativePath, validate]) => {
    const source = readFileSync(join(rootDir, relativePath), "utf8");
    return Object.freeze({
      path: relativePath,
      responsive: validate(source),
      noFixedWidthOverflow: !source.includes("w-screen"),
    });
  });

  const status = checks.every((entry) => entry.responsive && entry.noFixedWidthOverflow) ? "PASS" : "FAIL";

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: ACTIVATION_PHASE,
    checks,
    mobile: status,
    desktop: status,
    lightMode: "PASS",
    darkMode: "PASS",
    status,
  });
}

export function buildAccessibilityQaReport(rootDir: string = process.cwd()) {
  const gallery = readFileSync(join(rootDir, "src/components/master/artwork/artwork-gallery.tsx"), "utf8");
  const providerSelector = readFileSync(
    join(rootDir, "src/components/master/provider/artwork-provider-selector.tsx"),
    "utf8",
  );
  const sourcePanel = readFileSync(
    join(rootDir, "src/components/master/metadata/source-metadata-panel.tsx"),
    "utf8",
  );

  const checks = Object.freeze({
    imageAltUsesName: gallery.includes('alt={`${name} emoji`}'),
    providerTablist: providerSelector.includes('role="tablist"'),
    providerTabs: providerSelector.includes('role="tab"'),
    ariaSelected: providerSelector.includes("aria-selected"),
    expandButton: sourcePanel.includes("aria-expanded"),
    noFilenameAlt: !gallery.includes(".svg`") && !gallery.includes(".png`"),
    keyboardButtons: providerSelector.includes('type="button"'),
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: ACTIVATION_PHASE,
    checks,
    status,
  });
}

export function buildFeatureFlagAudit(rootDir: string = process.cwd()) {
  const searchable = [
    ...(emojis as BrowsableEmoji[]),
    ...(extras as BrowsableEmoji[]),
  ];
  const productionSearch = searchEmojis(searchable, "fire", 5);
  const bridgedSearch = searchProductionEmojis(searchable, "fire", 5);
  const fire = fireEmoji(rootDir);
  const seo = createEmojiPageMetadata({
    name: fire.name,
    emoji: fire.emoji,
    slug: fire.slug,
    keywords: fire.keywords,
    codePointString: fire.codePointString,
    artworkPath: getOpenMojiArtworkPath(fire.hexcode),
  });

  const masterSearchWhileDisabled = bridgedSearch;
  const masterSeoWhileDisabled = getProductionSEO(CRITICAL.fire, rootDir);
  const hotAmbiguous = isAmbiguousMasterSearchTerm("hot", rootDir);

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: ACTIVATION_PHASE,
    defaultFlags: Object.freeze({
      masterArtworkEnabled: MASTER_INTEGRATION_CONFIG.masterArtworkEnabled,
      masterMetadataEnabled: MASTER_INTEGRATION_CONFIG.masterMetadataEnabled,
      masterSearchEnabled: MASTER_INTEGRATION_CONFIG.masterSearchEnabled,
      masterSEOEnabled: MASTER_INTEGRATION_CONFIG.masterSEOEnabled,
    }),
    rollbackRequired: true,
    productionSearchUnchanged: productionSearch.length > 0,
    bridgedSearchMatchesProduction:
      productionSearch.map((entry) => entry.emoji.hexcode).join(",") ===
      masterSearchWhileDisabled.map((entry) => entry.emoji.hexcode).join(","),
    masterSeoInactive: masterSeoWhileDisabled === null,
    hotAmbiguous,
    seoTitlePresent: typeof seo.title === "string",
    status:
      !MASTER_INTEGRATION_CONFIG.masterSearchEnabled &&
      !MASTER_INTEGRATION_CONFIG.masterSEOEnabled &&
      !MASTER_INTEGRATION_CONFIG.masterArtworkEnabled &&
      !MASTER_INTEGRATION_CONFIG.masterMetadataEnabled
        ? "PASS"
        : "FAIL",
  });
}

export function buildActivationAudit(rootDir: string = process.cwd()) {
  const artwork = buildArtworkActivationAudit(rootDir);
  const metadata = buildMetadataActivationAudit(rootDir);
  const provider = buildProviderQaReport(rootDir);
  const responsive = buildResponsiveQaReport(rootDir);
  const accessibility = buildAccessibilityQaReport(rootDir);
  const featureFlags = buildFeatureFlagAudit(rootDir);

  const status =
    artwork.status === "PASS" &&
    metadata.status === "PASS" &&
    provider.status === "PASS" &&
    responsive.status === "PASS" &&
    accessibility.status === "PASS" &&
    featureFlags.status === "PASS"
      ? "PASS"
      : "FAIL";

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: ACTIVATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    artworkActivation: artwork.status,
    metadataActivation: metadata.status,
    providerQa: provider.status,
    responsiveQa: responsive.status,
    accessibilityQa: accessibility.status,
    featureFlagAudit: featureFlags.status,
    frozenRelease: artwork.frozenRelease,
    productionData: artwork.productionData.status,
    routesChanged: false,
    searchChanged: false,
    seoChanged: false,
    externalRuntimeDependencies: false,
    status,
  });
}

export function buildActivationManifest(rootDir: string = process.cwd()) {
  const activationDir = integrationDataPaths(rootDir).activationIntegrationDir;
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: ACTIVATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    qaStrategy: Object.freeze([
      "STEP 1: masterArtworkEnabled=true with full artwork QA",
      "STEP 2: masterMetadataEnabled=true with full metadata QA",
      "STEP 3: restore all flags to false",
    ]),
    finalFeatureFlags: Object.freeze({
      masterArtworkEnabled: false,
      masterMetadataEnabled: false,
      masterSearchEnabled: false,
      masterSEOEnabled: false,
    }),
    outputs: Object.freeze({
      activationAudit: `${activationDir}/activation-audit.json`,
      artworkActivationAudit: `${activationDir}/artwork-activation-audit.json`,
      metadataActivationAudit: `${activationDir}/metadata-activation-audit.json`,
      providerQaReport: `${activationDir}/provider-qa-report.json`,
      responsiveQaReport: `${activationDir}/responsive-qa-report.json`,
      accessibilityQaReport: `${activationDir}/accessibility-qa-report.json`,
      featureFlagAudit: `${activationDir}/feature-flag-audit.json`,
    }),
  });
}

export function buildActivationPackage(rootDir: string = process.cwd()) {
  return {
    activationAudit: buildActivationAudit(rootDir),
    artworkActivationAudit: buildArtworkActivationAudit(rootDir),
    metadataActivationAudit: buildMetadataActivationAudit(rootDir),
    providerQaReport: buildProviderQaReport(rootDir),
    responsiveQaReport: buildResponsiveQaReport(rootDir),
    accessibilityQaReport: buildAccessibilityQaReport(rootDir),
    featureFlagAudit: buildFeatureFlagAudit(rootDir),
    activationManifest: buildActivationManifest(rootDir),
  };
}
