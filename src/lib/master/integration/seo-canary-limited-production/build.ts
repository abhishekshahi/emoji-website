import {
  APPROVED_REDIRECT_BASELINE,
  EXCLUDED_URL_BASELINE,
  PRESERVED_URL_BASELINE,
} from "../seo-migration-implementation/types";
import {
  buildProductionSafetyAudit,
  buildRedirectBundleAudit,
  verifyApprovedRedirectDatasetEquivalence,
} from "../seo-migration-production-qa/build";
import {
  EXPECTED_RELEASE_ID,
  MASTER_INTEGRATION_CONFIG,
  PRODUCTION_BASELINES,
  SEO_CANARY_LIMITED_PRODUCTION_PHASE,
  integrationDataPaths,
} from "../config";
import { parseSeoRolloutMode } from "../seo-canary/rollout";

export type LimitedProductionCanaryDecision =
  | "A. LIMITED-PRODUCTION CANARY PASS"
  | "B. LIMITED-PRODUCTION CANARY PASS WITH MONITORING"
  | "C. LIMITED-PRODUCTION CANARY FAILED"
  | "D. LIMITED-PRODUCTION CANARY BLOCKED";

export interface LimitedProductionInfrastructureAudit {
  readonly hostingProvider: string;
  readonly projectId: string | null;
  readonly projectName: string | null;
  readonly planSupportsRollingReleases: boolean;
  readonly rollingReleaseConfigured: boolean;
  readonly customProductionDomain: string | null;
  readonly stableProductionUrl: string | null;
  readonly canaryDeploymentCreated: boolean;
  readonly requestedTrafficPercentage: number;
  readonly trafficSplitEnforced: boolean;
  readonly blocker: string;
}

function limitedProductionEnvelope<T extends Record<string, unknown>>(
  status: "PASS" | "FAIL" | "BLOCKED",
  extra: T,
) {
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEO_CANARY_LIMITED_PRODUCTION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    featureFlags: Object.freeze({
      masterArtworkEnabled: MASTER_INTEGRATION_CONFIG.masterArtworkEnabled,
      masterMetadataEnabled: MASTER_INTEGRATION_CONFIG.masterMetadataEnabled,
      masterSearchEnabled: MASTER_INTEGRATION_CONFIG.masterSearchEnabled,
      masterSEOEnabled: MASTER_INTEGRATION_CONFIG.masterSEOEnabled,
    }),
    auditOnly: true,
    ...extra,
    status,
  });
}

export function buildTrafficSplitAudit(infrastructure: LimitedProductionInfrastructureAudit) {
  const checks = Object.freeze({
    providerIdentified: infrastructure.hostingProvider.length > 0,
    rollingReleaseSupported: infrastructure.planSupportsRollingReleases,
    requestedOnePercent: infrastructure.requestedTrafficPercentage === 1,
    splitEnforced: infrastructure.trafficSplitEnforced,
    stableProductionPreserved: Boolean(infrastructure.stableProductionUrl),
    canaryNotPromotedToFullProduction: !infrastructure.canaryDeploymentCreated,
  });
  return limitedProductionEnvelope(
    infrastructure.trafficSplitEnforced ? "PASS" : "BLOCKED",
    {
      requestedTrafficPercentage: infrastructure.requestedTrafficPercentage,
      trafficSplitEnforced: infrastructure.trafficSplitEnforced,
      planSupportsRollingReleases: infrastructure.planSupportsRollingReleases,
      rollingReleaseConfigured: infrastructure.rollingReleaseConfigured,
      stableProductionUrl: infrastructure.stableProductionUrl,
      blocker: infrastructure.blocker,
      checks,
    },
  );
}

export function buildLimitedProductionDeploymentAudit(input: {
  commitSha: string;
  stableProductionUrl: string | null;
  infrastructure: LimitedProductionInfrastructureAudit;
}) {
  const checks = Object.freeze({
    commitRecorded: input.commitSha.length > 0,
    rolloutModeCanarySupported: parseSeoRolloutMode("CANARY") === "CANARY",
    masterSeoFlagFalse: MASTER_INTEGRATION_CONFIG.masterSEOEnabled === false,
    masterArtworkFlagFalse: MASTER_INTEGRATION_CONFIG.masterArtworkEnabled === false,
    masterMetadataFlagFalse: MASTER_INTEGRATION_CONFIG.masterMetadataEnabled === false,
    masterSearchFlagFalse: MASTER_INTEGRATION_CONFIG.masterSearchEnabled === false,
    stableProductionIdentified: Boolean(input.stableProductionUrl),
    canaryDeploymentSafeToCreate: input.infrastructure.trafficSplitEnforced,
  });
  return limitedProductionEnvelope(
    input.infrastructure.trafficSplitEnforced ? "PASS" : "BLOCKED",
    {
      commitSha: input.commitSha,
      stableProductionUrl: input.stableProductionUrl,
      canaryDeploymentUrl: null,
      environment: "production-canary",
      seoRolloutMode: "CANARY",
      masterSeoFeatureFlag: false,
      infrastructure: input.infrastructure,
      checks,
    },
  );
}

