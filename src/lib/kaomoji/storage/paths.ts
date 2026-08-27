import { join } from "node:path";

export const COLLECTOR_VERSION = "2.0.0-phase2-universal";
export const NORMALIZATION_VERSION = "1.0.0";
export const CLASSIFICATION_VERSION = "1.0.0";
export const PIPELINE_VERSION = "3.0.0-acquisition";
export const DEDUP_ALGORITHM_VERSION = "1.0.0";

export function getKaomojiDataRoot(rootDir: string): string {
  return join(rootDir, "data", "kaomoji");
}

export function getKaomojiImportsDir(rootDir: string): string {
  return join(getKaomojiDataRoot(rootDir), "imports");
}

export function getKaomojiRawDir(rootDir: string): string {
  return join(getKaomojiDataRoot(rootDir), "raw");
}

export function getKaomojiProcessedDir(rootDir: string): string {
  return join(getKaomojiDataRoot(rootDir), "processed");
}

export function getKaomojiUniversalDir(rootDir: string): string {
  return join(getKaomojiDataRoot(rootDir), "universal");
}

export function getKaomojiRawRecordsPath(rootDir: string): string {
  return join(getKaomojiRawDir(rootDir), "records.json");
}

export function getKaomojiRawManifestPath(rootDir: string): string {
  return join(getKaomojiRawDir(rootDir), "manifest.json");
}

export function getUniversalRawItemsPath(rootDir: string): string {
  return join(getKaomojiUniversalDir(rootDir), "raw-items.json");
}

export function getUniversalAggregatedPath(rootDir: string): string {
  return join(getKaomojiUniversalDir(rootDir), "aggregated.json");
}

export function getUniversalNormalizedPath(rootDir: string): string {
  return join(getKaomojiUniversalDir(rootDir), "normalized.json");
}

export function getKaomojiAggregatedPath(rootDir: string): string {
  return join(getKaomojiProcessedDir(rootDir), "aggregated.json");
}

export function getKaomojiNormalizedPath(rootDir: string): string {
  return join(getKaomojiProcessedDir(rootDir), "normalized.json");
}

export function getKaomojiProvenancePath(rootDir: string): string {
  return join(getKaomojiProcessedDir(rootDir), "provenance.json");
}

export function getUniversalProvenancePath(rootDir: string): string {
  return join(getKaomojiUniversalDir(rootDir), "provenance.json");
}

export function getKaomojiValidationPath(rootDir: string): string {
  return join(getKaomojiProcessedDir(rootDir), "validation.json");
}

export function getUniversalValidationPath(rootDir: string): string {
  return join(getKaomojiUniversalDir(rootDir), "validation.json");
}

export function getKaomojiPreservationPath(rootDir: string): string {
  return join(getKaomojiProcessedDir(rootDir), "preservation-audit.json");
}

export function getKaomojiCollectionRunPath(rootDir: string): string {
  return join(getKaomojiRawDir(rootDir), "collection-run.json");
}

export function getSourceCollectionReportsPath(rootDir: string): string {
  return join(getKaomojiUniversalDir(rootDir), "source-collection-reports.json");
}

export function getDedupAnalysisPath(rootDir: string): string {
  return join(getKaomojiUniversalDir(rootDir), "deduplication-analysis.json");
}

export function getNoLossReconciliationPath(rootDir: string): string {
  return join(getKaomojiUniversalDir(rootDir), "no-loss-reconciliation.json");
}

export function getSourceCoveragePath(rootDir: string): string {
  return join(getKaomojiUniversalDir(rootDir), "source-coverage-matrix.json");
}

export function getPhase2ManifestPath(rootDir: string): string {
  return join(getKaomojiUniversalDir(rootDir), "phase-2-manifest.json");
}

export function getPhase3ManifestPath(rootDir: string): string {
  return join(getKaomojiUniversalDir(rootDir), "phase-3-manifest.json");
}

export function getPhase3BManifestPath(rootDir: string): string {
  return join(getKaomojiUniversalDir(rootDir), "phase-3b-manifest.json");
}

export function getPhase3BDiscoveryPath(rootDir: string): string {
  return join(getKaomojiDataRoot(rootDir), "discovery", "phase-3b-audits.json");
}

export function getPhase3DiscoveryPath(rootDir: string): string {
  return join(getKaomojiUniversalDir(rootDir), "phase-3-discovery.json");
}

export function getPhase4ManifestPath(rootDir: string): string {
  return join(getKaomojiUniversalDir(rootDir), "phase-4-manifest.json");
}

export function getPhase4MesslettersManifestPath(rootDir: string): string {
  return join(getKaomojiUniversalDir(rootDir), "phase-4-messletters.json");
}

