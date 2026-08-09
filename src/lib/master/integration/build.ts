import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import {
  productionCanonicalIdForExtra,
  productionCanonicalIdForStandard,
} from "@/lib/master/canonical/build";
import { getArtwork } from "./artwork-adapter";
import { getCanonicalEmoji } from "./canonical-adapter";
import { getMetadata } from "./metadata-adapter";
import { searchMaster, isAmbiguousMasterSearchTerm } from "./search-adapter";
import { getMasterSEO } from "./seo-adapter";
import {
  EXPECTED_RELEASE_ID,
  INTEGRATION_PHASE,
  MASTER_INTEGRATION_CONFIG,
  PRODUCTION_BASELINES,
  integrationDataPaths,
} from "./config";
import { getMasterReader, initializeMasterReader } from "./master-reader";
import type {
  IntegrationAuditReport,
  IntegrationManifest,
  ProductionToMasterEntry,
  ProductionToMasterMap,
} from "./types";

interface ProductionEmojiRecord {
  id: string;
  hexcode: string;
}

interface ProductionExtraRecord {
  id: string;
  hexcode: string;
}

export function mapProductionStandard(hexcode: string): string {
  return productionCanonicalIdForStandard(hexcode);
}

export function mapProductionExtra(hexcode: string): string {
  return productionCanonicalIdForExtra(hexcode);
}

export function buildProductionToMasterMap(rootDir: string = process.cwd()): ProductionToMasterMap {
  const reader = initializeMasterReader(rootDir);
  const canonicalIds = reader.canonicalRecords;

  const standardEntries: ProductionToMasterEntry[] = (emojis as ProductionEmojiRecord[]).map((record) => {
    const canonicalId = mapProductionStandard(record.hexcode);
    return Object.freeze({
      productionId: record.id,
      productionHexcode: record.hexcode,
      productionType: "standard" as const,
      canonicalId,
      mapped: canonicalIds.has(canonicalId),
    });
  });

  const extrasEntries: ProductionToMasterEntry[] = (extras as ProductionExtraRecord[]).map((record) => {
    const canonicalId = mapProductionExtra(record.hexcode);
    return Object.freeze({
      productionId: record.id,
      productionHexcode: record.hexcode,
      productionType: "extra" as const,
      canonicalId,
      mapped: canonicalIds.has(canonicalId),
    });
  });

  const standardMapped = standardEntries.filter((entry) => entry.mapped).length;
  const extrasMapped = extrasEntries.filter((entry) => entry.mapped).length;
  const totalMapped = standardMapped + extrasMapped;

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    releaseId: reader.manifest.releaseId,
    phase: INTEGRATION_PHASE,
    standardRecords: Object.freeze({
      total: standardEntries.length,
      mapped: standardMapped,
      entries: Object.freeze(standardEntries),
    }),
    extrasRecords: Object.freeze({
      total: extrasEntries.length,
      mapped: extrasMapped,
      entries: Object.freeze(extrasEntries),
    }),
    totalMapped,
    totalExpected: PRODUCTION_BASELINES.totalSearchable,
    status:
      standardMapped === PRODUCTION_BASELINES.standardRecords &&
      extrasMapped === PRODUCTION_BASELINES.extrasRecords
        ? "PASS"
        : "FAIL",
  });
}

function verifyAdapterSmokeTests(rootDir: string): IntegrationAuditReport["adapters"] {
  const fireCanonical = getCanonicalEmoji("unicode:1F525", rootDir);
  const fireArtwork = getArtwork("unicode:1F525", { rootDir });
  const fireMetadata = getMetadata("unicode:1F525", rootDir);
  const fireSeo = getMasterSEO("unicode:1F525", rootDir);
  const fireSearch = searchMaster("fire", rootDir);
  const hotAmbiguous = isAmbiguousMasterSearchTerm("hot", rootDir);

  const artworkProviders = fireArtwork?.providers;
  const metadataSources = new Set(fireMetadata?.sourceMetadata.map((entry) => entry.source) ?? []);

  return {
    canonical: fireCanonical ? "PASS" : "FAIL",
    artwork:
      artworkProviders &&
      artworkProviders.openmoji.length > 0 &&
      artworkProviders.noto.length > 0 &&
      artworkProviders.twemoji.length > 0 &&
      artworkProviders.fluent.length > 0
        ? "PASS"
        : "FAIL",
    metadata:
      metadataSources.has("unicode") &&
      metadataSources.has("cldr") &&
      metadataSources.has("openmoji") &&
      metadataSources.has("emojibase") &&
      metadataSources.has("emojilib") &&
      metadataSources.has("emojinet") &&
      metadataSources.has("fluent")
        ? "PASS"
        : "FAIL",
    search: fireSearch.results.some((result) => result.canonicalId === "unicode:1F525") ? "PASS" : "FAIL",
    seo: fireSeo?.canonicalId === "unicode:1F525" ? "PASS" : "FAIL",
  };
}

