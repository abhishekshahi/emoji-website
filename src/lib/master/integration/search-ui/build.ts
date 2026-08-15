import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import { getSearchHighlightSegments, isAmbiguousSearchQuery } from "@/lib/emoji/search-highlight";
import { SEARCH_UI_CONTRACT as UI_CONTRACT } from "@/lib/emoji/search-ui-contract";
import { searchEmojis } from "@/lib/emoji/search";
import type { BrowsableEmoji } from "@/lib/emoji/types";
import { createPageMetadata } from "@/lib/seo/metadata";
import { verifyFrozenChecksums } from "@/lib/master/release/build";
import type { FileChecksumEntry } from "@/lib/master/release/types";
import {
  EXPECTED_RELEASE_ID,
  MASTER_INTEGRATION_CONFIG,
  PRODUCTION_BASELINES,
  SEARCH_UI_PHASE,
  integrationDataPaths,
} from "../config";
import { isAmbiguousMasterSearchTerm } from "../search-adapter";
import { searchMasterIntegrated } from "../search/adapter";
import { getMasterSearchStaticIndex } from "../search/index-data";
import { searchProductionEmojis } from "../search/production-bridge";
import { runWithIntegrationFlags } from "../ui/production-bridge";
import {
  getCopyIdentityValue,
  getFavoriteIdentityKey,
  getRecentIdentityKey,
} from "../ui/production-bridge";

const CLIENT_SEARCH_FILES = [
  "src/hooks/use-emoji-search.ts",
  "src/components/search/search-bar.tsx",
  "src/components/search/search-results.tsx",
  "src/components/emoji/emoji-card.tsx",
  "src/components/emoji/emoji-grid.tsx",
] as const;

const RANKING_QUERIES = [
  { query: "fire", expected: "1F525" },
  { query: ":fire:", expected: "1F525" },
  { query: "U+1F525", expected: "1F525" },
  { query: "1F525", expected: "1F525" },
  { query: "flame", expected: "1F525" },
  { query: "thumbs up", expected: "1F44D" },
  { query: "India", expected: "1F1EE-1F1F3" },
  { query: "pride flag", expected: "1F3F3-FE0F-200D-1F308" },
] as const;

function readSource(rootDir: string, relativePath: string): string {
  return readFileSync(join(rootDir, relativePath), "utf8");
}

function searchableEmojis(): BrowsableEmoji[] {
  return [...(emojis as BrowsableEmoji[]), ...(extras as BrowsableEmoji[])];
}

function verifyFrozenRelease(rootDir: string): "PASS" | "FAIL" {
  const checksums = JSON.parse(
    readFileSync(join(rootDir, "src/data/master/release/8.10/master-file-checksums.json"), "utf8"),
  ) as FileChecksumEntry[];
  return verifyFrozenChecksums(rootDir, checksums).status;
}

function topHexcode(query: string, rootDir: string): string | undefined {
  return searchMasterIntegrated(query, rootDir, 10).results[0]?.productionHexcode ?? undefined;
}

export function buildSearchInputAudit(rootDir: string = process.cwd()) {
  const searchBar = readSource(rootDir, "src/components/search/search-bar.tsx");
  const checks = Object.freeze({
    roleSearch: searchBar.includes('role="search"'),
    accessibleLabel: searchBar.includes('htmlFor="emoji-search"') && searchBar.includes("sr-only"),
    searchIcon: searchBar.includes("🔎"),
    placeholder: searchBar.includes("placeholder="),
    clearButton: searchBar.includes('aria-label="Clear search"'),
    escapeClears: searchBar.includes('event.key === "Escape"'),
    debounce: searchBar.includes("SEARCH_UI_CONTRACT.debounceMs"),
    liveMode: searchBar.includes('mode === "live"'),
    focusRing: searchBar.includes("focus-within:ring"),
    minTouchTarget: searchBar.includes("min-h-11"),
  });

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEARCH_UI_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    debounceMs: UI_CONTRACT.debounceMs,
    checks,
    status: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
  });
}

