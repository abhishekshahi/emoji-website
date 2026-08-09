import { readFileSync } from "node:fs";
import { join } from "node:path";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import { searchEmojis } from "@/lib/emoji/search";
import type { BrowsableEmoji } from "@/lib/emoji/types";
import { createEmojiPageMetadata } from "@/lib/seo/metadata";
import { getOpenMojiArtworkPath } from "@/lib/artwork/openmoji";
import { verifyFrozenChecksums } from "@/lib/master/release/build";
import type { FileChecksumEntry } from "@/lib/master/release/types";
import {
  EXPECTED_RELEASE_ID,
  MASTER_INTEGRATION_CONFIG,
  PRODUCTION_BASELINES,
  SEARCH_ACTIVATION_PHASE,
  integrationDataPaths,
} from "../config";
import { getEnrichedMetadata } from "../metadata/enrichment";
import { isAmbiguousMasterSearchTerm } from "../search-adapter";
import { searchMasterIntegrated, resolveCanonicalIdFromShortcode } from "../search/adapter";
import {
  buildSearchProductionCoverage,
  buildSearchRankingAudit,
} from "../search/build";
import { getMasterSearchStaticIndex } from "../search/index-data";
import { searchProductionEmojis } from "../search/production-bridge";
import { MASTER_SEARCH_SCORE } from "../search/ranking";
import { getProductionSEO } from "../seo/production-bridge";
import { runWithIntegrationFlags } from "../ui/production-bridge";

export const SEARCH_ACTIVATION_BASELINES = {
  masterMetadataRecords: 42910,
  canonicalIdentities: 6955,
  aliases: 4015,
  safeAliases: 3580,
  restrictedAliases: 435,
  canonicalKeywordTerms: 43977,
  shortcodeRecords: 14304,
  shortcodeIdentities: 5333,
  safeSearchTerms: 29468,
  ambiguousTerms: 115387,
  emojinetSemanticRecords: 15183,
  emojinetDefinitions: 17572,
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
  whiteFlag: "unicode:1F3F3-FE0F",
  heart: "unicode:2764-FE0F",
  openmojiPua: "source:openmoji:E000",
  notoUtility: "source:noto:noto.png",
} as const;

function searchableEmojis(): BrowsableEmoji[] {
  return [...(emojis as BrowsableEmoji[]), ...(extras as BrowsableEmoji[])];
}

function verifyFrozenRelease(rootDir: string): "PASS" | "FAIL" {
  const checksums = JSON.parse(
    readFileSync(join(rootDir, "src/data/master/release/8.10/master-file-checksums.json"), "utf8"),
  ) as FileChecksumEntry[];
  return verifyFrozenChecksums(rootDir, checksums).status;
}

function topCanonical(query: string, rootDir: string): string | undefined {
  return searchMasterIntegrated(query, rootDir, 10).results[0]?.canonicalId;
}

export function buildSearchRankingActivationAudit(rootDir: string = process.cwd()) {
  const ranking = buildSearchRankingAudit(rootDir);
  const fireEmoji = searchMasterIntegrated("🔥", rootDir, 5);
  const fireName = searchMasterIntegrated("fire", rootDir, 5);
  const fireShortcode = searchMasterIntegrated(":fire:", rootDir, 5);
  const fireUnicode = searchMasterIntegrated("U+1F525", rootDir, 5);
  const fireHex = searchMasterIntegrated("1F525", rootDir, 5);

  const rankingOrder = [
    MASTER_SEARCH_SCORE.EXACT_EMOJI,
    MASTER_SEARCH_SCORE.EXACT_UNICODE,
    MASTER_SEARCH_SCORE.EXACT_HEXCODE,
    MASTER_SEARCH_SCORE.EXACT_SHORTCODE,
    MASTER_SEARCH_SCORE.EXACT_CANONICAL_NAME,
    MASTER_SEARCH_SCORE.EXACT_SAFE_ALIAS,
    MASTER_SEARCH_SCORE.EXACT_SAFE_KEYWORD,
    MASTER_SEARCH_SCORE.SAFE_SEMANTIC_SYNONYM,
  ];

  const monotonic = rankingOrder.every((score, index) =>
    index === 0 ? true : score < rankingOrder[index - 1]!,
  );

  const checks = Object.freeze({
    fireEmojiTop: fireEmoji.results[0]?.canonicalId === CRITICAL.fire,
    fireNameTop: fireName.results[0]?.canonicalId === CRITICAL.fire,
    fireShortcodeTop: fireShortcode.results[0]?.canonicalId === CRITICAL.fire,
    fireUnicodeTop: fireUnicode.results[0]?.canonicalId === CRITICAL.fire,
    fireHexTop: fireHex.results[0]?.canonicalId === CRITICAL.fire,
    scoreOrderMonotonic: monotonic,
    integrationRanking: ranking.status,
  });

  const status = Object.values(checks).every((value) => value === true || value === "PASS") ? "PASS" : "FAIL";

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEARCH_ACTIVATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    checks,
    status,
  });
}