export function buildIntegrationAuditReport(rootDir: string = process.cwd()): IntegrationAuditReport {
  const reader = getMasterReader(rootDir);
  const productionMap = buildProductionToMasterMap(rootDir);
  const adapters = verifyAdapterSmokeTests(rootDir);

  const featureFlagsDefaultFalse = Object.values(MASTER_INTEGRATION_CONFIG).every((flag) => flag === false);

  const productionSafety = {
    emojisJsonCount: emojis.length,
    openmojiExtrasCount: extras.length,
    featureFlagsDefaultFalse,
    status:
      emojis.length === PRODUCTION_BASELINES.standardRecords &&
      extras.length === PRODUCTION_BASELINES.extrasRecords &&
      featureFlagsDefaultFalse
        ? ("PASS" as const)
        : ("FAIL" as const),
  };

  const adapterStatus = Object.values(adapters).every((status) => status === "PASS") ? "PASS" : "FAIL";

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: INTEGRATION_PHASE,
    releaseId: reader.manifest.releaseId,
    releaseVerification: reader.releaseVerification,
    productionMappings: Object.freeze({
      standard: Object.freeze({
        total: productionMap.standardRecords.total,
        mapped: productionMap.standardRecords.mapped,
      }),
      extras: Object.freeze({
        total: productionMap.extrasRecords.total,
        mapped: productionMap.extrasRecords.mapped,
      }),
      total: Object.freeze({
        total: productionMap.totalExpected,
        mapped: productionMap.totalMapped,
      }),
      status: productionMap.status,
    }),
    adapters,
    productionSafety,
    status:
      productionMap.status === "PASS" &&
      reader.releaseVerification.verified &&
      productionSafety.status === "PASS" &&
      adapterStatus === "PASS"
        ? "PASS"
        : "FAIL",
  });
}

export function buildIntegrationManifest(rootDir: string = process.cwd()): IntegrationManifest {
  const reader = getMasterReader(rootDir);
  const paths = integrationDataPaths(rootDir);

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: INTEGRATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    releaseStatus: "frozen",
    readOnly: true,
    featureFlags: MASTER_INTEGRATION_CONFIG,
    dataSources: Object.freeze({
      releasePackage: paths.releaseDir,
      canonicalDatabase: `${paths.masterDir}/canonical-emojis.json`,
      artworkLayer: `${paths.masterDir}/artwork`,
      metadataLayer: `${paths.masterDir}/metadata`,
      semanticLayer: `${paths.masterDir}/semantic`,
    }),
    outputs: Object.freeze({
      productionToMasterMap: `${paths.integrationDir}/production-to-master-map.json`,
      integrationAuditReport: `${paths.integrationDir}/integration-audit-report.json`,
    }),
  });
}

export interface BuildIntegrationResult {
  productionToMasterMap: ProductionToMasterMap;
  integrationAuditReport: IntegrationAuditReport;
  integrationManifest: IntegrationManifest;
}

export function buildIntegrationPackage(rootDir: string = process.cwd()): BuildIntegrationResult {
  const productionToMasterMap = buildProductionToMasterMap(rootDir);
  const integrationAuditReport = buildIntegrationAuditReport(rootDir);
  const integrationManifest = buildIntegrationManifest(rootDir);

  return {
    productionToMasterMap,
    integrationAuditReport,
    integrationManifest,
  };
}