export function getPhase4FastEmojiManifestPath(rootDir: string): string {
  return join(getKaomojiUniversalDir(rootDir), "phase-4-fastemoji.json");
}

export function getFastEmojiCheckpointPath(rootDir: string): string {
  return join(getKaomojiDataRoot(rootDir), "collection", "fastemoji");
}

export function getPhase5ManifestPath(rootDir: string): string {
  return join(getKaomojiUniversalDir(rootDir), "phase-5-manifest.json");
}

export function getPhase6ManifestPath(rootDir: string): string {
  return join(getKaomojiUniversalDir(rootDir), "phase-6-manifest.json");
}

export function getPhase7RootDir(rootDir: string): string {
  return join(getKaomojiProcessedDir(rootDir), "phase-7");
}

export function getPhase7ManifestPath(rootDir: string): string {
  return join(getPhase7RootDir(rootDir), "manifests", "phase-7-final.json");
}

export function getPhase7RawSnapshotPath(rootDir: string): string {
  return join(getPhase7RootDir(rootDir), "raw-snapshot.json");
}

export function getPhase7NormalizedDir(rootDir: string): string {
  return join(getPhase7RootDir(rootDir), "normalized");
}

export function getPhase7DuplicateAnalysisDir(rootDir: string): string {
  return join(getPhase7RootDir(rootDir), "duplicate-analysis");
}

export function getPhase7VariantAnalysisDir(rootDir: string): string {
  return join(getPhase7RootDir(rootDir), "variant-analysis");
}

export function getPhase7ValidationDir(rootDir: string): string {
  return join(getPhase7RootDir(rootDir), "validation");
}

export function getPhase7QualityDir(rootDir: string): string {
  return join(getPhase7RootDir(rootDir), "quality");
}

export function getPhase7LicensingDir(rootDir: string): string {
  return join(getPhase7RootDir(rootDir), "licensing");
}

export function getPhase7ProposedPublishedDir(rootDir: string): string {
  return join(getPhase7RootDir(rootDir), "proposed-published");
}

export const PHASE7_PIPELINE_VERSION = "7.0.0-raw-processing-analysis";
export const PHASE7_NORMALIZATION_VERSION = "7.0.0";
export const PHASE7_VALIDATION_VERSION = "7.0.0";
export const PHASE7_DEDUP_ANALYSIS_VERSION = "7.0.0-analysis-only";

export function getPhase8RootDir(rootDir: string): string {
  return join(getKaomojiProcessedDir(rootDir), "phase-8");
}

export function getPhase8ProposedLibraryDir(rootDir: string): string {
  return join(getPhase8RootDir(rootDir), "proposed-library");
}

export function getPhase8ManifestPath(rootDir: string): string {
  return join(getPhase8RootDir(rootDir), "manifests", "phase-8-final.json");
}

export const PHASE8_PIPELINE_VERSION = "8.0.0-canonical-proposed-no-deletion";
export const PHASE8_CANONICAL_ID_VERSION = "8.0.0";

export function getPhase9RootDir(rootDir: string): string {
  return join(getKaomojiProcessedDir(rootDir), "phase-9");
}

export function getPhase9EditorialDir(rootDir: string): string {
  return join(getPhase9RootDir(rootDir), "editorial");
}

export function getPhase9ManifestPath(rootDir: string): string {
  return join(getPhase9RootDir(rootDir), "manifests", "phase-9-final.json");
}

export const PHASE9_PIPELINE_VERSION = "9.0.0-knowledge-product";
export const PHASE9_QUALITY_VERSION = "9.0.0";

export function getPhase10RootDir(rootDir: string): string {
  return join(getKaomojiProcessedDir(rootDir), "phase-10");
}

export function getPhase10ManifestPath(rootDir: string): string {
  return join(getPhase10RootDir(rootDir), "manifests", "phase-10-final.json");
}

export const PHASE10_PIPELINE_VERSION = "10.0.0-scoring-curation";

export function getPhase11RootDir(rootDir: string): string {
  return join(getKaomojiProcessedDir(rootDir), "phase-11");
}

export function getPhase11ManifestPath(rootDir: string): string {
  return join(getPhase11RootDir(rootDir), "manifests", "phase-11-final.json");
}

export const PHASE11_PIPELINE_VERSION = "11.0.0-composition-audit-analysis-only";

export function getPhase12RootDir(rootDir: string): string {
  return join(getKaomojiProcessedDir(rootDir), "phase-12");
}

export function getPhase12PublicQualityDir(rootDir: string): string {
  return join(getPhase12RootDir(rootDir), "public-quality");
}

