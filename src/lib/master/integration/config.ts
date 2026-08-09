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

export const PRODUCTION_BASELINES = {
  standardRecords: 3944,
  extrasRecords: 542,
  totalSearchable: 4486,
} as const;

export const MASTER_INTEGRATION_CONFIG: MasterIntegrationConfig = {
  masterIntegrationEnabled: false,
  masterArtworkEnabled: false,
  masterMetadataEnabled: false,
  masterSearchEnabled: false,
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
  };
}
