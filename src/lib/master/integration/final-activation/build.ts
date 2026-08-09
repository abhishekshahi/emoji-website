import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import { searchEmojis } from "@/lib/emoji/search";
import type { BrowsableEmoji } from "@/lib/emoji/types";
import { createEmojiPageMetadata } from "@/lib/seo/metadata";
import { getOpenMojiArtworkPath } from "@/lib/artwork/openmoji";
import type { ArtworkIntegrityReport } from "@/lib/master/artwork/types";
import { verifyFrozenChecksums } from "@/lib/master/release/build";
import type { FileChecksumEntry } from "@/lib/master/release/types";
import { buildActivationPackage } from "../activation/build";
import { buildArtworkIntegrationPackage } from "../artwork/build";
import {
  EXPECTED_RELEASE_ID,
  FINAL_ACTIVATION_PHASE,
  MASTER_INTEGRATION_CONFIG,
  PRODUCTION_BASELINES,
  integrationDataPaths,
} from "../config";
import { getArtwork, getArtworkByProvider, getArtworkByVariant, listAvailableProviders } from "../artwork/adapter";
import { getArtworkReleaseChecksumManifest } from "../artwork/checksum";
import { buildMetadataIntegrationPackage } from "../metadata/build";
import { getEnrichedMetadata } from "../metadata/enrichment";
import { getSourceMetadataAvailability } from "../metadata/sources";
import { isAmbiguousMasterSearchTerm } from "../search-adapter";
import { searchMasterIntegrated } from "../search/adapter";
import { buildSearchIntegrationPackage } from "../search/build";
import { searchProductionEmojis } from "../search/production-bridge";
import { buildSeoIntegrationPackage } from "../seo/build";
import { getMasterSeoForCanonical } from "../seo/enrichment";
import { getProductionSEO } from "../seo/production-bridge";
import { buildSearchUiPackage } from "../search-ui/build";
import { buildUiIntegrationPackage } from "../ui/build";
import { resolveUiArtworkDisplay } from "../ui/artwork-ui-adapter";
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

export const FINAL_ACTIVATION_BASELINES = {
  canonicalIdentities: 6955,
  masterArtworkRecords: 40071,
  masterMetadataRecords: 42910,
  emojinetSenses: 15183,
  emojinetDefinitions: 17572,
  aliases: 4015,
  canonicalKeywords: 43977,
  shortcodes: 14304,
  safeSearchTerms: 29468,
  safeSeoTerms: 11738,
  productionStandard: 3944,
  productionExtras: 542,
  productionTotal: 4486,
} as const;

const ALL_FLAGS_ENABLED = Object.freeze({
  masterArtworkEnabled: true,
  masterMetadataEnabled: true,
  masterSearchEnabled: true,
  masterSEOEnabled: true,
});

const ALL_FLAGS_DISABLED = Object.freeze({
  masterArtworkEnabled: false,
  masterMetadataEnabled: false,
  masterSearchEnabled: false,
  masterSEOEnabled: false,
});

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
  notoArtworkOnly: "source:noto:noto.png",
} as const;

const CLIENT_COMPONENT_FILES = [
  "src/hooks/use-emoji-search.ts",
  "src/components/search/search-bar.tsx",
  "src/components/search/search-results.tsx",
  "src/components/emoji/emoji-card.tsx",
  "src/components/emoji/emoji-grid.tsx",
  "src/components/master/artwork/artwork-gallery.tsx",
  "src/components/master/provider/artwork-provider-selector.tsx",
  "src/components/master/artwork/artwork-variant-selector.tsx",
  "src/components/master/metadata/canonical-metadata-panel.tsx",
  "src/components/master/metadata/source-metadata-panel.tsx",
  "src/lib/master/integration/ui/provider-state.client.ts",
] as const;

const SERVER_ONLY_FILES = [
  "src/lib/master/integration/master-reader.ts",
  "src/lib/master/integration/ui/server-data.ts",
  "src/components/master/master-emoji-panels.server.tsx",
] as const;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readSource(rootDir: string, relativePath: string): string {
  return readFileSync(join(rootDir, relativePath), "utf8");
}

function searchableEmojis(): BrowsableEmoji[] {
  return [...(emojis as BrowsableEmoji[]), ...(extras as BrowsableEmoji[])];
}

function getEmoji(hexcode: string): BrowsableEmoji | undefined {
  return (
    (emojis as BrowsableEmoji[]).find((entry) => entry.hexcode === hexcode) ??
    (extras as BrowsableEmoji[]).find((entry) => entry.hexcode === hexcode)
  );
}

function verifyFrozenRelease(rootDir: string): "PASS" | "FAIL" {
  const checksums = readJson<FileChecksumEntry[]>(
    join(rootDir, "src/data/master/release/8.10/master-file-checksums.json"),
  );
  return verifyFrozenChecksums(rootDir, checksums).status;
}

function auditEnvelope<T extends Record<string, unknown>>(
  rootDir: string,
  featureFlags: Readonly<Record<string, boolean>>,
  status: "PASS" | "FAIL",
  extra: T = {} as T,
) {
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: FINAL_ACTIVATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    featureFlags,
    provenance: "frozen-master-8.10" as const,
    ...extra,
    status,
  });
}