/** @deprecated use getPhase12PublicQualityDir */
export function getPhase12PublicLibraryDir(rootDir: string): string {
  return getPhase12PublicQualityDir(rootDir);
}

export function getPhase12ManifestPath(rootDir: string): string {
  return join(getPhase12RootDir(rootDir), "manifests", "phase-12-final.json");
}

/** Evidence-based curation resolutions from maximum-coverage review (derived; phase-8 source unchanged). */
export function getCurationResolutionsPath(rootDir: string): string {
  return join(getKaomojiProcessedDir(rootDir), "final", "curation-resolutions.json");
}

export const PHASE12_PIPELINE_VERSION = "12.0.0-quality-library-excellent-high-good-medium";

export function getPhase13RootDir(rootDir: string): string {
  return join(getKaomojiProcessedDir(rootDir), "phase-13");
}

export function getPhase13ManifestPath(rootDir: string): string {
  return join(getPhase13RootDir(rootDir), "manifests", "phase-13-final.json");
}

export const PHASE13_PIPELINE_VERSION = "13.0.0-final-audit-analysis-only";

export function getPhase14RootDir(rootDir: string): string {
  return join(getKaomojiProcessedDir(rootDir), "phase-14");
}

export function getPhase14ManifestPath(rootDir: string): string {
  return join(getPhase14RootDir(rootDir), "manifests", "phase-14-final.json");
}

export function getPhase14SearchIndexPath(rootDir: string): string {
  return join(getPhase14RootDir(rootDir), "search-index-v2.json");
}

export const PHASE14_PIPELINE_VERSION = "14.0.0-search-excellence";

export function getPhase15RootDir(rootDir: string): string {
  return join(getKaomojiProcessedDir(rootDir), "phase-15");
}

export function getPhase15ManifestPath(rootDir: string): string {
  return join(getPhase15RootDir(rootDir), "manifests", "phase-15-final.json");
}

export function getPhase15LocaleRegistryPath(rootDir: string): string {
  return join(getPhase15RootDir(rootDir), "locale-registry.json");
}

export const PHASE15_PIPELINE_VERSION = "15.0.0-multilingual-architecture";

export function getPhase16RootDir(rootDir: string): string {
  return join(getKaomojiProcessedDir(rootDir), "phase-16");
}

export function getPhase16ManifestPath(rootDir: string): string {
  return join(getPhase16RootDir(rootDir), "manifests", "phase-16-final.json");
}

export const PHASE16_PIPELINE_VERSION = "16.0.0-seo-content";

export function getPhase17RootDir(rootDir: string): string {
  return join(getKaomojiProcessedDir(rootDir), "phase-17");
}

export function getPhase17ManifestPath(rootDir: string): string {
  return join(getPhase17RootDir(rootDir), "manifests", "phase-17-final.json");
}

export const PHASE17_PIPELINE_VERSION = "17.0.0-ui-ux";

export function getPhase18RootDir(rootDir: string): string {
  return join(getKaomojiProcessedDir(rootDir), "phase-18");
}

export function getPhase18ManifestPath(rootDir: string): string {
  return join(getPhase18RootDir(rootDir), "manifests", "phase-18-final.json");
}

export const PHASE18_PIPELINE_VERSION = "18.0.0-analytics-popularity";

export function getImportFilePath(rootDir: string, sourceId: string): string {
  return join(getKaomojiImportsDir(rootDir), `${sourceId}.json`);
}

export function getPhase19RootDir(rootDir: string): string {
  return join(getKaomojiProcessedDir(rootDir), "phase-19");
}

export function getPhase19ManifestPath(rootDir: string): string {
  return join(getPhase19RootDir(rootDir), "manifests", "phase-19-final.json");
}

export function getPhase19ExportDir(rootDir: string): string {
  return join(getPhase19RootDir(rootDir), "export");
}

export const PHASE19_PIPELINE_VERSION = "19.0.0-cloudflare-production";

export function getPhase20RootDir(rootDir: string): string {
  return join(getKaomojiProcessedDir(rootDir), "phase-20");
}

export function getPhase20ManifestPath(rootDir: string): string {
  return join(getPhase20RootDir(rootDir), "manifests", "phase-20-final.json");
}

export const PHASE20_PIPELINE_VERSION = "20.0.0-production-hardening";

export function getPhase21RootDir(rootDir: string): string {
  return join(getKaomojiProcessedDir(rootDir), "phase-21");
}

export function getPhase21ManifestPath(rootDir: string): string {
  return join(getPhase21RootDir(rootDir), "manifests", "phase-21-final.json");
}

export const PHASE21_PIPELINE_VERSION = "21.0.0-production-qa-launch";