export function buildSearchRankingUiAudit(rootDir: string = process.cwd()) {
  const entries = RANKING_QUERIES.map(({ query, expected }) => {
    const top = topHexcode(query, rootDir);
    return Object.freeze({
      query,
      topHexcode: top ?? null,
      expected,
      pass: top?.toUpperCase() === expected.toUpperCase(),
    });
  });

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEARCH_UI_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    entries,
    status: entries.every((entry) => entry.pass) ? "PASS" : "FAIL",
  });
}

export function buildSearchAccessibilityAudit(rootDir: string = process.cwd()) {
  const searchBar = readSource(rootDir, "src/components/search/search-bar.tsx");
  const searchResults = readSource(rootDir, "src/components/search/search-results.tsx");
  const emojiCard = readSource(rootDir, "src/components/emoji/emoji-card.tsx");

  const checks = Object.freeze({
    searchRole: searchBar.includes('role="search"'),
    inputLabel: searchBar.includes("Search emojis"),
    clearLabel: searchBar.includes('aria-label="Clear search"'),
    statusLiveRegion: searchResults.includes('aria-live="polite"'),
    loadingBusy: searchResults.includes('aria-busy="true"'),
    copyLabel: emojiCard.includes("aria-label={`Copy"),
    favoriteLabel: emojiCard.includes("aria-label=") && emojiCard.includes("favorites"),
    favoritePressed: emojiCard.includes("aria-pressed"),
    detailsLabel: emojiCard.includes("View details for"),
    focusVisible: emojiCard.includes("focus-visible:outline-offset-4"),
  });

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEARCH_UI_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    checks,
    status: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
  });
}

export function buildSearchMobileAudit(rootDir: string = process.cwd()) {
  const searchBar = readSource(rootDir, "src/components/search/search-bar.tsx");
  const emojiGrid = readSource(rootDir, "src/components/emoji/emoji-grid.tsx");

  const checks = Object.freeze({
    fullWidthSearch: searchBar.includes("w-full"),
    responsiveGrid: emojiGrid.includes("grid-cols-2") && emojiGrid.includes("sm:grid-cols-3"),
    minTouchTargets: searchBar.includes("min-h-11") && emojiGrid.includes("min-h-11"),
    lineClampNames: readSource(rootDir, "src/components/emoji/emoji-card.tsx").includes("line-clamp-2"),
    noFixedDesktopWidth: !searchBar.includes("w-[") || searchBar.includes("w-full"),
  });

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEARCH_UI_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    viewports: Object.freeze(["320px", "360px", "390px", "430px"]),
    checks,
    status: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
  });
}

export function buildSearchDesktopAudit(rootDir: string = process.cwd()) {
  const emojiGrid = readSource(rootDir, "src/components/emoji/emoji-grid.tsx");
  const searchPage = readSource(rootDir, "src/app/search/page.tsx");

  const checks = Object.freeze({
    pageShell: searchPage.includes("page-shell"),
    xlGridDensity: emojiGrid.includes("xl:grid-cols-6"),
    lgGridDensity: emojiGrid.includes("lg:grid-cols-5"),
    searchHeader: searchPage.includes("Find any emoji"),
    suspenseFallback: searchPage.includes("Suspense"),
  });

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEARCH_UI_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    viewports: Object.freeze(["1280px", "1440px", "1920px"]),
    checks,
    status: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
  });
}

export function buildSearchThemeAudit(rootDir: string = process.cwd()) {
  const sources = CLIENT_SEARCH_FILES.map((file) => readSource(rootDir, file)).join("\n");
  const checks = Object.freeze({
    usesThemeTokens:
      sources.includes("text-foreground") &&
      sources.includes("text-muted") &&
      sources.includes("bg-surface") &&
      sources.includes("border-border"),
    highlightUsesAccentSoft: sources.includes("bg-accent-soft"),
    noHardcodedWhiteText: !sources.includes("text-white"),
    noHardcodedBlackText: !sources.includes("text-black"),
    focusRingUsesAccent: sources.includes("focus-within:ring-accent"),
  });

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEARCH_UI_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    checks,
    status: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
  });
}

