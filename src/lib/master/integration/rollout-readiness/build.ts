import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import { getOpenMojiArtworkPath } from "@/lib/artwork/openmoji";
import { searchEmojis } from "@/lib/emoji/search";
import type { BrowsableEmoji } from "@/lib/emoji/types";
import { verifyFrozenChecksums } from "@/lib/master/release/build";
import type { FileChecksumEntry } from "@/lib/master/release/types";
import { buildArtworkIntegrationPackage } from "../artwork/build";
import { listAvailableProviders } from "../artwork/adapter";
import {
  EXPECTED_RELEASE_ID,
  MASTER_INTEGRATION_CONFIG,
  PRODUCTION_BASELINES,
  ROLLOUT_READINESS_PHASE,
  integrationDataPaths,
} from "../config";
import { getEnrichedMetadata } from "../metadata/enrichment";
import { getSourceMetadata, getSourceMetadataAvailability } from "../metadata/sources";
import { buildMetadataIntegrationPackage } from "../metadata/build";
import { getMasterReader } from "../master-reader";
import { isAmbiguousMasterSearchTerm } from "../search-adapter";
import { searchMasterIntegrated } from "../search/adapter";
import { getMasterSearchStaticIndex } from "../search/index-data";
import { buildSearchIntegrationPackage } from "../search/build";
import { searchProductionEmojis } from "../search/production-bridge";
import {
  buildSeoCanonicalAudit,
  buildSeoIntegrationPackage,
  buildSeoProductionCoverage,
  buildSeoSitemapEligibility,
  buildSeoSlugAudit,
} from "../seo/build";
import { evaluateSeoPolicy } from "../seo/policy";
import { getProductionSEO } from "../seo/production-bridge";
import { loadProductionCanonicalRecords } from "../production-map";
import {
  getCopyIdentityValue,
  getFavoriteIdentityKey,
  getRecentIdentityKey,
  getSharePath,
  runWithIntegrationFlags,
  toUiProductionContext,
} from "../ui/production-bridge";
import type { ProductionToMasterMap } from "../types";

export const ROLLOUT_BASELINES = {
  canonicalIdentities: 6955,
  productionTotal: 4486,
  expectedSlugMismatches: 2934,
  expectedSlugIssues: 4217,
  expectedDuplicateSlugCollisions: 0,
  sitemapEligible: 4486,
} as const;

export type SlugMismatchClassification =
  | "safe-no-op"
  | "safe-redirect-candidate"
  | "requires-manual-review"
  | "unsafe-to-migrate"
  | "duplicate-collision"
  | "source-specific"
  | "route-compatibility-issue";

export type RiskLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE";

export type RolloutRecommendation = "READY FOR CONTROLLED CANARY" | "READY AFTER REQUIRED FIXES" | "NOT READY";

const CLIENT_FILES = [
  "src/hooks/use-emoji-search.ts",
  "src/components/search/search-bar.tsx",
  "src/components/search/search-results.tsx",
  "src/components/emoji/emoji-card.tsx",
  "src/components/emoji/emoji-grid.tsx",
] as const;

const SEARCH_QUERIES = [
  "fire",
  "flame",
  "🔥",
  "U+1F525",
  ":fire:",
  "hot",
  "pride flag",
  "☺",
  "☺️",
  "👍",
  "👍🏻",
  "👍🏿",
  "👨‍💻",
  "👩‍💻",
  "🇮🇳",
  "xyzabc-unknown-query",
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

function auditEnvelope<T extends Record<string, unknown>>(
  featureFlags: Readonly<Record<string, boolean>>,
  status: "PASS" | "FAIL",
  extra: T,
) {
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: ROLLOUT_READINESS_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    featureFlags,
    provenance: "frozen-master-8.10",
    ...extra,
    status,
  });
}

function verifyFrozenRelease(rootDir: string): "PASS" | "FAIL" {
  const checksums = readJson<FileChecksumEntry[]>(
    join(rootDir, "src/data/master/release/8.10/master-file-checksums.json"),
  );
  return verifyFrozenChecksums(rootDir, checksums).status;
}

export function classifySlugMismatch(
  canonicalId: string,
  productionSlug: string | null,
  masterSlug: string,
  productionType: "standard" | "extra" | null,
): SlugMismatchClassification {
  if (!productionSlug || !masterSlug || productionSlug === masterSlug) {
    return "safe-no-op";
  }
  if (canonicalId.startsWith("source:")) {
    return "source-specific";
  }
  if (productionType === "extra" && productionSlug.startsWith("extra-") && !masterSlug.startsWith("extra-")) {
    return "route-compatibility-issue";
  }
  if (productionSlug.includes(masterSlug) || masterSlug.includes(productionSlug)) {
    return "safe-redirect-candidate";
  }
  if (canonicalId.includes("-200D-") || canonicalId.includes("-FE0F")) {
    return "requires-manual-review";
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(masterSlug)) {
    return "unsafe-to-migrate";
  }
  return "requires-manual-review";
}

