export {
  EXPECTED_RELEASE_ID,
  EXPECTED_RELEASE_PHASE,
  EXPECTED_RELEASE_STATUS,
  INTEGRATION_PHASE,
  MASTER_INTEGRATION_CONFIG,
  PRODUCTION_BASELINES,
  ARTWORK_INTEGRATION_PHASE,
  METADATA_SEARCH_INTEGRATION_PHASE,
  SEO_INTEGRATION_PHASE,
  UI_INTEGRATION_PHASE,
  ACTIVATION_PHASE,
  integrationDataPaths,
} from "./config";

export {
  initializeMasterReader,
  getMasterReader,
  resetMasterReaderCache,
} from "./master-reader";

export { getCanonicalEmoji } from "./canonical-adapter";
export {
  getArtwork,
  getArtworkByProvider,
  getArtworkVariants,
  getArtworkByVariant,
  listAvailableProviders,
  listVariantsByProvider,
  type ArtworkLookupOptions,
} from "./artwork-adapter";
export { getMetadata } from "./metadata-adapter";
export { searchMaster, isAmbiguousMasterSearchTerm } from "./search-adapter";
export { getMasterSEO } from "./seo-adapter";

export {
  buildArtworkIntegrationPackage,
  buildArtworkProductionCoverage,
  buildArtworkProviderCoverage,
  buildArtworkIntegrationAudit,
  buildArtworkIntegrationManifest,
  ARTWORK_PROVIDER_PREFERENCE,
  getProductionArtwork,
  getProductionArtworkByProvider,
  listProductionArtworkProviders,
  isMasterArtworkIntegrationEnabled,
} from "./artwork";

export {
  getEnrichedMetadata,
  getSourceMetadata,
  getSourceMetadataAvailability,
  listSourceMetadata,
  getProductionMetadata,
  isMasterMetadataIntegrationEnabled,
  buildMetadataIntegrationPackage,
  buildMetadataProductionCoverage,
  buildMetadataProviderCoverage,
  buildMetadataIntegrationAudit,
  buildMetadataIntegrationManifest,
} from "./metadata";

export {
  searchMasterIntegrated,
  resolveCanonicalIdFromShortcode,
  searchProductionEmojis,
  isMasterSearchIntegrationEnabled,
  buildSearchIntegrationPackage,
  buildSearchProductionCoverage,
  buildSearchRankingAudit,
  buildSearchIntegrationAudit,
  buildSearchIntegrationManifest,
  MASTER_SEARCH_SCORE,
} from "./search";

export {
  buildProductionSeoLookup,
  getMasterSeoForCanonical,
  getProductionSEO,
  getProductionSEOByEmoji,
  getExistingProductionPageMetadata,
  isMasterSeoIntegrationEnabled,
  isAmbiguousSeoTerm,
  isUtilityCanonicalId,
  evaluateSeoPolicy,
  buildSeoIntegrationPackage,
  buildSeoProductionCoverage,
  buildSeoCanonicalAudit,
  buildSeoSlugAudit,
  buildSeoIndexabilityAudit,
  buildSeoSitemapEligibility,
  buildSeoContentQualityAudit,
  buildSeoIntegrationAudit,
  buildSeoIntegrationManifest,
  SEO_BASELINES,
} from "./seo";

export {
  getUiArtworkProviders,
  resolveUiArtworkDisplay,
  getUiMetadataPayload,
  listUiAvailableMetadataSources,
  isMasterUiArtworkEnabled,
  isMasterUiMetadataEnabled,
  isMasterUiIntegrationActive,
  toUiProductionContext,
  resolveUiCanonicalId,
  getUiProductionArtworkProviders,
  getUiProductionMetadata,
  getFavoriteIdentityKey,
  getRecentIdentityKey,
  getCopyIdentityValue,
  getSharePath,
  runWithIntegrationFlags,
  buildUiIntegrationPackage,
  buildUiIntegrationAudit,
  buildUiArtworkCoverage,
  buildUiMetadataCoverage,
  buildUiProviderCoverage,
  buildUiLicenseCoverage,
  buildUiProductionSafety,
  buildUiIntegrationManifest,
  UI_BASELINES,
  PROVIDER_LABELS,
  PROVIDER_LICENSE_DEFAULTS,
  buildArtworkAttribution,
  formatArtworkRecordCount,
} from "./ui";

export { resolveProductionCanonicalId, loadProductionCanonicalIndex, resetProductionCanonicalIndex } from "./production-map";

export {
  mapProductionStandard,
  mapProductionExtra,
  buildProductionToMasterMap,
  buildIntegrationAuditReport,
  buildIntegrationManifest,
  buildIntegrationPackage,
} from "./build";

export type {
  MasterIntegrationConfig,
  ReleaseVerificationResult,
  ProductionToMasterEntry,
  ProductionToMasterMap,
  IntegrationAuditReport,
  IntegrationManifest,
  MasterArtworkEntry,
  MasterArtworkLookup,
  MasterMetadataSourceEntry,
  MasterMetadataLookup,
  MasterCanonicalLookup,
  MasterSearchMatchKind,
  MasterSearchResult,
  MasterSearchResponse,
  MasterDataCache,
  ProvenanceValue,
  ProductionRecordType,
} from "./types";

export type {
  IntegratedArtworkEntry,
  IntegratedArtworkLookup,
  IntegratedArtworkProviders,
  SupportedArtworkProvider,
  ArtworkProviderPreference,
  ArtworkProductionCoverageReport,
  ArtworkProviderCoverageReport,
  ArtworkIntegrationAuditReport,
  ArtworkIntegrationManifest,
} from "./artwork/types";

export type {
  MetadataSourceKey,
  EnrichedMetadataLookup,
  SourceMetadataRecord,
  MetadataProductionCoverageReport,
  MetadataProviderCoverageReport,
  MetadataIntegrationAuditReport,
  MetadataIntegrationManifest,
} from "./metadata/types";

export type {
  MasterSearchIntegrationResult,
  MasterSearchIntegrationResponse,
  SearchProductionCoverageReport,
  SearchRankingAuditReport,
  SearchIntegrationAuditReport,
  SearchIntegrationManifest,
} from "./search/types";

export type {
  ProductionSeoLookup,
  SeoEligibilityCategory,
  SeoProductionCoverageReport,
  SeoSlugAuditReport,
  SeoCanonicalAuditReport,
  SeoIndexabilityAuditReport,
  SeoSitemapEligibilityReport,
  SeoContentQualityAuditReport,
  SeoIntegrationAuditReport,
  SeoIntegrationManifest,
} from "./seo/types";

export type {
  UiArtworkDisplayResult,
  UiArtworkProviderOption,
  UiMetadataPayload,
  UiProductionContext,
  UiIntegrationAuditReport,
  UiIntegrationManifest,
  ArtworkAttributionInfo,
} from "./ui/types";

export { MasterIntegrationError } from "./types";