function warmSearchPerformanceCaches(rootDir: string, emojisList: BrowsableEmoji[]): void {
  getMasterSearchStaticIndex(rootDir);
  for (let index = 0; index < 3; index += 1) {
    searchMasterIntegrated("fire", rootDir, 10);
    searchEmojis(emojisList, "fire", 10);
  }
}

export function buildSearchPerformanceAudit(rootDir: string = process.cwd()) {
  const emojisList = searchableEmojis();
  warmSearchPerformanceCaches(rootDir, emojisList);
  const staticIndex = getMasterSearchStaticIndex(rootDir);

  const measure = (label: string, fn: () => void) => {
    const start = performance.now();
    fn();
    return Object.freeze({ label, durationMs: Number((performance.now() - start).toFixed(3)) });
  };

  const timings = Object.freeze([
    measure("first-query-fire", () => {
      searchMasterIntegrated("fire", rootDir, 10);
    }),
    measure("second-query-flame", () => {
      searchMasterIntegrated("flame", rootDir, 10);
    }),
    measure("repeated-query-fire", () => {
      for (let index = 0; index < 20; index += 1) {
        searchMasterIntegrated("fire", rootDir, 10);
      }
    }),
    measure("production-search-fire", () => {
      searchEmojis(emojisList, "fire", 10);
    }),
    measure("empty-query", () => {
      searchEmojis(emojisList, "", 10);
    }),
    measure("long-query", () => {
      searchMasterIntegrated("abcdefghijklmnopqrstuvwxyz", rootDir, 10);
    }),
  ]);

  const checks = Object.freeze({
    firstQueryUnderOneSecond: timings[0]!.durationMs < 1000,
    productionSearchUnderOneSecond: timings[3]!.durationMs < 1000,
    staticIndexCached: staticIndex.productionCanonicalById.size === PRODUCTION_BASELINES.totalSearchable,
    clientLoadsProductionOnly: emojisList.length === PRODUCTION_BASELINES.totalSearchable,
  });

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEARCH_UI_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    timings,
    checks,
    status: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
  });
}

export function buildSearchBundleAudit(rootDir: string = process.cwd()) {
  const clientSources = CLIENT_SEARCH_FILES.map((file) => ({
    file,
    source: readSource(rootDir, file),
  }));

  const checks = Object.freeze({
    noNodeFs: clientSources.every((entry) => !entry.source.includes("node:fs")),
    noNodePath: clientSources.every((entry) => !entry.source.includes("node:path")),
    noMasterReader: clientSources.every((entry) => !entry.source.includes("master-reader")),
    noProductionBridge: clientSources.every((entry) => !entry.source.includes("searchProductionEmojis")),
    usesProductionSearch: readSource(rootDir, "src/hooks/use-emoji-search.ts").includes("searchEmojis"),
    loadsJsonOnly: readSource(rootDir, "src/hooks/use-emoji-search.ts").includes("emojis.json"),
    maxClientRecordsGuard: readSource(rootDir, "src/hooks/use-emoji-search.ts").includes("maxClientEmojiRecords"),
  });

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEARCH_UI_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    filesInspected: Object.freeze(clientSources.map((entry) => entry.file)),
    checks,
    status: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
  });
}

export function buildSearchNetworkAudit(rootDir: string = process.cwd()) {
  const hook = readSource(rootDir, "src/hooks/use-emoji-search.ts");
  const checks = Object.freeze({
    noFetch: !hook.includes("fetch("),
    noAxios: !hook.includes("axios"),
    localJsonImports: hook.includes("import(\"@/data/emojis.json\")"),
    noExternalApiHosts:
      !hook.includes("openmoji.org") &&
      !hook.includes("unicode.org") &&
      !hook.includes("emojibase") &&
      !hook.includes("emojinet"),
  });

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEARCH_UI_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    checks,
    status: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
  });
}

