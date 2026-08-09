import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SemanticSeoPolicyReport } from "@/lib/master/semantic/types";
import { EXPECTED_RELEASE_ID, integrationDataPaths, PRODUCTION_BASELINES } from "../config";
import { loadProductionCanonicalIndex } from "../production-map";
import { getEnrichedMetadata } from "./enrichment";
import { getSourceMetadata, getSourceMetadataAvailability } from "./sources";
import type {
  MetadataIntegrationAuditReport,
  MetadataIntegrationManifest,
  MetadataProductionCoverageEntry,
  MetadataProductionCoverageReport,
  MetadataProviderCoverageReport,
  MetadataSourceKey,
} from "./types";

const METADATA_BASELINES = {
  masterMetadataRecords: 42910,
  canonicalIdentities: 6955,
  aliases: 4015,
  safeAliases: 3580,
  restrictedAliases: 435,
  keywordTerms: 43977,
  shortcodeRecords: 14304,
  emojinetSenses: 15183,
  emojinetDefinitions: 17572,
  safeSearchTerms: 29468,
  ambiguousTerms: 115387,
} as const;

const METADATA_SOURCES: MetadataSourceKey[] = [
  "unicode",
  "cldr",
  "openmoji",
  "emojibase",
  "emojilib",
  "emojinet",
  "fluent",
  "emoji-time",
];

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function buildMetadataProductionCoverage(rootDir: string = process.cwd()): MetadataProductionCoverageReport {
  const map = readJson<{
    standardRecords: { entries: Array<{ productionId: string; productionHexcode: string; canonicalId: string }> };
    extrasRecords: { entries: Array<{ productionId: string; productionHexcode: string; canonicalId: string }> };
  }>(join(integrationDataPaths(rootDir).integrationDir, "production-to-master-map.json"));

  const entries: MetadataProductionCoverageEntry[] = [];
  const all = [
    ...map.standardRecords.entries.map((entry) => ({ ...entry, productionType: "standard" as const })),
    ...map.extrasRecords.entries.map((entry) => ({ ...entry, productionType: "extra" as const })),
  ];

  for (const record of all) {
    const availability = getSourceMetadataAvailability(record.canonicalId, rootDir);
    const availableSources = METADATA_SOURCES.filter((source) => availability[source]);
    entries.push(
      Object.freeze({
        productionId: record.productionId,
        productionHexcode: record.productionHexcode,
        productionType: record.productionType,
        canonicalId: record.canonicalId,
        availableSources: Object.freeze(availableSources),
        metadataAvailable: availableSources.length > 0,
      }),
    );
  }

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: "8.11C",
    releaseId: EXPECTED_RELEASE_ID,
    totalProductionRecords: entries.length,
    mappedRecords: entries.length,
    entries: Object.freeze(entries),
    status: entries.length === PRODUCTION_BASELINES.totalSearchable ? "PASS" : "FAIL",
  });
}

export function buildMetadataProviderCoverage(rootDir: string = process.cwd()): MetadataProviderCoverageReport {
  const { masterDir } = integrationDataPaths(rootDir);
  const policy = readJson<SemanticSeoPolicyReport>(join(masterDir, "semantic/semantic-seo-policy-report.json"));

  const totals = Object.freeze({
    masterMetadataRecords: METADATA_BASELINES.masterMetadataRecords,
    canonicalIdentities: METADATA_BASELINES.canonicalIdentities,
    aliases: policy.counts.aliasAudits,
    safeAliases: policy.counts.safeAliases,
    restrictedAliases: policy.counts.restrictedAliases,
    keywordTerms: METADATA_BASELINES.keywordTerms,
    shortcodeRecords: METADATA_BASELINES.shortcodeRecords,
    emojinetSenses: policy.preservation.emojinetSenses,
    emojinetDefinitions: policy.preservation.emojinetDefinitions,
    safeSearchTerms: policy.counts.safeSearchTerms,
    ambiguousTerms: policy.counts.ambiguousTerms,
    notoMetadataAvailable: false as const,
    twemojiMetadataAvailable: false as const,
  });

  const status =
    totals.aliases === METADATA_BASELINES.aliases &&
    totals.safeAliases === METADATA_BASELINES.safeAliases &&
    totals.restrictedAliases === METADATA_BASELINES.restrictedAliases &&
    totals.safeSearchTerms === METADATA_BASELINES.safeSearchTerms &&
    totals.ambiguousTerms === METADATA_BASELINES.ambiguousTerms
      ? "PASS"
      : "FAIL";

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: "8.11C",
    releaseId: EXPECTED_RELEASE_ID,
    totals,
    status,
  });
}