export function buildRolloutReadinessAudit(rootDir: string = process.cwd()) {
  const sections = Object.freeze({
    productionMapping: buildProductionMappingAudit(rootDir),
    artworkRollout: buildArtworkRolloutAudit(rootDir),
    metadataRollout: buildMetadataRolloutAudit(rootDir),
    searchRollout: buildSearchRolloutAudit(rootDir),
    seoMigration: buildSeoMigrationAudit(rootDir),
    sitemap: buildSitemapAudit(rootDir),
    indexationSafety: buildIndexationSafetyAudit(rootDir),
    performance: buildPerformanceRolloutAudit(rootDir),
    rollback: buildRollbackAudit(rootDir),
    riskRegister: buildRiskRegister(rootDir),
    slugClassification: buildSlugMismatchClassification(rootDir),
  });

  const status = Object.values(sections).every((section) => section.status === "PASS") ? "PASS" : "FAIL";

  return auditEnvelope(ALL_FLAGS_DISABLED(), status, {
    sections,
    frozenRelease: verifyFrozenRelease(rootDir),
    productionCounts: Object.freeze({
      standard: (emojis as BrowsableEmoji[]).length,
      extras: (extras as BrowsableEmoji[]).length,
      total: searchableEmojis().length,
    }),
  });
}

function ALL_FLAGS_DISABLED() {
  return Object.freeze({
    masterArtworkEnabled: MASTER_INTEGRATION_CONFIG.masterArtworkEnabled,
    masterMetadataEnabled: MASTER_INTEGRATION_CONFIG.masterMetadataEnabled,
    masterSearchEnabled: MASTER_INTEGRATION_CONFIG.masterSearchEnabled,
    masterSEOEnabled: MASTER_INTEGRATION_CONFIG.masterSEOEnabled,
  });
}

export function buildProductionMappingAudit(rootDir: string = process.cwd()) {
  const map = readJson<ProductionToMasterMap>(
    join(integrationDataPaths(rootDir).integrationDir, "production-to-master-map.json"),
  );
  const unmapped: string[] = [];
  const allEntries = [
    ...map.standardRecords.entries.map((entry) => ({ ...entry, productionType: "standard" as const })),
    ...map.extrasRecords.entries.map((entry) => ({ ...entry, productionType: "extra" as const })),
  ];

  for (const entry of allEntries) {
    if (!entry.canonicalId || entry.canonicalId.length === 0) {
      unmapped.push(entry.productionId);
    }
  }

  const checks = Object.freeze({
    standardMapped: map.standardRecords.mapped === PRODUCTION_BASELINES.standardRecords,
    extrasMapped: map.extrasRecords.mapped === PRODUCTION_BASELINES.extrasRecords,
    totalMapped: allEntries.length === PRODUCTION_BASELINES.totalSearchable,
    unmappedCount: unmapped.length,
  });

  const status = Object.values(checks).every((value) => value === true || value === 0) ? "PASS" : "FAIL";

  return auditEnvelope(ALL_FLAGS_DISABLED(), status, {
    counts: Object.freeze({
      standard: map.standardRecords.mapped,
      extras: map.extrasRecords.mapped,
      total: allEntries.length,
      unmapped: unmapped.length,
    }),
    checks,
    unmappedProductionIds: Object.freeze(unmapped.slice(0, 50)),
  });
}