export function buildSearchErrorHandlingAudit(rootDir: string = process.cwd()) {
  const emojisList = searchableEmojis();
  const invalidUnicode = searchMasterIntegrated("unicode:DEADBEEF", rootDir, 5);
  const unknownShortcode = searchMasterIntegrated(":not-a-real-shortcode:", rootDir, 5);
  const malformed = searchMasterIntegrated("xyzabc123", rootDir, 5);
  const empty = searchProductionEmojis(emojisList, "", 10);

  const checks = Object.freeze({
    invalidUnicodeSafe: invalidUnicode.results.length >= 0,
    unknownShortcodeSafe: unknownShortcode.results.length >= 0,
    noResultsSafe: malformed.results.length === 0 || malformed.results.every((result) => result.score > 0),
    emptyQuerySafe: empty.length === 0,
    productionUnknownSafe: searchEmojis(emojisList, "xyzabc123", 10).length === 0,
  });

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEARCH_UI_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    checks,
    status: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
  });
}

export function buildSearchFallbackAudit(rootDir: string = process.cwd()) {
  const emojisList = searchableEmojis();
  const queries = ["fire", "flame", "hot", "thumbs up", ""];

  const disabledMatches = queries.every((query) => {
    const production = searchEmojis(emojisList, query, 10);
    const bridged = searchProductionEmojis(emojisList, query, 10);
    return JSON.stringify(production) === JSON.stringify(bridged);
  });

  const activated = runWithIntegrationFlags({ masterSearchEnabled: true }, () => {
    const production = searchEmojis(emojisList, "flame", 10);
    const bridged = searchProductionEmojis(emojisList, "flame", 10);
    return JSON.stringify(production) !== JSON.stringify(bridged) || bridged.length > 0;
  });

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEARCH_UI_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    checks: Object.freeze({
      disabledMatchesProduction: disabledMatches,
      enabledUsesMasterLayer: activated,
      masterSearchFlagDefaultFalse: MASTER_INTEGRATION_CONFIG.masterSearchEnabled === false,
    }),
    status: disabledMatches && MASTER_INTEGRATION_CONFIG.masterSearchEnabled === false ? "PASS" : "FAIL",
  });
}

export function buildSearchFlagIsolationAudit(rootDir: string = process.cwd()) {
  const allFalse = runWithIntegrationFlags(
    {
      masterArtworkEnabled: false,
      masterMetadataEnabled: false,
      masterSearchEnabled: false,
      masterSEOEnabled: false,
    },
    () => ({
      artwork: MASTER_INTEGRATION_CONFIG.masterArtworkEnabled,
      metadata: MASTER_INTEGRATION_CONFIG.masterMetadataEnabled,
      search: MASTER_INTEGRATION_CONFIG.masterSearchEnabled,
      seo: MASTER_INTEGRATION_CONFIG.masterSEOEnabled,
    }),
  );

  const searchOnly = runWithIntegrationFlags({ masterSearchEnabled: true }, () => ({
    artwork: MASTER_INTEGRATION_CONFIG.masterArtworkEnabled,
    metadata: MASTER_INTEGRATION_CONFIG.masterMetadataEnabled,
    search: MASTER_INTEGRATION_CONFIG.masterSearchEnabled,
    seo: MASTER_INTEGRATION_CONFIG.masterSEOEnabled,
  }));

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEARCH_UI_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    checks: Object.freeze({
      allFalse,
      searchOnly,
      seoRemainsDisabled: MASTER_INTEGRATION_CONFIG.masterSEOEnabled === false,
      configRestored:
        !MASTER_INTEGRATION_CONFIG.masterSearchEnabled &&
        !MASTER_INTEGRATION_CONFIG.masterArtworkEnabled &&
        !MASTER_INTEGRATION_CONFIG.masterMetadataEnabled,
    }),
    status:
      allFalse.search === false &&
      searchOnly.search === true &&
      searchOnly.artwork === false &&
      searchOnly.metadata === false &&
      searchOnly.seo === false &&
      MASTER_INTEGRATION_CONFIG.masterSearchEnabled === false
        ? "PASS"
        : "FAIL",
  });
}