export function buildMonitoringComparisonAudit(infrastructure: LimitedProductionInfrastructureAudit) {
  return limitedProductionEnvelope("BLOCKED", {
    note: "Monitoring comparison not executed - limited-production canary blocked before traffic routing",
    canaryMonitoringAvailable: false,
    stableMonitoringAvailable: false,
    blocker: infrastructure.blocker,
  });
}

export function buildLimitedProductionBlockedPackage(
  rootDir: string = process.cwd(),
  infrastructure: LimitedProductionInfrastructureAudit,
  input?: {
    commitSha?: string;
    stableProductionUrl?: string | null;
  },
) {
  const datasetAudit = verifyApprovedRedirectDatasetEquivalence(rootDir);
  const productionSafetyAudit = buildProductionSafetyAudit(rootDir);
  const redirectBundleAudit = buildRedirectBundleAudit(rootDir);
  const commitSha = input?.commitSha ?? "unknown";
  const stableProductionUrl = input?.stableProductionUrl ?? infrastructure.stableProductionUrl;
  const deploymentAudit = buildLimitedProductionDeploymentAudit({
    commitSha,
    stableProductionUrl,
    infrastructure,
  });
  const trafficSplitAudit = buildTrafficSplitAudit(infrastructure);
  const monitoringComparison = buildMonitoringComparisonAudit(infrastructure);
  const skipped = limitedProductionEnvelope("BLOCKED", {
    reason: infrastructure.blocker,
    note: "HTTP production-canary audits not executed - traffic splitting unavailable",
  });

  const decision: LimitedProductionCanaryDecision = "D. LIMITED-PRODUCTION CANARY BLOCKED";
  const outputDir = integrationDataPaths(rootDir).seoCanaryLimitedProductionIntegrationDir;
  const finalCanaryManifest = limitedProductionEnvelope("BLOCKED", {
    decision,
    blocker: infrastructure.blocker,
    environment: "production-canary",
    commitSha,
    stableProductionUrl,
    canaryDeploymentUrl: null,
    requestedTrafficPercentage: infrastructure.requestedTrafficPercentage,
    trafficSplitEnforced: false,
    rolloutMode: "OFF",
    outputs: Object.freeze({
      deploymentAudit: `${outputDir}/deployment-audit.json`,
      trafficSplitAudit: `${outputDir}/traffic-split-audit.json`,
      httpRedirectAudit: `${outputDir}/http-redirect-audit.json`,
      preservedUrlAudit: `${outputDir}/preserved-url-audit.json`,
      excludedUrlAudit: `${outputDir}/excluded-url-audit.json`,
      canonicalAudit: `${outputDir}/canonical-audit.json`,
      sitemapAudit: `${outputDir}/sitemap-audit.json`,
      emojiMatrixAudit: `${outputDir}/emoji-matrix-audit.json`,
      securityAudit: `${outputDir}/security-audit.json`,
      performanceAudit: `${outputDir}/performance-audit.json`,
      productionSafetyAudit: `${outputDir}/production-safety-audit.json`,
      rollbackAudit: `${outputDir}/rollback-audit.json`,
      monitoringComparison: `${outputDir}/monitoring-comparison.json`,
      finalCanaryManifest: `${outputDir}/final-canary-manifest.json`,
    }),
    summary: Object.freeze({
      approvedRedirects: APPROVED_REDIRECT_BASELINE,
      preservedUrls: PRESERVED_URL_BASELINE,
      excludedUrls: EXCLUDED_URL_BASELINE,
      productionPages: PRODUCTION_BASELINES.totalSearchable,
      httpValidationExecuted: false,
      monitoringExecuted: false,
      masterSEOEnabled: false,
      rolloutModeNeverFull: true,
    }),
    sections: Object.freeze({
      deploymentAudit: deploymentAudit.status,
      trafficSplitAudit: trafficSplitAudit.status,
      datasetAudit: datasetAudit.status,
      productionSafetyAudit: productionSafetyAudit.status,
      redirectBundleAudit: redirectBundleAudit.status,
      httpRedirectAudit: "BLOCKED",
      preservedUrlAudit: "BLOCKED",
      excludedUrlAudit: "BLOCKED",
      canonicalAudit: "BLOCKED",
      sitemapAudit: "BLOCKED",
      emojiMatrixAudit: "BLOCKED",
      securityAudit: "BLOCKED",
      performanceAudit: "BLOCKED",
      rollbackAudit: "BLOCKED",
      monitoringComparison: monitoringComparison.status,
    }),
  });

  return Object.freeze({
    deploymentAudit,
    trafficSplitAudit,
    monitoringComparison,
    datasetAudit,
    productionSafetyAudit,
    redirectBundleAudit,
    httpRedirectAudit: skipped,
    preservedUrlAudit: skipped,
    excludedUrlAudit: skipped,
    canonicalAudit: skipped,
    sitemapAudit: skipped,
    emojiMatrixAudit: skipped,
    securityAudit: skipped,
    performanceAudit: skipped,
    rollbackAudit: skipped,
    finalCanaryManifest,
    decision,
  });
}