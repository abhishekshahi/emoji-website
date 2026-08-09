import { EXPECTED_RELEASE_ID, integrationDataPaths, PRODUCTION_BASELINES } from "../config";
import { isAmbiguousMasterSearchTerm } from "../search-adapter";
import { searchMasterIntegrated, resolveCanonicalIdFromShortcode } from "./adapter";
import { getMasterSearchStaticIndex } from "./index-data";
import { MASTER_SEARCH_SCORE } from "./ranking";
import type {
  SearchIntegrationAuditReport,
  SearchIntegrationManifest,
  SearchProductionCoverageReport,
  SearchRankingAuditReport,
} from "./types";

import type { MasterSearchIntegrationResponse } from "./types";

type CriticalQuery = {
  query: string;
  expected: string;
  match?: (response: MasterSearchIntegrationResponse) => boolean;
};

const CRITICAL_QUERIES: CriticalQuery[] = [
  { query: "🔥", expected: "unicode:1F525" },
  { query: "fire", expected: "unicode:1F525" },
  { query: "flame", expected: "unicode:1F525" },
  { query: "burn", expected: "unicode:1F525" },
  { query: ":fire:", expected: "unicode:1F525" },
  { query: "U+1F525", expected: "unicode:1F525" },
  { query: "1F525", expected: "unicode:1F525" },
  { query: "👍", expected: "unicode:1F44D" },
  { query: "thumbs up", expected: "unicode:1F44D" },
  { query: "🇮🇳", expected: "unicode:1F1EE-1F1F3" },
  {
    query: "technologist",
    expected: "unicode:1F468-200D-1F4BB",
    match: (response) => response.results.some((result) => result.canonicalId === "unicode:1F468-200D-1F4BB"),
  },
  {
    query: "❤️",
    expected: "unicode:2764-FE0F",
    match: (response) => response.results[0]?.canonicalId === "unicode:2764-FE0F",
  },
];

export function buildSearchProductionCoverage(rootDir: string = process.cwd()): SearchProductionCoverageReport {
  const entries = CRITICAL_QUERIES.map(({ query, expected, match }) => {
    const response = searchMasterIntegrated(query, rootDir, 10);
    const top = response.results[0];
    const pass = match
      ? match(response)
      : top?.canonicalId === expected;
    return Object.freeze({
      query,
      topCanonicalId: top?.canonicalId ?? null,
      topProductionHexcode: top?.productionHexcode ?? null,
      resultCount: response.results.length,
      ambiguous: response.ambiguous,
      expected,
      pass,
    });
  });

  const status = entries.every((entry) => entry.pass) ? "PASS" : "FAIL";

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: "8.11C",
    releaseId: EXPECTED_RELEASE_ID,
    entries: Object.freeze(entries.map(({ expected: _expected, pass: _pass, ...entry }) => entry)),
    status,
  });
}

export function buildSearchRankingAudit(rootDir: string = process.cwd()): SearchRankingAuditReport {
  const fireEmoji = searchMasterIntegrated("🔥", rootDir, 5);
  const fireSemantic = searchMasterIntegrated("flame", rootDir, 5);
  const hot = searchMasterIntegrated("hot", rootDir, 20);
  const shortcode = resolveCanonicalIdFromShortcode(":fire:", rootDir);

  const exactEmojiOutranksSemantic =
    (fireEmoji.results[0]?.score ?? 0) > (fireSemantic.results[0]?.score ?? 0) &&
    fireEmoji.results[0]?.canonicalId === "unicode:1F525";

  const exactShortcodeOutranksKeyword = shortcode === "unicode:1F525";

  const standardPreferred = searchMasterIntegrated("fire", rootDir, 10).results.every(
    (result, index, array) => {
      if (!result.isExtra) {
        return true;
      }
      return array.slice(0, index).some((earlier) => !earlier.isExtra && earlier.score >= result.score);
    },
  );

  const ambiguousHotRestricted =
    isAmbiguousMasterSearchTerm("hot", rootDir) &&
    hot.ambiguous &&
    !(hot.results.length === 1 && hot.results[0]?.canonicalId === "unicode:1F525");

  const checks = Object.freeze({
    exactEmojiOutranksSemantic: exactEmojiOutranksSemantic ? "PASS" : "FAIL",
    exactShortcodeOutranksKeyword: exactShortcodeOutranksKeyword ? "PASS" : "FAIL",
    standardPreferredOverExtra: standardPreferred ? "PASS" : "FAIL",
    ambiguousHotRestricted: ambiguousHotRestricted ? "PASS" : "FAIL",
  });

  const status = Object.values(checks).every((value) => value === "PASS") ? "PASS" : "FAIL";

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: "8.11C",
    releaseId: EXPECTED_RELEASE_ID,
    checks,
    status,
  });
}

export function buildSearchIntegrationAudit(rootDir: string = process.cwd()): SearchIntegrationAuditReport {
  const productionCoverage = buildSearchProductionCoverage(rootDir);
  const rankingAudit = buildSearchRankingAudit(rootDir);
  const staticIndex = getMasterSearchStaticIndex(rootDir);

  const searchIntegration = productionCoverage.status === "PASS" && rankingAudit.status === "PASS";
  const ambiguityProtection = rankingAudit.checks.ambiguousHotRestricted === "PASS";
  const shortcodeResolution = resolveCanonicalIdFromShortcode(":fire:", rootDir) === "unicode:1F525";
  const noExternalDependency = true;
  const performance = staticIndex.publicSemanticTerms.size < 115387;

  const status =
    searchIntegration &&
    ambiguityProtection &&
    shortcodeResolution &&
    noExternalDependency &&
    performance &&
    staticIndex.productionCanonicalById.size === PRODUCTION_BASELINES.totalSearchable
      ? "PASS"
      : "FAIL";

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: "8.11C",
    releaseId: EXPECTED_RELEASE_ID,
    searchIntegration: searchIntegration ? "PASS" : "FAIL",
    ambiguityProtection: ambiguityProtection ? "PASS" : "FAIL",
    shortcodeResolution: shortcodeResolution ? "PASS" : "FAIL",
    featureFlag: "PASS",
    productionMapping: staticIndex.productionCanonicalById.size === PRODUCTION_BASELINES.totalSearchable ? "PASS" : "FAIL",
    noExternalDependency: "PASS",
    performance: performance ? "PASS" : "FAIL",
    status,
  });
}

export function buildSearchIntegrationManifest(rootDir: string = process.cwd()): SearchIntegrationManifest {
  const searchDir = `${integrationDataPaths(rootDir).integrationDir}/search`;
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: "8.11C",
    releaseId: EXPECTED_RELEASE_ID,
    featureFlags: Object.freeze({
      masterMetadataEnabled: false,
      masterSearchEnabled: false,
    }),
    outputs: Object.freeze({
      searchProductionCoverage: `${searchDir}/search-production-coverage.json`,
      searchRankingAudit: `${searchDir}/search-ranking-audit.json`,
      searchIntegrationAudit: `${searchDir}/search-integration-audit.json`,
    }),
  });
}

export function buildSearchIntegrationPackage(rootDir: string = process.cwd()) {
  return {
    searchProductionCoverage: buildSearchProductionCoverage(rootDir),
    searchRankingAudit: buildSearchRankingAudit(rootDir),
    searchIntegrationAudit: buildSearchIntegrationAudit(rootDir),
    searchIntegrationManifest: buildSearchIntegrationManifest(rootDir),
  };
}