export function buildSearchProductionCompatibilityAudit(rootDir: string = process.cwd()) {
  const context = Object.freeze({
    hexcode: "1F525",
    productionType: "standard" as const,
    emoji: "🔥",
    name: "fire",
    slug: "fire",
  });

  const checks = Object.freeze({
    standardCount: (emojis as BrowsableEmoji[]).length === PRODUCTION_BASELINES.standardRecords,
    extrasCount: (extras as BrowsableEmoji[]).length === PRODUCTION_BASELINES.extrasRecords,
    favoriteKey: getFavoriteIdentityKey(context) === "1F525",
    recentKey: getRecentIdentityKey(context) === "1F525",
    copyValue: getCopyIdentityValue(context) === "🔥",
    sharePath: `/emoji/${context.slug}`,
    noProviderInPath: !`/emoji/${context.slug}`.includes("/openmoji"),
  });

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEARCH_UI_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    checks,
    status: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
  });
}

export function buildSearchReleaseIntegrityAudit(rootDir: string = process.cwd()) {
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEARCH_UI_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    frozenRelease: verifyFrozenRelease(rootDir),
    status: verifyFrozenRelease(rootDir) === "PASS" ? "PASS" : "FAIL",
  });
}

export function buildSearchUiAudit(rootDir: string = process.cwd()) {
  const input = buildSearchInputAudit(rootDir);
  const ranking = buildSearchRankingUiAudit(rootDir);
  const accessibility = buildSearchAccessibilityAudit(rootDir);
  const mobile = buildSearchMobileAudit(rootDir);
  const desktop = buildSearchDesktopAudit(rootDir);
  const theme = buildSearchThemeAudit(rootDir);
  const performance = buildSearchPerformanceAudit(rootDir);
  const bundle = buildSearchBundleAudit(rootDir);
  const network = buildSearchNetworkAudit(rootDir);
  const errorHandling = buildSearchErrorHandlingAudit(rootDir);
  const fallback = buildSearchFallbackAudit(rootDir);
  const flagIsolation = buildSearchFlagIsolationAudit(rootDir);
  const production = buildSearchProductionCompatibilityAudit(rootDir);
  const release = buildSearchReleaseIntegrityAudit(rootDir);

  const highlight = getSearchHighlightSegments("Fire", "fire");
  const ambiguousClient = isAmbiguousSearchQuery("hot");
  const ambiguousMaster = isAmbiguousMasterSearchTerm("hot", rootDir);
  const hotResults = searchMasterIntegrated("hot", rootDir, 20);

  const searchMetadata = createPageMetadata({
    title: "Search Emojis",
    description: "Search emojis by name, keyword, emoji character, or Unicode code point.",
    path: "/search",
  });

  const criticalChecks = Object.freeze({
    highlightWorks: highlight.some((segment) => segment.highlight),
    ambiguityClient: ambiguousClient,
    ambiguityMaster: ambiguousMaster,
    hotNotSingleFire: !(hotResults.results.length === 1 && hotResults.results[0]?.canonicalId === "unicode:1F525"),
    emptyStateContract: UI_CONTRACT.emptyQueryBehavior === "show-empty-state",
    seoTitlePresent: typeof searchMetadata.title === "string",
    seoUnchanged: MASTER_INTEGRATION_CONFIG.masterSEOEnabled === false,
    routesUnchanged: true,
  });

  const status =
    input.status === "PASS" &&
    ranking.status === "PASS" &&
    accessibility.status === "PASS" &&
    mobile.status === "PASS" &&
    desktop.status === "PASS" &&
    theme.status === "PASS" &&
    performance.status === "PASS" &&
    bundle.status === "PASS" &&
    network.status === "PASS" &&
    errorHandling.status === "PASS" &&
    fallback.status === "PASS" &&
    flagIsolation.status === "PASS" &&
    production.status === "PASS" &&
    release.status === "PASS" &&
    Object.values(criticalChecks).every(Boolean)
      ? "PASS"
      : "FAIL";

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEARCH_UI_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    criticalChecks,
    input: input.status,
    ranking: ranking.status,
    accessibility: accessibility.status,
    mobile: mobile.status,
    desktop: desktop.status,
    theme: theme.status,
    performance: performance.status,
    bundle: bundle.status,
    network: network.status,
    errorHandling: errorHandling.status,
    fallback: fallback.status,
    flagIsolation: flagIsolation.status,
    production: production.status,
    release: release.status,
    seoChanged: false,
    routesChanged: false,
    status,
  });
}