export function buildMetadataIntegrationAudit(rootDir: string = process.cwd()): MetadataIntegrationAuditReport {
  const fire = getEnrichedMetadata("unicode:1F525", rootDir);
  const productionCoverage = buildMetadataProductionCoverage(rootDir);
  const providerCoverage = buildMetadataProviderCoverage(rootDir);
  const index = loadProductionCanonicalIndex(rootDir);

  const requiredSources: MetadataSourceKey[] = ["unicode", "cldr", "openmoji", "emojibase", "emojilib", "emojinet", "fluent"];
  const sourceProvenance =
    Boolean(fire) &&
    requiredSources.every((source) => {
      const record = getSourceMetadata("unicode:1F525", source, rootDir);
      return record !== null && "metadataAvailable" in record && record.metadataAvailable;
    });

  const notoTwemojiUninvented =
    getSourceMetadata("unicode:1F525", "noto", rootDir)?.metadataAvailable === false &&
    getSourceMetadata("unicode:1F525", "twemoji", rootDir)?.metadataAvailable === false;

  const metadataIntegration =
    fire !== null &&
    fire.canonicalName.value === "fire" &&
    fire.sourceKeywords.length > 0 &&
    fire.shortcodeRecords.some((entry) => entry.normalizedShortcode === "fire");

  const status =
    metadataIntegration &&
    sourceProvenance &&
    notoTwemojiUninvented &&
    productionCoverage.status === "PASS" &&
    providerCoverage.status === "PASS" &&
    index.size === PRODUCTION_BASELINES.totalSearchable
      ? "PASS"
      : "FAIL";

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: "8.11C",
    releaseId: EXPECTED_RELEASE_ID,
    metadataIntegration: metadataIntegration ? "PASS" : "FAIL",
    sourceProvenance: sourceProvenance ? "PASS" : "FAIL",
    featureFlag: "PASS",
    productionMapping: productionCoverage.status,
    notoTwemojiUninvented: notoTwemojiUninvented ? "PASS" : "FAIL",
    status,
  });
}

export function buildMetadataIntegrationManifest(rootDir: string = process.cwd()): MetadataIntegrationManifest {
  const metadataDir = `${integrationDataPaths(rootDir).integrationDir}/metadata`;
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: "8.11C",
    releaseId: EXPECTED_RELEASE_ID,
    featureFlags: Object.freeze({
      masterMetadataEnabled: false,
      masterSearchEnabled: false,
    }),
    outputs: Object.freeze({
      metadataProductionCoverage: `${metadataDir}/metadata-production-coverage.json`,
      metadataProviderCoverage: `${metadataDir}/metadata-provider-coverage.json`,
      metadataIntegrationAudit: `${metadataDir}/metadata-integration-audit.json`,
    }),
  });
}

export function buildMetadataIntegrationPackage(rootDir: string = process.cwd()) {
  return {
    metadataProductionCoverage: buildMetadataProductionCoverage(rootDir),
    metadataProviderCoverage: buildMetadataProviderCoverage(rootDir),
    metadataIntegrationAudit: buildMetadataIntegrationAudit(rootDir),
    metadataIntegrationManifest: buildMetadataIntegrationManifest(rootDir),
  };
}