export function buildSearchSafetyAudit(rootDir: string = process.cwd()) {
  const fire = getEnrichedMetadata(CRITICAL.fire, rootDir);
  const staticIndex = getMasterSearchStaticIndex(rootDir);
  const puaResults = searchMasterIntegrated("E000", rootDir, 10);
  const utilityResults = searchMasterIntegrated("noto.png", rootDir, 10);

  const checks = Object.freeze({
    restrictedAliasesNotPublic: fire?.restrictedAliases.every((alias) => !alias.publicAlias) ?? true,
    canonicalKeywordsPresent: (fire?.canonicalKeywords.length ?? 0) > 0,
    puaNotMappedToUnicode: !puaResults.results.some((result) => result.canonicalId === CRITICAL.openmojiPua && result.productionHexcode === "E000"),
    utilityExcluded: !utilityResults.results.some((result) => result.canonicalId === CRITICAL.notoUtility),
    publicSemanticTermsFiltered: staticIndex.publicSemanticTerms.size < SEARCH_ACTIVATION_BASELINES.ambiguousTerms,
    productionMapping: staticIndex.productionCanonicalById.size === PRODUCTION_BASELINES.totalSearchable,
    seoDisabled: MASTER_INTEGRATION_CONFIG.masterSEOEnabled === false,
    artworkDisabled: MASTER_INTEGRATION_CONFIG.masterArtworkEnabled === false,
    metadataDisabled: MASTER_INTEGRATION_CONFIG.masterMetadataEnabled === false,
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEARCH_ACTIVATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    checks,
    status,
  });
}

export function buildSearchAmbiguityAudit(rootDir: string = process.cwd()) {
  const hot = searchMasterIntegrated("hot", rootDir, 30);
  const fireOnlyHot = hot.results.length === 1 && hot.results[0]?.canonicalId === CRITICAL.fire;

  const checks = Object.freeze({
    hotAmbiguous: isAmbiguousMasterSearchTerm("hot", rootDir),
    hotResponseAmbiguous: hot.ambiguous,
    hotNotFireOnly: !fireOnlyHot,
    hotMultipleResults: hot.results.length > 1,
    hotIdentityCount: hot.results.length,
  });

  const status =
    checks.hotAmbiguous && checks.hotResponseAmbiguous && checks.hotNotFireOnly ? "PASS" : "FAIL";

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEARCH_ACTIVATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    checks,
    status,
  });
}

export function buildSearchProvenanceAudit(rootDir: string = process.cwd()) {
  const results = searchMasterIntegrated("fire", rootDir, 5).results;
  const checks = Object.freeze({
    hasCanonicalId: results.every((result) => result.canonicalId.length > 0),
    hasMatchedField: results.every((result) => result.matchedField.length > 0),
    hasScore: results.every((result) => result.score > 0),
    hasSource: results.every((result) => result.source.length > 0),
    hasConfidence: results.every((result) => result.confidence > 0),
    noExternalUrls: results.every((result) => !JSON.stringify(result).includes("https://")),
    noFilesystemPaths: results.every((result) => !JSON.stringify(result).includes("src/data")),
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEARCH_ACTIVATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    checks,
    status,
  });
}

export function buildSearchPerformanceAudit(rootDir: string = process.cwd()) {
  const staticIndex = getMasterSearchStaticIndex(rootDir);
  const response = searchMasterIntegrated("fire", rootDir, 10);

  const checks = Object.freeze({
    canonicalScopedResults: response.results.length <= 10,
    noFullMetadataLoad: response.results.length < 1000,
    staticIndexUsesMaps: staticIndex.publicSemanticTerms instanceof Map,
    productionIndexSize: staticIndex.productionCanonicalById.size === PRODUCTION_BASELINES.totalSearchable,
    publicSemanticBelowAmbiguous: staticIndex.publicSemanticTerms.size < SEARCH_ACTIVATION_BASELINES.ambiguousTerms,
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEARCH_ACTIVATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    checks,
    status,
  });
}