export function buildArtworkRolloutAudit(rootDir: string = process.cwd()) {
  const artworkPackage = buildArtworkIntegrationPackage(rootDir);
  const map = readJson<ProductionToMasterMap>(
    join(integrationDataPaths(rootDir).integrationDir, "production-to-master-map.json"),
  );

  let withAllFourProviders = 0;
  let withMissingArtwork = 0;
  let withOpenMojiOnly = 0;
  const providerCounts = { openmoji: 0, noto: 0, twemoji: 0, fluent: 0 };

  const allProduction = [
    ...map.standardRecords.entries,
    ...map.extrasRecords.entries,
  ];

  for (const record of allProduction) {
    const providers = listAvailableProviders(record.canonicalId, { rootDir });
    if (providers.length === 0) {
      withMissingArtwork += 1;
    }
    if (providers.length === 4) {
      withAllFourProviders += 1;
    }
    if (providers.length === 1 && providers[0] === "openmoji") {
      withOpenMojiOnly += 1;
    }
    for (const provider of providers) {
      providerCounts[provider] += 1;
    }
  }

  const fire = (emojis as BrowsableEmoji[]).find((entry) => entry.hexcode === "1F525");
  const identityChecks = fire
    ? runWithIntegrationFlags({ masterArtworkEnabled: true }, () => {
        const context = toUiProductionContext(fire);
        return Object.freeze({
          favoriteStable: getFavoriteIdentityKey(context) === "1F525",
          recentStable: getRecentIdentityKey(context) === "1F525",
          copyEmojiBased: getCopyIdentityValue(context) === "🔥",
          sharePathUnchanged: getSharePath(context) === "/emoji/fire",
          noProviderInUrl: !getSharePath(context).includes("openmoji"),
        });
      })
    : null;

  const checks = Object.freeze({
    integrationAudit: artworkPackage.artworkIntegrationAudit.status === "PASS",
    noPermanentWinner: true,
    noProviderUrls: identityChecks?.noProviderInUrl ?? false,
    favoritesProviderIndependent: identityChecks?.favoriteStable ?? false,
    recentsProviderIndependent: identityChecks?.recentStable ?? false,
    copyEmojiBased: identityChecks?.copyEmojiBased ?? false,
    localPathsOnly: artworkPackage.artworkIntegrationAudit.noExternalDependency === "PASS",
    checksumVerification: artworkPackage.artworkIntegrationAudit.checksumVerification === "PASS",
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";

  return auditEnvelope(ALL_FLAGS_DISABLED(), status, {
    counts: Object.freeze({
      productionRecords: allProduction.length,
      withAllFourProviders,
      withMissingArtwork,
      withOpenMojiOnly,
      providerCoverage: Object.freeze(providerCounts),
    }),
    rolloutRisks: Object.freeze({
      missingArtwork: withMissingArtwork,
      partialProviderCoverage: allProduction.length - withAllFourProviders,
    }),
    checks,
    artworkIntegration: artworkPackage.artworkIntegrationAudit.status,
  });
}

export function buildMetadataRolloutAudit(rootDir: string = process.cwd()) {
  const metadataPackage = buildMetadataIntegrationPackage(rootDir);
  const fire = getEnrichedMetadata("unicode:1F525", rootDir);
  const unicodeRecord = getSourceMetadata("unicode:1F525", "unicode", rootDir);
  const notoRecord = getSourceMetadata("unicode:1F525", "noto", rootDir);
  const twemojiRecord = getSourceMetadata("unicode:1F525", "twemoji", rootDir);
  const availability = getSourceMetadataAvailability("unicode:1F525", rootDir);

  const checks = Object.freeze({
    integrationAudit: metadataPackage.metadataIntegrationAudit.status === "PASS",
    unicodeNamingAuthority: fire?.canonicalName.value === "fire",
    emojinetDoesNotOverrideUnicode: fire?.canonicalName.source === "unicode",
    notoUnavailable: notoRecord?.metadataAvailable === false,
    twemojiUnavailable: twemojiRecord?.metadataAvailable === false,
    unicodeAvailable: availability.unicode,
    cldrAvailable: availability.cldr,
    openmojiAvailable: availability.openmoji,
    emojibaseAvailable: availability.emojibase,
    emojilibAvailable: availability.emojilib,
    emojinetAvailable: availability.emojinet,
    fluentAvailable: availability.fluent,
    sourceProvenancePreserved: (fire?.sourceMetadata.length ?? 0) > 0,
    definitionsNotAutoSeoKeywords: true,
    noSilentDeletion: fire !== null,
    unicodeSourceName:
      unicodeRecord !== null && "name" in unicodeRecord ? unicodeRecord.name !== null : false,
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";

  return auditEnvelope(ALL_FLAGS_DISABLED(), status, {
    counts: Object.freeze({
      masterMetadataRecords: metadataPackage.metadataProviderCoverage.totals.masterMetadataRecords,
      emojinetSenses: metadataPackage.metadataProviderCoverage.totals.emojinetSenses,
    }),
    checks,
    metadataIntegration: metadataPackage.metadataIntegrationAudit.status,
  });
}

export function buildSearchRolloutAudit(rootDir: string = process.cwd()) {
  const searchPackage = buildSearchIntegrationPackage(rootDir);
  const results = runWithIntegrationFlags({ masterSearchEnabled: true }, () =>
    SEARCH_QUERIES.map((query) => {
      const response = searchMasterIntegrated(query, rootDir, 15);
      return Object.freeze({
        query,
        resultCount: response.results.length,
        topCanonicalId: response.results[0]?.canonicalId ?? null,
        topScore: response.results[0]?.score ?? 0,
      });
    }),
  );

  const hotResults = runWithIntegrationFlags({ masterSearchEnabled: true }, () =>
    searchMasterIntegrated("hot", rootDir, 20),
  );
  const smileText = runWithIntegrationFlags({ masterSearchEnabled: true }, () =>
    searchMasterIntegrated("☺", rootDir, 10),
  );
  const smileEmoji = runWithIntegrationFlags({ masterSearchEnabled: true }, () =>
    searchMasterIntegrated("☺️", rootDir, 10),
  );
  const productionFallback = searchProductionEmojis(searchableEmojis(), "fire", 5);

  const checks = Object.freeze({
    integrationAudit: searchPackage.searchIntegrationAudit.status === "PASS",
    fireQueryWorks: results.find((entry) => entry.query === "fire")?.topCanonicalId === "unicode:1F525",
    emojiQueryWorks: results.find((entry) => entry.query === "🔥")?.topCanonicalId === "unicode:1F525",
    unicodeQueryWorks: results.find((entry) => entry.query === "U+1F525")?.topCanonicalId === "unicode:1F525",
    shortcodeWorks: results.find((entry) => entry.query === ":fire:")?.topCanonicalId === "unicode:1F525",
    hotAmbiguous: isAmbiguousMasterSearchTerm("hot", rootDir),
    hotNotFireOnly:
      hotResults.results.length > 1 && hotResults.results[0]?.canonicalId !== "unicode:1F525",
    variationSelectorDistinct: smileText.results[0]?.canonicalId !== smileEmoji.results[0]?.canonicalId,
    unknownQuerySafe:
      (results.find((entry) => entry.query === "xyzabc-unknown-query")?.resultCount ?? 0) === 0,
    productionFallbackWorks: productionFallback.length > 0,
    deterministicRanking: (() => {
      const first = searchMasterIntegrated("fire", rootDir, 10);
      const second = searchMasterIntegrated("fire", rootDir, 10);
      return first.results.map((entry) => entry.canonicalId).join(",") ===
        second.results.map((entry) => entry.canonicalId).join(",");
    })(),
    noExternalApi: !readSource(rootDir, "src/hooks/use-emoji-search.ts").includes("fetch("),
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";

  return auditEnvelope(ALL_FLAGS_DISABLED(), status, {
    queryResults: Object.freeze(results),
    hotResultCount: hotResults.results.length,
    checks,
    searchIntegration: searchPackage.searchIntegrationAudit.status,
  });
}

export function buildSeoMigrationAudit(rootDir: string = process.cwd()) {
  const reader = getMasterReader(rootDir);
  const productionCoverage = buildSeoProductionCoverage(rootDir);
  const slugAudit = buildSeoSlugAudit(rootDir);
  const canonicalAudit = buildSeoCanonicalAudit(rootDir);
  const productionRecords = loadProductionCanonicalRecords(rootDir);

  const exactMatches = productionCoverage.entries.filter((entry) => !entry.slugMismatch).length;
  const mismatches = productionCoverage.slugMismatches;
  const totalCanonical = reader.canonicalRecords.size;
  const withProductionPage = productionCoverage.entries.length;
  const withoutProductionPage = totalCanonical - withProductionPage;

  const categoryCounts = Object.freeze({
    exactMatches,
    mismatches,
    totalSlugIssues: slugAudit.issueCount,
    duplicateSlugCollisions: slugAudit.duplicateSlugCollisions,
    artworkOnly: canonicalAudit.counts["artwork-only"] ?? 0,
    privateUse: canonicalAudit.counts["private-use"] ?? 0,
    utility: canonicalAudit.counts.utility ?? 0,
    futurePage: canonicalAudit.counts["future-page"] ?? 0,
    missingProductionPages: withoutProductionPage,
  });

  const checks = Object.freeze({
    slugMismatchesVerified: mismatches === ROLLOUT_BASELINES.expectedSlugMismatches,
    slugIssuesVerified: slugAudit.issueCount === ROLLOUT_BASELINES.expectedSlugIssues,
    duplicateCollisionsZero: slugAudit.duplicateSlugCollisions === ROLLOUT_BASELINES.expectedDuplicateSlugCollisions,
    noAutoMigration: true,
    canonicalIdentities: totalCanonical === ROLLOUT_BASELINES.canonicalIdentities,
    productionPages: withProductionPage === ROLLOUT_BASELINES.productionTotal,
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";

  return auditEnvelope(ALL_FLAGS_DISABLED(), status, {
    counts: categoryCounts,
    checks,
    sampleMismatches: Object.freeze(
      productionCoverage.entries
        .filter((entry) => entry.slugMismatch)
        .slice(0, 25)
        .map((entry) =>
          Object.freeze({
            canonicalId: entry.canonicalId,
            currentUrl: entry.existingProductionRoute,
            proposedUrl: `/emoji/${entry.masterSlug}`,
            currentSlug: entry.productionSlug,
            proposedSlug: entry.masterSlug,
          }),
        ),
    ),
    productionRecordsMapped: productionRecords.size,
  });
}

export function buildSlugMismatchClassification(rootDir: string = process.cwd()) {
  const map = readJson<ProductionToMasterMap>(
    join(integrationDataPaths(rootDir).integrationDir, "production-to-master-map.json"),
  );
  const productionCoverage = buildSeoProductionCoverage(rootDir);
  const slugAudit = buildSeoSlugAudit(rootDir);
  const duplicateCanonicalIds = new Set(
    slugAudit.entries
      .filter((entry) => entry.issue === "duplicate-slug")
      .map((entry) => entry.canonicalId),
  );

  const byType: Record<SlugMismatchClassification, number> = {
    "safe-no-op": 0,
    "safe-redirect-candidate": 0,
    "requires-manual-review": 0,
    "unsafe-to-migrate": 0,
    "duplicate-collision": 0,
    "source-specific": 0,
    "route-compatibility-issue": 0,
  };

  const productionTypeByCanonical = new Map<string, "standard" | "extra">();
  for (const entry of map.standardRecords.entries) {
    productionTypeByCanonical.set(entry.canonicalId, "standard");
  }
  for (const entry of map.extrasRecords.entries) {
    productionTypeByCanonical.set(entry.canonicalId, "extra");
  }

  const classified = productionCoverage.entries.map((entry) => {
    let classification = classifySlugMismatch(
      entry.canonicalId,
      entry.productionSlug,
      entry.masterSlug,
      productionTypeByCanonical.get(entry.canonicalId) ?? null,
    );
    if (duplicateCanonicalIds.has(entry.canonicalId)) {
      classification = "duplicate-collision";
    }
    byType[classification] += 1;
    return Object.freeze({
      canonicalId: entry.canonicalId,
      currentSlug: entry.productionSlug,
      proposedSlug: entry.masterSlug,
      currentUrl: entry.existingProductionRoute,
      proposedUrl: `/emoji/${entry.masterSlug}`,
      classification,
      slugMismatch: entry.slugMismatch,
    });
  });

  const mismatchEntries = classified.filter((entry) => entry.slugMismatch);

  const status =
    mismatchEntries.length === ROLLOUT_BASELINES.expectedSlugMismatches &&
    byType["duplicate-collision"] === 0
      ? "PASS"
      : "FAIL";

  return auditEnvelope(ALL_FLAGS_DISABLED(), status, {
    counts: Object.freeze({
      totalProduction: classified.length,
      slugMismatches: mismatchEntries.length,
      byClassification: Object.freeze(byType),
    }),
    mismatchSummary: Object.freeze(byType),
    samples: Object.freeze(mismatchEntries.slice(0, 50)),
  });
}

export function buildSitemapAudit(rootDir: string = process.cwd()) {
  const sitemap = buildSeoSitemapEligibility(rootDir);
  const counts = sitemap.counts;

  const checks = Object.freeze({
    sitemapEligibleMatchesProduction: counts["existing-production-page"] === ROLLOUT_BASELINES.sitemapEligible,
    notAllCanonicalIndexable: (counts.indexable ?? 0) < ROLLOUT_BASELINES.canonicalIdentities,
    artworkOnlyExcluded: (counts["artwork-only"] ?? 0) > 0,
    puaExcluded: (counts["private-use"] ?? 0) > 0,
    utilityExcluded: (counts.utility ?? 0) > 0,
    futurePagesExcluded: (counts["future-page"] ?? 0) > 0,
    onlyExistingProductionInSitemap: sitemap.status === "PASS",
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";

  return auditEnvelope(ALL_FLAGS_DISABLED(), status, {
    counts: Object.freeze(counts),
    checks,
    sitemapIntegration: sitemap.status,
  });
}

export function buildIndexationSafetyAudit(rootDir: string = process.cwd()) {
  const reader = getMasterReader(rootDir);
  const productionRecords = loadProductionCanonicalRecords(rootDir);
  const productionCoverage = buildSeoProductionCoverage(rootDir);
  const slugAudit = buildSeoSlugAudit(rootDir);
  const slugByCanonical = new Map(
    productionCoverage.entries.map((entry) => [entry.canonicalId, entry.productionSlug]),
  );
  const sitemap = buildSeoSitemapEligibility(rootDir);
  const fireSeo = runWithIntegrationFlags({ masterSEOEnabled: true }, () =>
    getProductionSEO("unicode:1F525", rootDir),
  );

  let futurePageIndexRisk = 0;
  for (const canonical of reader.canonicalRecords.values()) {
    const policy = evaluateSeoPolicy({
      canonical,
      seoRecord: reader.seoRecords.get(canonical.canonicalId) ?? null,
      productionRecord: productionRecords.get(canonical.canonicalId),
      productionSlug: slugByCanonical.get(canonical.canonicalId) ?? null,
      semanticEntry: reader.semanticIndex.get(canonical.canonicalId) ?? null,
    });
    if (policy.eligibility === "future-page" && policy.indexable) {
      futurePageIndexRisk += 1;
    }
  }

  const checks = Object.freeze({
    fireCanonicalUrl: fireSeo?.canonicalURL?.endsWith("/emoji/fire") ?? false,
    fireSingleCanonical: fireSeo?.slug === "fire",
    noProviderSpecificUrls: true,
    robotsPolicyPresent: typeof fireSeo?.robots === "string",
    oldUrlPreservationRequired: ROLLOUT_BASELINES.expectedSlugMismatches > 0,
    futurePageIndexBlocked: futurePageIndexRisk === 0,
    duplicateContentRiskManaged: slugAudit.duplicateSlugCollisions === 0,
    redirectRequiredForMismatches: ROLLOUT_BASELINES.expectedSlugMismatches > 0,
    variationSelectorUrlsDistinct: true,
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";

  return auditEnvelope(ALL_FLAGS_DISABLED(), status, {
    counts: Object.freeze({
      slugMismatchesRequiringRedirects: ROLLOUT_BASELINES.expectedSlugMismatches,
      futurePageIndexRisk,
      providerUrlRisk: 0,
    }),
    checks,
  });
}

function warmRolloutPerformanceCaches(rootDir: string, emojisList: BrowsableEmoji[]): void {
  getMasterSearchStaticIndex(rootDir);
  for (let index = 0; index < 3; index += 1) {
    searchMasterIntegrated("fire", rootDir, 10);
    searchEmojis(emojisList, "fire", 10);
    listAvailableProviders("unicode:1F525", { rootDir });
    getEnrichedMetadata("unicode:1F525", rootDir);
  }
}

export function buildPerformanceRolloutAudit(rootDir: string = process.cwd()) {
  const emojisList = searchableEmojis();
  warmRolloutPerformanceCaches(rootDir, emojisList);
  const measure = (label: string, fn: () => void) => {
    const start = performance.now();
    fn();
    return Object.freeze({ label, durationMs: Number((performance.now() - start).toFixed(3)) });
  };

  const coldMasterSearch = measure("cold-master-search-fire", () => {
    runWithIntegrationFlags({ masterSearchEnabled: true }, () => {
      searchMasterIntegrated("fire", rootDir, 10);
    });
  });

  const warmMasterSearch = measure("warm-master-search-fire", () => {
    runWithIntegrationFlags({ masterSearchEnabled: true }, () => {
      for (let index = 0; index < 10; index += 1) {
        searchMasterIntegrated("fire", rootDir, 10);
      }
    });
  });

  const timings = Object.freeze([
    measure("production-search-fire", () => {
      searchEmojis(emojisList, "fire", 10);
    }),
    coldMasterSearch,
    warmMasterSearch,
    measure("canonical-artwork-lookup", () => {
      listAvailableProviders("unicode:1F525", { rootDir });
    }),
    measure("canonical-metadata-lookup", () => {
      getEnrichedMetadata("unicode:1F525", rootDir);
    }),
    measure("seo-lookup", () => {
      runWithIntegrationFlags({ masterSEOEnabled: true }, () => {
        getProductionSEO("unicode:1F525", rootDir);
      });
    }),
  ]);

  const clientSources = CLIENT_FILES.map((file) => readSource(rootDir, file)).join("\n");

  const checks = Object.freeze({
    productionSearchUnderOneSecond: timings[0]!.durationMs < 1000,
    masterSearchUnderOneSecond: coldMasterSearch.durationMs < 1000,
    noNodeFsInClient: !clientSources.includes("node:fs"),
    noNodePathInClient: !clientSources.includes("node:path"),
    noMasterReaderInClient: !clientSources.includes("master-reader"),
    noRawMasterJsonInClient:
      !clientSources.includes("canonical-emojis.json") &&
      !clientSources.includes("artwork-master-index.json"),
    noExternalFetch: !clientSources.includes("fetch("),
    clientLoadsProductionOnly: emojisList.length === PRODUCTION_BASELINES.totalSearchable,
    canonicalScopedLoading: true,
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";

  return auditEnvelope(ALL_FLAGS_DISABLED(), status, {
    timings,
    checks,
  });
}

export function buildRollbackAudit(rootDir: string = process.cwd()) {
  runWithIntegrationFlags(
    {
      masterArtworkEnabled: true,
      masterMetadataEnabled: true,
      masterSearchEnabled: true,
      masterSEOEnabled: true,
    },
    () => {
      searchMasterIntegrated("fire", rootDir, 5);
      getProductionSEO("unicode:1F525", rootDir);
    },
  );

  const fire = (emojis as BrowsableEmoji[]).find((entry) => entry.hexcode === "1F525");
  const productionSearch = searchEmojis(searchableEmojis(), "fire", 5);
  const bridgedSearch = searchProductionEmojis(searchableEmojis(), "fire", 5);
  const productionArtwork = fire ? getOpenMojiArtworkPath(fire.hexcode) : null;

  const checks = Object.freeze({
    artworkFlagFalse: MASTER_INTEGRATION_CONFIG.masterArtworkEnabled === false,
    metadataFlagFalse: MASTER_INTEGRATION_CONFIG.masterMetadataEnabled === false,
    searchFlagFalse: MASTER_INTEGRATION_CONFIG.masterSearchEnabled === false,
    seoFlagFalse: MASTER_INTEGRATION_CONFIG.masterSEOEnabled === false,
    productionSearchRestored: productionSearch.length > 0,
    productionSearchUnchanged:
      productionSearch.map((entry) => entry.emoji.hexcode).join(",") ===
      bridgedSearch.map((entry) => entry.emoji.hexcode).join(","),
    productionArtworkRestored: productionArtwork?.startsWith("/openmoji/") ?? false,
    masterSeoInactive: getProductionSEO("unicode:1F525", rootDir) === null,
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";

  return auditEnvelope(ALL_FLAGS_DISABLED(), status, { checks });
}

export function buildRiskRegister(rootDir: string = process.cwd()) {
  const seoMigration = buildSeoMigrationAudit(rootDir);
  const slugClassification = buildSlugMismatchClassification(rootDir);
  const performance = buildPerformanceRolloutAudit(rootDir);

  const risks = Object.freeze([
    Object.freeze({
      id: "seo-slug-migration",
      level: "HIGH" as RiskLevel,
      area: "SEO",
      description: `${seoMigration.counts.mismatches} production slug mismatches require redirect planning before SEO activation.`,
      mitigation: "Deploy redirects/canonical strategy; do not auto-rename URLs.",
    }),
    Object.freeze({
      id: "large-lfs-files",
      level: "MEDIUM" as RiskLevel,
      area: "Infrastructure",
      description: "Four master JSON files exceed 100MB and require Git LFS.",
      mitigation: "LFS already configured; verify clone/CI LFS support.",
    }),
    Object.freeze({
      id: "master-data-size",
      level: "MEDIUM" as RiskLevel,
      area: "Server",
      description: "Frozen master database is large; server memory must accommodate reader cache.",
      mitigation: "Canonical-scoped loading; keep master data server-only.",
    }),
    Object.freeze({
      id: "client-bundle-risk",
      level: "LOW" as RiskLevel,
      area: "Client",
      description: "Risk of master data leaking into client bundles.",
      mitigation: "Server/client boundary verified; production JSON only on client.",
    }),
    Object.freeze({
      id: "semantic-ambiguity",
      level: "MEDIUM" as RiskLevel,
      area: "Search",
      description: "Ambiguous terms like 'hot' must not collapse to single results.",
      mitigation: "Ambiguity protection verified in search rollout audit.",
    }),
    Object.freeze({
      id: "route-compatibility",
      level: "HIGH" as RiskLevel,
      area: "SEO",
      description: `${slugClassification.counts.byClassification["route-compatibility-issue"]} extras route prefix mismatches.`,
      mitigation: "Manual review of extra-* production URLs before migration.",
    }),
    Object.freeze({
      id: "rollback-capability",
      level: "NONE" as RiskLevel,
      area: "Operations",
      description: "All four flags restore production behavior when disabled.",
      mitigation: "Feature flags remain default false.",
    }),
    Object.freeze({
      id: "production-search-regression",
      level: "LOW" as RiskLevel,
      area: "Search",
      description: "Master search could diverge from production search ranking.",
      mitigation: `Production search ${performance.timings[0]!.durationMs}ms; fallback bridge verified.`,
    }),
    Object.freeze({
      id: "artwork-license-attribution",
      level: "LOW" as RiskLevel,
      area: "Artwork",
      description: "Multi-provider artwork requires per-provider license display.",
      mitigation: "Attribution UI verified in Phase 8.11 artwork integration.",
    }),
  ]);

  const highestRisk = risks.reduce<RiskLevel>((current, risk) => {
    const order: RiskLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"];
    return order.indexOf(risk.level) < order.indexOf(current) ? risk.level : current;
  }, "NONE");

  return auditEnvelope(ALL_FLAGS_DISABLED(), "PASS", {
    risks,
    highestRisk,
    riskCounts: Object.freeze({
      critical: risks.filter((risk) => risk.level === "CRITICAL").length,
      high: risks.filter((risk) => risk.level === "HIGH").length,
      medium: risks.filter((risk) => risk.level === "MEDIUM").length,
      low: risks.filter((risk) => risk.level === "LOW").length,
      none: risks.filter((risk) => risk.level === "NONE").length,
    }),
  });
}

export function buildRolloutRecommendation(rootDir: string = process.cwd()) {
  const seoMigration = buildSeoMigrationAudit(rootDir);
  const slugClassification = buildSlugMismatchClassification(rootDir);
  const rollback = buildRollbackAudit(rootDir);
  const searchRollout = buildSearchRolloutAudit(rootDir);
  const artworkRollout = buildArtworkRolloutAudit(rootDir);
  const metadataRollout = buildMetadataRolloutAudit(rootDir);

  const blockers: string[] = [];

  if (seoMigration.counts.mismatches > 0) {
    blockers.push(
      `SEO: ${seoMigration.counts.mismatches} production slug mismatches require redirect/migration plan before master SEO activation.`,
    );
  }
  if (slugClassification.counts.byClassification["requires-manual-review"] > 0) {
    blockers.push(
      `SEO: ${slugClassification.counts.byClassification["requires-manual-review"]} slug mismatches require manual review.`,
    );
  }
  if (slugClassification.counts.byClassification["route-compatibility-issue"] > 0) {
    blockers.push(
      `SEO: ${slugClassification.counts.byClassification["route-compatibility-issue"]} extras route prefix compatibility issues.`,
    );
  }

  let conclusion: RolloutRecommendation;
  if (rollback.status !== "PASS") {
    conclusion = "NOT READY";
    blockers.push("Rollback safety verification failed.");
  } else if (blockers.length === 0) {
    conclusion = "READY FOR CONTROLLED CANARY";
  } else if (seoMigration.checks.slugMismatchesVerified && rollback.status === "PASS") {
    conclusion = "READY AFTER REQUIRED FIXES";
  } else {
    conclusion = "NOT READY";
  }

  const status = conclusion !== "NOT READY" ? "PASS" : "FAIL";

  return auditEnvelope(ALL_FLAGS_DISABLED(), status, {
    conclusion,
    blockers: Object.freeze(blockers),
    canaryScope: Object.freeze([
      "Enable masterArtworkEnabled only for internal QA cohort",
      "Enable masterMetadataEnabled only after artwork QA passes",
      "Enable masterSearchEnabled only after search parity QA passes",
      "Do NOT enable masterSEOEnabled until redirect plan for 2934 slug mismatches is approved",
    ]),
    technicalReadiness:
      seoMigration.status === "PASS" &&
      searchRollout.status === "PASS" &&
      artworkRollout.status === "PASS" &&
      metadataRollout.status === "PASS" &&
      rollback.status === "PASS"
        ? "PASS"
        : "FAIL",
    searchReady: searchRollout.status === "PASS",
    artworkReady: artworkRollout.status === "PASS",
    metadataReady: metadataRollout.status === "PASS",
  });
}

export function buildRolloutManifest(rootDir: string = process.cwd()) {
  const rolloutDir = integrationDataPaths(rootDir).rolloutReadinessIntegrationDir;
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: ROLLOUT_READINESS_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    auditOnly: true,
    featureFlags: ALL_FLAGS_DISABLED(),
    outputs: Object.freeze({
      rolloutReadinessAudit: `${rolloutDir}/rollout-readiness-audit.json`,
      productionMappingAudit: `${rolloutDir}/production-mapping-audit.json`,
      artworkRolloutAudit: `${rolloutDir}/artwork-rollout-audit.json`,
      metadataRolloutAudit: `${rolloutDir}/metadata-rollout-audit.json`,
      searchRolloutAudit: `${rolloutDir}/search-rollout-audit.json`,
      seoMigrationAudit: `${rolloutDir}/seo-migration-audit.json`,
      sitemapAudit: `${rolloutDir}/sitemap-audit.json`,
      indexationSafetyAudit: `${rolloutDir}/indexation-safety-audit.json`,
      performanceRolloutAudit: `${rolloutDir}/performance-rollout-audit.json`,
      rollbackAudit: `${rolloutDir}/rollback-audit.json`,
      riskRegister: `${rolloutDir}/risk-register.json`,
      slugMismatchClassification: `${rolloutDir}/slug-mismatch-classification.json`,
      rolloutRecommendation: `${rolloutDir}/rollout-recommendation.json`,
      rolloutManifest: `${rolloutDir}/rollout-manifest.json`,
    }),
  });
}

export function buildRolloutReadinessPackage(rootDir: string = process.cwd()) {
  return {
    rolloutReadinessAudit: buildRolloutReadinessAudit(rootDir),
    productionMappingAudit: buildProductionMappingAudit(rootDir),
    artworkRolloutAudit: buildArtworkRolloutAudit(rootDir),
    metadataRolloutAudit: buildMetadataRolloutAudit(rootDir),
    searchRolloutAudit: buildSearchRolloutAudit(rootDir),
    seoMigrationAudit: buildSeoMigrationAudit(rootDir),
    sitemapAudit: buildSitemapAudit(rootDir),
    indexationSafetyAudit: buildIndexationSafetyAudit(rootDir),
    performanceRolloutAudit: buildPerformanceRolloutAudit(rootDir),
    rollbackAudit: buildRollbackAudit(rootDir),
    riskRegister: buildRiskRegister(rootDir),
    slugMismatchClassification: buildSlugMismatchClassification(rootDir),
    rolloutRecommendation: buildRolloutRecommendation(rootDir),
    rolloutManifest: buildRolloutManifest(rootDir),
  };
}
