import type { MasterIntegrationConfig } from "./types";

export const EXPECTED_RELEASE_ID = "master-8.10-20260809" as const;
export const EXPECTED_RELEASE_PHASE = "8.10" as const;
export const EXPECTED_RELEASE_STATUS = "frozen" as const;

export const INTEGRATION_PHASE = "8.11A" as const;
export const ARTWORK_INTEGRATION_PHASE = "8.11B" as const;
export const METADATA_SEARCH_INTEGRATION_PHASE = "8.11C" as const;
export const SEO_INTEGRATION_PHASE = "8.11D" as const;
export const UI_INTEGRATION_PHASE = "8.11E" as const;
export const ACTIVATION_PHASE = "8.11F" as const;
export const SEARCH_ACTIVATION_PHASE = "8.11G" as const;
export const SEARCH_UI_PHASE = "8.11H" as const;
export const FINAL_ACTIVATION_PHASE = "8.11I" as const;
export const ROLLOUT_READINESS_PHASE = "8.12" as const;
export const SEO_MIGRATION_PHASE = "8.12A" as const;
export const SEO_MIGRATION_REVIEW_PHASE = "8.12B" as const;
export const SEO_MIGRATION_IMPLEMENTATION_PHASE = "8.12C" as const;
export const SEO_MIGRATION_PRODUCTION_QA_PHASE = "8.12D" as const;
export const SEO_CANARY_PHASE = "8.12E" as const;
export const SEO_CANARY_PRODUCTION_PHASE = "8.12F" as const;
export const SEO_CANARY_STAGING_PHASE = "8.12G" as const;
export const SEO_CANARY_LIMITED_PRODUCTION_PHASE = "8.12H" as const;
export const CLOUDFLARE_PROOF_PHASE = "8.12K" as const;

export const PRODUCTION_BASELINES = {
  standardRecords: 3944,
  extrasRecords: 542,
  totalSearchable: 4486,
} as const;

export const MASTER_INTEGRATION_CONFIG: MasterIntegrationConfig = {
  masterIntegrationEnabled: false,
  masterArtworkEnabled: true,
  masterMetadataEnabled: true,
  masterSearchEnabled: true,
  masterSEOEnabled: false,
};

export function integrationDataPaths(rootDir: string): {
  releaseDir: string;
  masterDir: string;
  integrationDir: string;
  artworkIntegrationDir: string;
  metadataIntegrationDir: string;
  searchIntegrationDir: string;
  seoIntegrationDir: string;
  uiIntegrationDir: string;
  activationIntegrationDir: string;
  searchActivationIntegrationDir: string;
  searchUiIntegrationDir: string;
  finalActivationIntegrationDir: string;
  rolloutReadinessIntegrationDir: string;
  seoMigrationIntegrationDir: string;
  seoMigrationReviewIntegrationDir: string;
  seoMigrationImplementationIntegrationDir: string;
  seoMigrationProductionQaIntegrationDir: string;
  seoCanaryIntegrationDir: string;
  seoCanaryProductionIntegrationDir: string;
  seoCanaryStagingIntegrationDir: string;
  seoCanaryLimitedProductionIntegrationDir: string;
  cloudflareProofIntegrationDir: string;
} {
  return {
    releaseDir: `${rootDir}/src/data/master/release/8.10`,
    masterDir: `${rootDir}/src/data/master`,
    integrationDir: `${rootDir}/src/data/master/integration`,
    artworkIntegrationDir: `${rootDir}/src/data/master/integration/artwork`,
    metadataIntegrationDir: `${rootDir}/src/data/master/integration/metadata`,
    searchIntegrationDir: `${rootDir}/src/data/master/integration/search`,
    seoIntegrationDir: `${rootDir}/src/data/master/integration/seo`,
    uiIntegrationDir: `${rootDir}/src/data/master/integration/ui`,
    activationIntegrationDir: `${rootDir}/src/data/master/integration/activation`,
    searchActivationIntegrationDir: `${rootDir}/src/data/master/integration/search-activation`,
    searchUiIntegrationDir: `${rootDir}/src/data/master/integration/search-ui`,
    finalActivationIntegrationDir: `${rootDir}/src/data/master/integration/final-activation`,
    rolloutReadinessIntegrationDir: `${rootDir}/src/data/master/integration/rollout-readiness`,
    seoMigrationIntegrationDir: `${rootDir}/src/data/master/integration/seo-migration`,
    seoMigrationReviewIntegrationDir: `${rootDir}/src/data/master/integration/seo-migration-review`,
    seoMigrationImplementationIntegrationDir: `${rootDir}/src/data/master/integration/seo-migration-implementation`,
    seoMigrationProductionQaIntegrationDir: `${rootDir}/src/data/master/integration/seo-migration-production-qa`,
    seoCanaryIntegrationDir: `${rootDir}/src/data/master/integration/seo-canary`,
    seoCanaryProductionIntegrationDir: `${rootDir}/src/data/master/integration/seo-canary-production`,
    seoCanaryStagingIntegrationDir: `${rootDir}/src/data/master/integration/seo-canary-staging`,
    seoCanaryLimitedProductionIntegrationDir: `${rootDir}/src/data/master/integration/seo-canary-limited-production`,
    cloudflareProofIntegrationDir: `${rootDir}/src/data/master/integration/cloudflare-proof`,
  };
}