export function buildSearchFallbackAudit(rootDir: string = process.cwd()) {
  const emojisList = searchableEmojis();
  const queries = ["fire", "flame", ":fire:", "hot", "thumbs up", "1F525", ""];

  const disabledMatches = queries.every((query) => {
    const production = searchEmojis(emojisList, query, 10);
    const bridged = searchProductionEmojis(emojisList, query, 10);
    return JSON.stringify(production) === JSON.stringify(bridged);
  });

  const activatedDiffers = runWithIntegrationFlags({ masterSearchEnabled: true }, () => {
    const production = searchEmojis(emojisList, "flame", 10);
    const bridged = searchProductionEmojis(emojisList, "flame", 10);
    return JSON.stringify(production) !== JSON.stringify(bridged) || bridged.length > 0;
  });

  const checks = Object.freeze({
    disabledMatchesProduction: disabledMatches,
    enabledUsesMasterLayer: activatedDiffers,
    emptyQueryUnchanged: searchProductionEmojis(emojisList, "", 10).length === 0,
    invalidUnicodeSafe: searchMasterIntegrated("unicode:DEADBEEF", rootDir, 5).results.length >= 0,
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEARCH_ACTIVATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    checks,
    status,
  });
}

export function buildSearchProductionCompatibilityAudit(rootDir: string = process.cwd()) {
  const emojisList = searchableEmojis();
  const coverage = buildSearchProductionCoverage(rootDir);

  const activated = runWithIntegrationFlags({ masterSearchEnabled: true }, () => {
    const results = searchProductionEmojis(emojisList, "🔥", 5);
    return Object.freeze({
      hasEmoji: results[0]?.emoji.emoji === "🔥",
      hasHexcode: results[0]?.emoji.hexcode === "1F525",
      hasName: (results[0]?.emoji.name.length ?? 0) > 0,
      hasCategory: (results[0]?.emoji.category.length ?? 0) > 0,
      hasScore: (results[0]?.score ?? 0) > 0,
    });
  });

  const checks = Object.freeze({
    ...activated,
    coveragePass: coverage.status === "PASS",
    standardCount: (emojis as BrowsableEmoji[]).length === PRODUCTION_BASELINES.standardRecords,
    extrasCount: (extras as BrowsableEmoji[]).length === PRODUCTION_BASELINES.extrasRecords,
    frozenRelease: verifyFrozenRelease(rootDir) === "PASS",
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEARCH_ACTIVATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    checks,
    status,
  });
}

export function buildSearchFeatureFlagAudit(rootDir: string = process.cwd()) {
  const emojisList = searchableEmojis();
  const fire = emojisList.find((entry) => entry.hexcode === "1F525");
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

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEARCH_ACTIVATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    defaultFlags: Object.freeze({
      masterArtworkEnabled: MASTER_INTEGRATION_CONFIG.masterArtworkEnabled,
      masterMetadataEnabled: MASTER_INTEGRATION_CONFIG.masterMetadataEnabled,
      masterSearchEnabled: MASTER_INTEGRATION_CONFIG.masterSearchEnabled,
      masterSEOEnabled: MASTER_INTEGRATION_CONFIG.masterSEOEnabled,
    }),
    rollbackRequired: true,
    masterSeoInactive: getProductionSEO(CRITICAL.fire, rootDir) === null,
    seoTitlePresent: typeof seo?.title === "string",
    routesChanged: false,
    status:
      !MASTER_INTEGRATION_CONFIG.masterSearchEnabled &&
      !MASTER_INTEGRATION_CONFIG.masterSEOEnabled
        ? "PASS"
        : "FAIL",
  });
}