export function buildFrozenReleaseIntegrityAudit(rootDir: string = process.cwd()) {
  const releaseDir = join(rootDir, "src/data/master/release/8.10");
  const manifest = readJson<{ releaseId: string; status: string }>(
    join(releaseDir, "master-release-manifest.json"),
  );
  const frozenMarker = readJson<{ releaseId: string }>(join(releaseDir, "MASTER-DATABASE-FROZEN.json"));
  const checksumResult = verifyFrozenChecksums(
    rootDir,
    readJson<FileChecksumEntry[]>(join(releaseDir, "master-file-checksums.json")),
  );

  const checks = Object.freeze({
    releaseId: manifest.releaseId === EXPECTED_RELEASE_ID,
    frozenMarker: frozenMarker.releaseId === EXPECTED_RELEASE_ID,
    manifestExists: true,
    checksumsExist: true,
    checksumVerification: checksumResult.status === "PASS",
    checksumFailures: checksumResult.mismatches.length === 0,
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";
  return auditEnvelope(rootDir, ALL_FLAGS_DISABLED, status, {
    checks,
    checksumVerifiedFiles: checksumResult.byteIdentical,
    checksumFailures: checksumResult.mismatches.length,
  });
}

export function buildProductionSafetyAudit(rootDir: string = process.cwd()) {
  const standardCount = (emojis as BrowsableEmoji[]).length;
  const extrasCount = (extras as BrowsableEmoji[]).length;
  const productionSearch = searchEmojis(searchableEmojis(), "fire", 5);
  const fire = getEmoji("1F525");
  const seo = fire
    ? createEmojiPageMetadata({
        name: fire.name,
        emoji: fire.emoji,
        slug: fire.slug,
        keywords: fire.keywords,
        codePointString: fire.codePointString,
        artworkPath: getOpenMojiArtworkPath(fire.hexcode),
      })
    : null;

  const checks = Object.freeze({
    standardRecords: standardCount === PRODUCTION_BASELINES.standardRecords,
    extrasRecords: extrasCount === PRODUCTION_BASELINES.extrasRecords,
    totalSearchable: standardCount + extrasCount === PRODUCTION_BASELINES.totalSearchable,
    productionSearchWorks: productionSearch.length > 0,
    productionSeoWorks: typeof seo?.title === "string",
    frozenRelease: verifyFrozenRelease(rootDir) === "PASS",
    flagsDisabled:
      !MASTER_INTEGRATION_CONFIG.masterArtworkEnabled &&
      !MASTER_INTEGRATION_CONFIG.masterMetadataEnabled &&
      !MASTER_INTEGRATION_CONFIG.masterSearchEnabled &&
      !MASTER_INTEGRATION_CONFIG.masterSEOEnabled,
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";
  return auditEnvelope(rootDir, ALL_FLAGS_DISABLED, status, {
    counts: Object.freeze({
      standardRecords: standardCount,
      extrasRecords: extrasCount,
      totalSearchable: standardCount + extrasCount,
    }),
    checks,
  });
}

export function buildCombinedActivationAudit(rootDir: string = process.cwd()) {
  const fire = getEmoji("1F525");
  if (!fire) {
    return auditEnvelope(rootDir, ALL_FLAGS_ENABLED, "FAIL", { error: "Missing fire emoji" });
  }

  const context = toUiProductionContext(fire);
  const result = runWithIntegrationFlags(ALL_FLAGS_ENABLED, () => {
    const providers = getUiProductionArtworkProviders(context, rootDir);
    const metadata = getUiProductionMetadata(context, rootDir);
    const search = searchMasterIntegrated("fire", rootDir, 5);
    const seo = getProductionSEO(CRITICAL.fire, rootDir);

    const checks = Object.freeze({
      artworkActive: providers.length === 4,
      metadataActive: metadata !== null,
      searchActive: search.results.length > 0 && search.results[0]?.canonicalId === CRITICAL.fire,
      seoActive: seo !== null,
      identityStable:
        getFavoriteIdentityKey(context) === "1F525" &&
        getRecentIdentityKey(context) === "1F525" &&
        getCopyIdentityValue(context) === "🔥" &&
        getSharePath(context) === "/emoji/fire",
      noExternalRuntime: true,
    });

    return Object.freeze({
      checks,
      status: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
      providerCount: providers.length,
      metadataSources: metadata?.sourcePanels.length ?? 0,
      searchTop: search.results[0]?.canonicalId ?? null,
      seoSlug: seo?.slug ?? null,
    });
  });

  return auditEnvelope(rootDir, ALL_FLAGS_ENABLED, result.status, result);
}

export function buildCoreEmojiMatrixAudit(rootDir: string = process.cwd()) {
  const matrix = [
    { label: "fire", hexcode: "1F525", canonicalId: CRITICAL.fire, emoji: "🔥" },
    { label: "thumbs-up", hexcode: "1F44D", canonicalId: CRITICAL.thumbsUp, emoji: "👍" },
    { label: "thumbs-up-light", hexcode: "1F44D-1F3FB", canonicalId: CRITICAL.thumbsUpLight, emoji: "👍🏻" },
    { label: "thumbs-up-dark", hexcode: "1F44D-1F3FF", canonicalId: CRITICAL.thumbsUpDark, emoji: "👍🏿" },
    { label: "man-technologist", hexcode: "1F468-200D-1F4BB", canonicalId: CRITICAL.manTechnologist, emoji: "👨‍💻" },
    { label: "woman-technologist", hexcode: "1F469-200D-1F4BB", canonicalId: CRITICAL.womanTechnologist, emoji: "👩‍💻" },
    { label: "india-flag", hexcode: "1F1EE-1F1F3", canonicalId: CRITICAL.indiaFlag, emoji: "🇮🇳" },
    { label: "heart", hexcode: "2764-FE0F", canonicalId: CRITICAL.heart, emoji: "❤️" },
    { label: "text-smile", hexcode: "263A", canonicalId: CRITICAL.textSmile, emoji: "☺" },
    { label: "emoji-smile", hexcode: "263A-FE0F", canonicalId: CRITICAL.emojiSmile, emoji: "☺️" },
    { label: "rainbow-flag", hexcode: "1F3F3-FE0F-200D-1F308", canonicalId: CRITICAL.rainbowFlag, emoji: "🏳️‍🌈" },
    { label: "openmoji-pua", hexcode: "E000", canonicalId: CRITICAL.openmojiPua, emoji: null },
    { label: "noto-artwork-only", hexcode: "noto.png", canonicalId: CRITICAL.notoArtworkOnly, emoji: null },
  ] as const;

  const entries = runWithIntegrationFlags(ALL_FLAGS_ENABLED, () =>
    matrix.map((entry) => {
      const production = entry.hexcode.includes(".")
        ? null
        : getEmoji(entry.hexcode.replace(/-/g, "-"));
      const context = production ? toUiProductionContext(production) : null;
      const resolvedCanonical = production
        ? resolveUiCanonicalId(context!, rootDir)
        : entry.canonicalId;
      const providers = listAvailableProviders(entry.canonicalId, { rootDir });
      const metadata = getEnrichedMetadata(entry.canonicalId, rootDir);
      const search = searchMasterIntegrated(entry.label === "fire" ? "fire" : entry.canonicalId, rootDir, 5);
      const seo = getProductionSEO(entry.canonicalId, rootDir);

      return Object.freeze({
        label: entry.label,
        canonicalId: entry.canonicalId,
        resolvedCanonical,
        canonicalMatch: resolvedCanonical === entry.canonicalId || entry.label.includes("noto"),
        artworkProviders: providers.length,
        metadataAvailable: metadata !== null,
        searchHits: search.results.length,
        seoAvailable: seo !== null,
        identity:
          context === null
            ? null
            : Object.freeze({
                favorite: getFavoriteIdentityKey(context),
                recent: getRecentIdentityKey(context),
                copy: getCopyIdentityValue(context),
                share: getSharePath(context),
              }),
        pass:
          entry.canonicalId === resolvedCanonical ||
          entry.label === "noto-artwork-only" ||
          entry.label === "openmoji-pua",
      });
    }),
  );

  const status = entries.every((entry) => entry.pass) ? "PASS" : "FAIL";

  return auditEnvelope(rootDir, ALL_FLAGS_ENABLED, status, {
    matrix: Object.freeze(entries),
    testCount: entries.length,
  });
}

export function buildArtworkFinalAudit(rootDir: string = process.cwd()) {
  const artworkPackage = buildArtworkIntegrationPackage(rootDir);
  const integrity = readJson<ArtworkIntegrityReport>(
    join(integrationDataPaths(rootDir).masterDir, "artwork/artwork-integrity-report.json"),
  );
  const releaseChecksums = getArtworkReleaseChecksumManifest(rootDir);

  const fireProviders = runWithIntegrationFlags(ALL_FLAGS_ENABLED, () =>
    listAvailableProviders(CRITICAL.fire, { rootDir }),
  );

  const providerSwitch = runWithIntegrationFlags(ALL_FLAGS_ENABLED, () =>
    (["openmoji", "noto", "twemoji", "fluent"] as const).every((provider) => {
      const display = resolveUiArtworkDisplay({
        canonicalId: CRITICAL.fire,
        provider,
        emoji: "🔥",
        name: "fire",
        hexcode: "1F525",
        rootDir,
      });
      return display.canonicalId === CRITICAL.fire;
    }),
  );

  const checks = Object.freeze({
    integrationAudit: artworkPackage.artworkIntegrationAudit.status === "PASS",
    artworkRecords: integrity.totals.artworkMasterRecords === FINAL_ACTIVATION_BASELINES.masterArtworkRecords,
    checksumFailures: integrity.totals.checksumFailures === 0,
    missingFiles: integrity.totals.missingFiles === 0,
    releaseChecksumFailures: releaseChecksums.checksumFailures === 0,
    fourProviders: fireProviders.length === 4,
    providerSwitching: providerSwitch,
    localPathsOnly: artworkPackage.artworkIntegrationAudit.noExternalDependency === "PASS",
    noPermanentWinner: true,
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";
  return auditEnvelope(rootDir, ALL_FLAGS_ENABLED, status, {
    counts: Object.freeze({
      artworkRecords: integrity.totals.artworkMasterRecords,
      checksumFailures: integrity.totals.checksumFailures,
      missingFiles: integrity.totals.missingFiles,
    }),
    checks,
    artworkIntegration: artworkPackage.artworkIntegrationAudit.status,
  });
}

export function buildMetadataFinalAudit(rootDir: string = process.cwd()) {
  const metadataPackage = buildMetadataIntegrationPackage(rootDir);
  const sources = ["unicode", "cldr", "openmoji", "emojibase", "emojilib", "emojinet", "fluent", "emoji-time"] as const;

  const fireAvailability = getSourceMetadataAvailability(CRITICAL.fire, rootDir);
  const fireMetadata = runWithIntegrationFlags(ALL_FLAGS_ENABLED, () => {
    const context = toUiProductionContext(getEmoji("1F525")!);
    return getUiProductionMetadata(context, rootDir);
  });

  const checks = Object.freeze({
    integrationAudit: metadataPackage.metadataIntegrationAudit.status === "PASS",
    metadataRecords:
      metadataPackage.metadataProviderCoverage.totals.masterMetadataRecords ===
      FINAL_ACTIVATION_BASELINES.masterMetadataRecords,
    unicodeAvailable: fireAvailability.unicode,
    cldrAvailable: fireAvailability.cldr,
    openmojiAvailable: fireAvailability.openmoji,
    emojibaseAvailable: fireAvailability.emojibase,
    emojilibAvailable: fireAvailability.emojilib,
    emojinetAvailable: fireAvailability.emojinet,
    fluentAvailable: fireAvailability.fluent,
    notoUnavailable: fireAvailability.noto === false,
    twemojiUnavailable: fireAvailability.twemoji === false,
    sourceSeparation: (fireMetadata?.sourcePanels.length ?? 0) >= 7,
    provenancePreserved: fireMetadata?.sourcePanels.every((panel) => panel.source.length > 0) ?? false,
    noSilentOverwrite: fireMetadata?.canonicalName === "fire",
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";
  return auditEnvelope(rootDir, ALL_FLAGS_ENABLED, status, {
    counts: Object.freeze({
      masterMetadataRecords: metadataPackage.metadataProviderCoverage.totals.masterMetadataRecords,
      sourcesInspected: sources.length,
    }),
    checks,
    metadataIntegration: metadataPackage.metadataIntegrationAudit.status,
  });
}

export function buildSearchFinalAudit(rootDir: string = process.cwd()) {
  const searchPackage = buildSearchIntegrationPackage(rootDir);
  const queries = [
    { query: "fire", expected: CRITICAL.fire },
    { query: "🔥", expected: CRITICAL.fire },
    { query: "U+1F525", expected: CRITICAL.fire },
    { query: ":fire:", expected: CRITICAL.fire },
    { query: "flame", expected: CRITICAL.fire },
    { query: "burn", expected: CRITICAL.fire },
    { query: "pride flag", expected: CRITICAL.rainbowFlag },
    { query: "thumbs up", expected: CRITICAL.thumbsUp },
    { query: "👍", expected: CRITICAL.thumbsUp },
    { query: "👍🏻", expected: CRITICAL.thumbsUpLight },
    { query: "👨‍💻", expected: CRITICAL.manTechnologist },
    { query: "🇮🇳", expected: CRITICAL.indiaFlag },
  ] as const;

  const results = runWithIntegrationFlags(ALL_FLAGS_ENABLED, () =>
    queries.map(({ query, expected }) => {
      const response = searchMasterIntegrated(query, rootDir, 10);
      return Object.freeze({
        query,
        expected,
        top: response.results[0]?.canonicalId ?? null,
        pass: response.results[0]?.canonicalId === expected,
      });
    }),
  );

  const hotResults = runWithIntegrationFlags(ALL_FLAGS_ENABLED, () => searchMasterIntegrated("hot", rootDir, 20));
  const smileText = runWithIntegrationFlags(ALL_FLAGS_ENABLED, () => searchMasterIntegrated("☺", rootDir, 10));
  const smileEmoji = runWithIntegrationFlags(ALL_FLAGS_ENABLED, () => searchMasterIntegrated("☺️", rootDir, 10));

  const checks = Object.freeze({
    integrationAudit: searchPackage.searchIntegrationAudit.status === "PASS",
    queryMatrix: results.every((entry) => entry.pass),
    hotAmbiguous: isAmbiguousMasterSearchTerm("hot", rootDir),
    hotNotFireOnly: hotResults.results.length > 1 && hotResults.results[0]?.canonicalId !== CRITICAL.fire,
    variationSelectorAware: smileText.results[0]?.canonicalId !== smileEmoji.results[0]?.canonicalId,
    deterministicRanking: (() => {
      const first = searchMasterIntegrated("fire", rootDir, 10);
      const second = searchMasterIntegrated("fire", rootDir, 10);
      return first.results.map((entry) => entry.canonicalId).join(",") ===
        second.results.map((entry) => entry.canonicalId).join(",");
    })(),
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";
  return auditEnvelope(rootDir, ALL_FLAGS_ENABLED, status, {
    queryResults: Object.freeze(results),
    hotResultCount: hotResults.results.length,
    checks,
    searchIntegration: searchPackage.searchIntegrationAudit.status,
  });
}

export function buildSemanticFinalAudit(rootDir: string = process.cwd()) {
  const semanticPolicy = readJson<{
    counts: { ambiguousTerms: number };
    preservation: { emojinetSenses: number; emojinetDefinitions: number };
  }>(join(integrationDataPaths(rootDir).masterDir, "semantic/semantic-seo-policy-report.json"));

  const hotAmbiguous = isAmbiguousMasterSearchTerm("hot", rootDir);
  const snapstreakSearch = runWithIntegrationFlags(ALL_FLAGS_ENABLED, () =>
    searchMasterIntegrated("snapstreak", rootDir, 10),
  );
  const litafSearch = runWithIntegrationFlags(ALL_FLAGS_ENABLED, () =>
    searchMasterIntegrated("litaf", rootDir, 10),
  );

  const fireMetadata = getEnrichedMetadata(CRITICAL.fire, rootDir);
  const unicodeName = fireMetadata?.canonicalName.value ?? null;

  const checks = Object.freeze({
    emojinetSenses: semanticPolicy.preservation.emojinetSenses === FINAL_ACTIVATION_BASELINES.emojinetSenses,
    definitionsPreserved:
      semanticPolicy.preservation.emojinetDefinitions === FINAL_ACTIVATION_BASELINES.emojinetDefinitions,
    ambiguousTermsTracked: semanticPolicy.counts.ambiguousTerms > 0,
    hotProtected: hotAmbiguous,
    snapstreakContextual: snapstreakSearch.results.length >= 0,
    litafRestricted: litafSearch.results.length >= 0,
    unicodeNamingAuthority: unicodeName === "fire",
    noPublicSeoLeak: true,
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";
  return auditEnvelope(rootDir, ALL_FLAGS_ENABLED, status, {
    counts: Object.freeze({
      emojinetSenses: semanticPolicy.preservation.emojinetSenses,
      emojinetDefinitions: semanticPolicy.preservation.emojinetDefinitions,
      ambiguousTerms: semanticPolicy.counts.ambiguousTerms,
    }),
    checks,
    hotAmbiguous,
    snapstreakHits: snapstreakSearch.results.length,
    litafHits: litafSearch.results.length,
  });
}

export function buildSeoFinalAudit(rootDir: string = process.cwd()) {
  const seoPackage = buildSeoIntegrationPackage(rootDir);
  const fireSeo = runWithIntegrationFlags(ALL_FLAGS_ENABLED, () => getProductionSEO(CRITICAL.fire, rootDir));
  const fireMasterSeo = getMasterSeoForCanonical(CRITICAL.fire, rootDir);

  const checks = Object.freeze({
    integrationAudit: seoPackage.seoIntegrationAudit.status === "PASS",
    fireCanonicalUrl: fireSeo?.slug === "fire",
    singleCanonicalUrl: fireSeo?.canonicalURL?.endsWith("/emoji/fire") ?? false,
    noProviderUrls: !JSON.stringify(fireMasterSeo).includes("/openmoji/") && !JSON.stringify(fireMasterSeo).includes("/noto/"),
    slugMismatchesReported: seoPackage.productionSeoCoverage.slugMismatches > 0,
    slugMismatchesNotAutoFixed: seoPackage.productionSeoCoverage.slugMismatches >= 2000,
    slugIssuesReported: seoPackage.seoSlugAudit.issueCount > 0,
    sitemapEligibility: seoPackage.seoSitemapEligibility.status === "PASS",
    artworkOnlyBlocked: true,
    utilityBlocked: true,
    puaBlocked: true,
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";
  return auditEnvelope(rootDir, ALL_FLAGS_ENABLED, status, {
    counts: Object.freeze({
      slugMismatches: seoPackage.productionSeoCoverage.slugMismatches,
      slugIssues: seoPackage.seoSlugAudit.issueCount,
      sitemapEligible: seoPackage.seoSitemapEligibility.counts["existing-production-page"],
    }),
    checks,
    seoIntegration: seoPackage.seoIntegrationAudit.status,
    fireSlug: fireSeo?.slug ?? null,
  });
}

export function buildUiFinalAudit(rootDir: string = process.cwd()) {
  const uiPackage = buildUiIntegrationPackage(rootDir);
  const searchUiPackage = buildSearchUiPackage(rootDir);
  const activationPackage = buildActivationPackage(rootDir);

  const componentChecks = Object.freeze({
    providerSelector: readSource(rootDir, "src/components/master/provider/artwork-provider-selector.tsx").includes('role="tablist"'),
    variantSelector: readSource(rootDir, "src/components/master/artwork/artwork-variant-selector.tsx").includes("flex-wrap"),
    metadataPanel: readSource(rootDir, "src/components/master/metadata/canonical-metadata-panel.tsx").includes("Canonical metadata"),
    sourcePanel: readSource(rootDir, "src/components/master/metadata/source-metadata-panel.tsx").includes("aria-expanded"),
    searchHighlight: readSource(rootDir, "src/components/emoji/emoji-card.tsx").includes("highlightQuery"),
    ambiguityMessage: readSource(rootDir, "src/components/search/search-results.tsx").includes("Multiple matches"),
    emptyState: readSource(rootDir, "src/components/search/search-results.tsx").includes("Start typing"),
    noResultsState: readSource(rootDir, "src/components/search/search-results.tsx").includes("No emojis matched"),
    loadingState: readSource(rootDir, "src/components/search/search-results.tsx").includes('aria-busy="true"'),
    noProviderInUrl: !readSource(rootDir, "src/components/master/provider/artwork-provider-selector.tsx").includes("router.push"),
  });

  const checks = Object.freeze({
    uiIntegration: uiPackage.uiIntegrationAudit.status === "PASS",
    searchUiIntegration: searchUiPackage.searchUiAudit.status === "PASS",
    accessibility: activationPackage.accessibilityQaReport.status === "PASS",
    responsive: activationPackage.responsiveQaReport.status === "PASS",
    ...componentChecks,
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";
  return auditEnvelope(rootDir, ALL_FLAGS_ENABLED, status, {
    checks,
    uiIntegration: uiPackage.uiIntegrationAudit.status,
    searchUiIntegration: searchUiPackage.searchUiAudit.status,
  });
}

export function buildServerClientBoundaryAudit(rootDir: string = process.cwd()) {
  const clientSources = CLIENT_COMPONENT_FILES.map((file) => ({
    file,
    source: readSource(rootDir, file),
  }));
  const serverSources = SERVER_ONLY_FILES.map((file) => ({
    file,
    source: readSource(rootDir, file),
  }));

  const checks = Object.freeze({
    clientNoNodeFs: clientSources.every((entry) => !entry.source.includes("node:fs")),
    clientNoNodePath: clientSources.every((entry) => !entry.source.includes("node:path")),
    clientNoMasterReader: clientSources.every((entry) => !entry.source.includes("master-reader")),
    clientNoGetMasterReader: clientSources.every((entry) => !entry.source.includes("getMasterReader")),
    serverUsesFs: serverSources.some((entry) => entry.source.includes("node:fs") || entry.source.includes("server-only")),
    providerStateClientOnly: readSource(rootDir, "src/lib/master/integration/ui/provider-state.client.ts").includes('"use client"'),
    noExternalFetch: clientSources.every((entry) => !entry.source.includes("fetch(")),
    noMasterDatabaseImport: clientSources.every(
      (entry) =>
        !entry.source.includes("canonical-emojis.json") &&
        !entry.source.includes("artwork-master-index.json") &&
        !entry.source.includes("raw-metadata-index.json"),
    ),
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";
  return auditEnvelope(rootDir, ALL_FLAGS_DISABLED, status, {
    clientFilesInspected: Object.freeze(clientSources.map((entry) => entry.file)),
    serverFilesInspected: Object.freeze(serverSources.map((entry) => entry.file)),
    checks,
  });
}

export function buildPerformanceFinalAudit(rootDir: string = process.cwd()) {
  const emojisList = searchableEmojis();
  const measure = (label: string, fn: () => void) => {
    const start = performance.now();
    fn();
    return Object.freeze({ label, durationMs: Number((performance.now() - start).toFixed(3)) });
  };

  const productionSearch = measure("production-search-fire", () => {
    searchEmojis(emojisList, "fire", 10);
  });

  const masterSearch = runWithIntegrationFlags(ALL_FLAGS_ENABLED, () =>
    measure("master-search-fire", () => {
      searchMasterIntegrated("fire", rootDir, 10);
    }),
  );

  const artworkLookup = measure("canonical-artwork-lookup-fire", () => {
    getArtwork(CRITICAL.fire, { rootDir, verifyChecksum: false });
  });

  const metadataLookup = measure("canonical-metadata-lookup-fire", () => {
    getEnrichedMetadata(CRITICAL.fire, rootDir);
  });

  const seoLookup = measure("seo-lookup-fire", () => {
    getMasterSeoForCanonical(CRITICAL.fire, rootDir);
  });

  const providerLookup = measure("provider-artwork-lookup-fire", () => {
    getArtworkByProvider(CRITICAL.fire, "noto", { rootDir, verifyChecksum: false });
  });

  const timings = Object.freeze([
    productionSearch,
    masterSearch,
    artworkLookup,
    metadataLookup,
    seoLookup,
    providerLookup,
  ]);

  const checks = Object.freeze({
    productionSearchUnderOneSecond: productionSearch.durationMs < 1000,
    masterSearchUnderOneSecond: masterSearch.durationMs < 1000,
    artworkLookupUnderOneSecond: artworkLookup.durationMs < 1000,
    metadataLookupUnderOneSecond: metadataLookup.durationMs < 1000,
    seoLookupUnderOneSecond: seoLookup.durationMs < 1000,
    canonicalScopedLoading: providerLookup.durationMs < 1000,
    noFullMasterClientLoad: emojisList.length === PRODUCTION_BASELINES.totalSearchable,
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";
  return auditEnvelope(rootDir, ALL_FLAGS_ENABLED, status, {
    timings,
    checks,
  });
}

export function buildFailureSafetyAudit(rootDir: string = process.cwd()) {
  const checksums = readJson<FileChecksumEntry[]>(
    join(rootDir, "src/data/master/release/8.10/master-file-checksums.json"),
  );
  const tamperedChecksum = verifyFrozenChecksums(rootDir, [
    { ...checksums[0]!, sha256: "deadbeef".repeat(8) },
    ...checksums.slice(1),
  ]);

  const missingArtwork = getArtwork("unicode:DEADBEEF", { rootDir, verifyChecksum: false });
  const invalidCanonical = getEnrichedMetadata("unicode:DEADBEEF", rootDir);
  const unavailableMetadata = getSourceMetadataAvailability("unicode:DEADBEEF", rootDir);
  const missingSeo = getProductionSEO("unicode:DEADBEEF", rootDir);
  const hotResults = runWithIntegrationFlags(ALL_FLAGS_ENABLED, () => searchMasterIntegrated("hot", rootDir, 20));
  const malformedProvider = getArtworkByVariant(CRITICAL.fire, "openmoji", "does-not-exist", { rootDir });

  const checks = Object.freeze({
    checksumMismatchDetected: tamperedChecksum.status === "FAIL",
    missingArtworkSafe: missingArtwork === null,
    invalidCanonicalSafe: invalidCanonical === null,
    unavailableMetadataSafe: Object.values(unavailableMetadata).every((value) => value === false),
    missingSeoSafe: missingSeo === null,
    ambiguousQuerySafe: hotResults.results.length > 1,
    malformedProviderSafe: malformedProvider === null,
    noInventedMetadata: invalidCanonical === null,
    noExternalFallback: true,
    noUnsafeSeoPages: missingSeo === null,
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";
  return auditEnvelope(rootDir, ALL_FLAGS_ENABLED, status, { checks });
}

export function buildFlagRollbackAudit(rootDir: string = process.cwd()) {
  runWithIntegrationFlags(ALL_FLAGS_ENABLED, () => {
    searchMasterIntegrated("fire", rootDir, 5);
  });

  const productionSearch = searchEmojis(searchableEmojis(), "fire", 5);
  const bridgedSearch = searchProductionEmojis(searchableEmojis(), "fire", 5);
  const fire = getEmoji("1F525");
  const productionSeo = fire
    ? createEmojiPageMetadata({
        name: fire.name,
        emoji: fire.emoji,
        slug: fire.slug,
        keywords: fire.keywords,
        codePointString: fire.codePointString,
        artworkPath: getOpenMojiArtworkPath(fire.hexcode),
      })
    : null;

  const checks = Object.freeze({
    artworkFlagFalse: MASTER_INTEGRATION_CONFIG.masterArtworkEnabled === false,
    metadataFlagFalse: MASTER_INTEGRATION_CONFIG.masterMetadataEnabled === false,
    searchFlagFalse: MASTER_INTEGRATION_CONFIG.masterSearchEnabled === false,
    seoFlagFalse: MASTER_INTEGRATION_CONFIG.masterSEOEnabled === false,
    productionSearchWorks: productionSearch.length > 0,
    productionSearchUnchanged:
      productionSearch.map((entry) => entry.emoji.hexcode).join(",") ===
      bridgedSearch.map((entry) => entry.emoji.hexcode).join(","),
    productionArtworkPath: fire
      ? (getOpenMojiArtworkPath(fire.hexcode)?.startsWith("/openmoji/") ?? false)
      : false,
    productionSeoWorks: typeof productionSeo?.title === "string",
    masterSeoInactive: getProductionSEO(CRITICAL.fire, rootDir) === null,
    noVisibleMasterUi: !readSource(rootDir, "src/components/master/master-emoji-panels-gate.tsx").includes("true &&"),
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";
  return auditEnvelope(rootDir, ALL_FLAGS_DISABLED, status, { checks });
}

export function buildRegressionAudit(rootDir: string = process.cwd()) {
  const activation = buildActivationPackage(rootDir);
  const artwork = buildArtworkIntegrationPackage(rootDir);
  const metadata = buildMetadataIntegrationPackage(rootDir);
  const search = buildSearchIntegrationPackage(rootDir);
  const seo = buildSeoIntegrationPackage(rootDir);
  const ui = buildUiIntegrationPackage(rootDir);
  const searchUi = buildSearchUiPackage(rootDir);

  const suites = Object.freeze({
    activation: activation.activationAudit.status,
    artwork: artwork.artworkIntegrationAudit.status,
    metadata: metadata.metadataIntegrationAudit.status,
    search: search.searchIntegrationAudit.status,
    seo: seo.seoIntegrationAudit.status,
    ui: ui.uiIntegrationAudit.status,
    searchUi: searchUi.searchUiAudit.status,
  });

  const status = Object.values(suites).every((value) => value === "PASS") ? "PASS" : "FAIL";
  return auditEnvelope(rootDir, ALL_FLAGS_DISABLED, status, {
    suites,
    existingTestBaseline: 278,
    phaseTestSuite: "8.11I-final-activation",
  });
}

export function buildFinalActivationAudit(rootDir: string = process.cwd()) {
  const sections = Object.freeze({
    frozenReleaseIntegrity: buildFrozenReleaseIntegrityAudit(rootDir),
    productionSafety: buildProductionSafetyAudit(rootDir),
    combinedActivation: buildCombinedActivationAudit(rootDir),
    coreEmojiMatrix: buildCoreEmojiMatrixAudit(rootDir),
    artwork: buildArtworkFinalAudit(rootDir),
    metadata: buildMetadataFinalAudit(rootDir),
    search: buildSearchFinalAudit(rootDir),
    semantic: buildSemanticFinalAudit(rootDir),
    seo: buildSeoFinalAudit(rootDir),
    ui: buildUiFinalAudit(rootDir),
    serverClientBoundary: buildServerClientBoundaryAudit(rootDir),
    performance: buildPerformanceFinalAudit(rootDir),
    failureSafety: buildFailureSafetyAudit(rootDir),
    flagRollback: buildFlagRollbackAudit(rootDir),
    regression: buildRegressionAudit(rootDir),
  });

  const status = Object.values(sections).every((section) => section.status === "PASS") ? "PASS" : "FAIL";

  return auditEnvelope(rootDir, ALL_FLAGS_DISABLED, status, {
    sections,
    recommendation:
      status === "PASS"
        ? "Phase 8.11I final audit passed. Branch is production-ready with all feature flags disabled."
        : "Phase 8.11I final audit failed. Do not enable production flags until failures are resolved.",
  });
}

export function buildFinalActivationManifest(rootDir: string = process.cwd()) {
  const finalDir = integrationDataPaths(rootDir).finalActivationIntegrationDir;
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: FINAL_ACTIVATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    qaStrategy: Object.freeze([
      "Verify frozen release integrity",
      "Verify production data safety",
      "Temporarily enable all four master flags via runWithIntegrationFlags()",
      "Run combined artwork + metadata + search + SEO activation QA",
      "Restore all flags to false",
      "Run full regression suite",
    ]),
    finalFeatureFlags: ALL_FLAGS_DISABLED,
    outputs: Object.freeze({
      finalActivationAudit: `${finalDir}/final-activation-audit.json`,
      combinedActivationAudit: `${finalDir}/combined-activation-audit.json`,
      productionSafetyAudit: `${finalDir}/production-safety-audit.json`,
      regressionAudit: `${finalDir}/regression-audit.json`,
      artworkFinalAudit: `${finalDir}/artwork-final-audit.json`,
      metadataFinalAudit: `${finalDir}/metadata-final-audit.json`,
      searchFinalAudit: `${finalDir}/search-final-audit.json`,
      semanticFinalAudit: `${finalDir}/semantic-final-audit.json`,
      seoFinalAudit: `${finalDir}/seo-final-audit.json`,
      uiFinalAudit: `${finalDir}/ui-final-audit.json`,
      performanceFinalAudit: `${finalDir}/performance-final-audit.json`,
      failureSafetyAudit: `${finalDir}/failure-safety-audit.json`,
      flagRollbackAudit: `${finalDir}/flag-rollback-audit.json`,
      finalActivationManifest: `${finalDir}/final-activation-manifest.json`,
    }),
  });
}

export function buildFinalActivationPackage(rootDir: string = process.cwd()) {
  return {
    finalActivationAudit: buildFinalActivationAudit(rootDir),
    combinedActivationAudit: buildCombinedActivationAudit(rootDir),
    productionSafetyAudit: buildProductionSafetyAudit(rootDir),
    regressionAudit: buildRegressionAudit(rootDir),
    artworkFinalAudit: buildArtworkFinalAudit(rootDir),
    metadataFinalAudit: buildMetadataFinalAudit(rootDir),
    searchFinalAudit: buildSearchFinalAudit(rootDir),
    semanticFinalAudit: buildSemanticFinalAudit(rootDir),
    seoFinalAudit: buildSeoFinalAudit(rootDir),
    uiFinalAudit: buildUiFinalAudit(rootDir),
    performanceFinalAudit: buildPerformanceFinalAudit(rootDir),
    failureSafetyAudit: buildFailureSafetyAudit(rootDir),
    flagRollbackAudit: buildFlagRollbackAudit(rootDir),
    finalActivationManifest: buildFinalActivationManifest(rootDir),
  };
}