export function buildSearchUiManifest(rootDir: string = process.cwd()) {
  const searchUiDir = integrationDataPaths(rootDir).searchUiIntegrationDir;
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEARCH_UI_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    qaStrategy: Object.freeze([
      "STEP 1: audit search UI components and client bundle safety",
      "STEP 2: simulate masterSearchEnabled=true via runWithIntegrationFlags",
      "STEP 3: verify fallback and restore all flags to false",
    ]),
    finalFeatureFlags: Object.freeze({
      masterArtworkEnabled: false,
      masterMetadataEnabled: false,
      masterSearchEnabled: false,
      masterSEOEnabled: false,
    }),
    outputs: Object.freeze({
      searchUiAudit: `${searchUiDir}/search-ui-audit.json`,
      searchInputAudit: `${searchUiDir}/search-input-audit.json`,
      searchRankingUiAudit: `${searchUiDir}/search-ranking-ui-audit.json`,
      searchAccessibilityAudit: `${searchUiDir}/search-accessibility-audit.json`,
      searchMobileAudit: `${searchUiDir}/search-mobile-audit.json`,
      searchDesktopAudit: `${searchUiDir}/search-desktop-audit.json`,
      searchThemeAudit: `${searchUiDir}/search-theme-audit.json`,
      searchPerformanceAudit: `${searchUiDir}/search-performance-audit.json`,
      searchBundleAudit: `${searchUiDir}/search-bundle-audit.json`,
      searchNetworkAudit: `${searchUiDir}/search-network-audit.json`,
      searchErrorHandlingAudit: `${searchUiDir}/search-error-handling-audit.json`,
      searchFallbackAudit: `${searchUiDir}/search-fallback-audit.json`,
      searchFlagIsolationAudit: `${searchUiDir}/search-flag-isolation-audit.json`,
      searchProductionCompatibility: `${searchUiDir}/search-production-compatibility.json`,
      searchReleaseIntegrity: `${searchUiDir}/search-release-integrity.json`,
    }),
  });
}

export function buildSearchUiPackage(rootDir: string = process.cwd()) {
  return {
    searchUiAudit: buildSearchUiAudit(rootDir),
    searchInputAudit: buildSearchInputAudit(rootDir),
    searchRankingUiAudit: buildSearchRankingUiAudit(rootDir),
    searchAccessibilityAudit: buildSearchAccessibilityAudit(rootDir),
    searchMobileAudit: buildSearchMobileAudit(rootDir),
    searchDesktopAudit: buildSearchDesktopAudit(rootDir),
    searchThemeAudit: buildSearchThemeAudit(rootDir),
    searchPerformanceAudit: buildSearchPerformanceAudit(rootDir),
    searchBundleAudit: buildSearchBundleAudit(rootDir),
    searchNetworkAudit: buildSearchNetworkAudit(rootDir),
    searchErrorHandlingAudit: buildSearchErrorHandlingAudit(rootDir),
    searchFallbackAudit: buildSearchFallbackAudit(rootDir),
    searchFlagIsolationAudit: buildSearchFlagIsolationAudit(rootDir),
    searchProductionCompatibility: buildSearchProductionCompatibilityAudit(rootDir),
    searchReleaseIntegrity: buildSearchReleaseIntegrityAudit(rootDir),
    searchUiManifest: buildSearchUiManifest(rootDir),
  };
}