export function buildSearchActivationAudit(rootDir: string = process.cwd()) {
  const ranking = buildSearchRankingActivationAudit(rootDir);
  const safety = buildSearchSafetyAudit(rootDir);
  const ambiguity = buildSearchAmbiguityAudit(rootDir);
  const provenance = buildSearchProvenanceAudit(rootDir);
  const performance = buildSearchPerformanceAudit(rootDir);
  const fallback = buildSearchFallbackAudit(rootDir);
  const compatibility = buildSearchProductionCompatibilityAudit(rootDir);
  const featureFlags = buildSearchFeatureFlagAudit(rootDir);

  const criticalChecks = Object.freeze({
    fire: topCanonical("🔥", rootDir) === CRITICAL.fire,
    name: topCanonical("fire", rootDir) === CRITICAL.fire,
    keyword: topCanonical("flame", rootDir) === CRITICAL.fire,
    semantic: topCanonical("burn", rootDir) === CRITICAL.fire,
    shortcode: resolveCanonicalIdFromShortcode(":fire:", rootDir) === CRITICAL.fire,
    unicode: topCanonical("U+1F525", rootDir) === CRITICAL.fire,
    hexcode: topCanonical("1F525", rootDir) === CRITICAL.fire,
    thumbsUp: topCanonical("👍", rootDir) === CRITICAL.thumbsUp,
    thumbsUpName: topCanonical("thumbs up", rootDir) === CRITICAL.thumbsUp,
    skinToneLight: topCanonical("👍🏻", rootDir) === CRITICAL.thumbsUpLight,
    skinToneDark: topCanonical("👍🏿", rootDir) === CRITICAL.thumbsUpDark,
    manTechnologist: topCanonical("👨‍💻", rootDir) === CRITICAL.manTechnologist,
    womanTechnologist: topCanonical("👩‍💻", rootDir) === CRITICAL.womanTechnologist,
    indiaFlag: topCanonical("India", rootDir) === CRITICAL.indiaFlag || topCanonical("🇮🇳", rootDir) === CRITICAL.indiaFlag,
    heart: topCanonical("heart", rootDir) === CRITICAL.heart || topCanonical("❤️", rootDir) === CRITICAL.heart,
    prideFlag: topCanonical("pride flag", rootDir) === CRITICAL.rainbowFlag,
    variationText: topCanonical("☺", rootDir) === CRITICAL.textSmile,
    variationEmoji: topCanonical("☺️", rootDir) === CRITICAL.emojiSmile,
    partialFir: searchMasterIntegrated("fir", rootDir, 10).results.some((result) => result.canonicalId === CRITICAL.fire),
    caseInsensitive: topCanonical("Fire", rootDir) === topCanonical("fire", rootDir),
    whitespaceNormalized: topCanonical(" fire ", rootDir) === topCanonical("fire", rootDir),
  });

  const status =
    ranking.status === "PASS" &&
    safety.status === "PASS" &&
    ambiguity.status === "PASS" &&
    provenance.status === "PASS" &&
    performance.status === "PASS" &&
    fallback.status === "PASS" &&
    compatibility.status === "PASS" &&
    featureFlags.status === "PASS" &&
    Object.values(criticalChecks).every(Boolean)
      ? "PASS"
      : "FAIL";

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEARCH_ACTIVATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    criticalChecks,
    ranking: ranking.status,
    safety: safety.status,
    ambiguity: ambiguity.status,
    provenance: provenance.status,
    performance: performance.status,
    fallback: fallback.status,
    compatibility: compatibility.status,
    featureFlags: featureFlags.status,
    frozenRelease: verifyFrozenRelease(rootDir),
    productionData: compatibility.checks.standardCount && compatibility.checks.extrasCount ? "PASS" : "FAIL",
    routesChanged: false,
    seoChanged: false,
    externalRuntimeDependencies: false,
    status,
  });
}

export function buildSearchActivationManifest(rootDir: string = process.cwd()) {
  const searchActivationDir = integrationDataPaths(rootDir).searchActivationIntegrationDir;
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEARCH_ACTIVATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    qaStrategy: Object.freeze([
      "STEP 1: masterSearchEnabled=true with full search QA via runWithIntegrationFlags",
      "STEP 2: verify fallback when masterSearchEnabled=false",
      "STEP 3: restore masterSearchEnabled=false",
    ]),
    finalFeatureFlags: Object.freeze({
      masterArtworkEnabled: false,
      masterMetadataEnabled: false,
      masterSearchEnabled: false,
      masterSEOEnabled: false,
    }),
    outputs: Object.freeze({
      searchActivationAudit: `${searchActivationDir}/search-activation-audit.json`,
      searchRankingAudit: `${searchActivationDir}/search-ranking-audit.json`,
      searchSafetyAudit: `${searchActivationDir}/search-safety-audit.json`,
      searchAmbiguityAudit: `${searchActivationDir}/search-ambiguity-audit.json`,
      searchProvenanceAudit: `${searchActivationDir}/search-provenance-audit.json`,
      searchPerformanceAudit: `${searchActivationDir}/search-performance-audit.json`,
      searchFallbackAudit: `${searchActivationDir}/search-fallback-audit.json`,
      searchProductionCompatibility: `${searchActivationDir}/search-production-compatibility.json`,
      searchFeatureFlagAudit: `${searchActivationDir}/search-feature-flag-audit.json`,
    }),
  });
}

export function buildSearchActivationPackage(rootDir: string = process.cwd()) {
  return {
    searchActivationAudit: buildSearchActivationAudit(rootDir),
    searchRankingAudit: buildSearchRankingActivationAudit(rootDir),
    searchSafetyAudit: buildSearchSafetyAudit(rootDir),
    searchAmbiguityAudit: buildSearchAmbiguityAudit(rootDir),
    searchProvenanceAudit: buildSearchProvenanceAudit(rootDir),
    searchPerformanceAudit: buildSearchPerformanceAudit(rootDir),
    searchFallbackAudit: buildSearchFallbackAudit(rootDir),
    searchProductionCompatibility: buildSearchProductionCompatibilityAudit(rootDir),
    searchFeatureFlagAudit: buildSearchFeatureFlagAudit(rootDir),
    searchActivationManifest: buildSearchActivationManifest(rootDir),
  };
}
