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
  assembleCanaryValidationAudit,
  buildCanaryComparisonAudit,
  buildCanaryHttpAuditPackage,
  buildFailureSafetyValidation,
  buildOffBehaviorHttpAudit,
  buildRollbackHttpAudit,
} from "../seo-canary/validation-build";
import { buildCanaryOfflinePackage } from "../seo-migration-production-qa/build";
import {
  EXPECTED_RELEASE_ID,
  MASTER_INTEGRATION_CONFIG,
  PRODUCTION_BASELINES,
  SEO_CANARY_PRODUCTION_PHASE,
  integrationDataPaths,
} from "../config";
import { getSeoRolloutMode, parseSeoRolloutMode } from "../seo-canary/rollout";

export type CanaryProductionDecision =
  | "A. CANARY PASS — READY FOR LIMITED TRAFFIC"
  | "B. CANARY PASS WITH ISSUES — REQUIRES REVIEW"
  | "C. CANARY FAIL — DO NOT PROCEED";

function productionEnvelope<T extends Record<string, unknown>>(status: "PASS" | "FAIL", extra: T) {
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEO_CANARY_PRODUCTION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    rolloutMode: getSeoRolloutMode(),
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

export function buildCanaryDeploymentAudit(baseUrl: string, environment: string) {
  const checks = Object.freeze({
    rolloutModeCanary: parseSeoRolloutMode("CANARY") === "CANARY",
    masterSeoFlagFalse: MASTER_INTEGRATION_CONFIG.masterSEOEnabled === false,
    masterArtworkFlagFalse: MASTER_INTEGRATION_CONFIG.masterArtworkEnabled === false,
    masterMetadataFlagFalse: MASTER_INTEGRATION_CONFIG.masterMetadataEnabled === false,
    masterSearchFlagFalse: MASTER_INTEGRATION_CONFIG.masterSearchEnabled === false,
    dedicatedEnvironment: environment.length > 0,
    baseUrlConfigured: baseUrl.length > 0,
  });
  return productionEnvelope(Object.values(checks).every(Boolean) ? "PASS" : "FAIL", {
    environment,
    baseUrl,
    seoRolloutMode: "CANARY",
    masterSeoFeatureFlag: false,
    checks,
  });
}

export function classifyCanaryProductionDecision(input: {
  deploymentAudit: ReturnType<typeof buildCanaryDeploymentAudit>;
  validation: ReturnType<typeof assembleCanaryValidationAudit>;
  productionSafetyAudit: ReturnType<typeof buildProductionSafetyAudit>;
  datasetAudit: ReturnType<typeof verifyApprovedRedirectDatasetEquivalence>;
}): CanaryProductionDecision {
  const criticalPass =
    input.deploymentAudit.status === "PASS" &&
    input.validation.canaryHttp.httpRedirectAudit.failureCount === 0 &&
    input.validation.canaryHttp.preservedUrlHttpAudit.status === "PASS" &&
    input.validation.canaryHttp.excludedUrlAudit.status === "PASS" &&
    input.validation.canaryHttp.redirectSecurityAudit.status === "PASS" &&
    input.validation.rollbackAudit.status === "PASS" &&
    input.validation.defaultOffAudit.status === "PASS" &&
    input.productionSafetyAudit.status === "PASS" &&
    input.datasetAudit.status === "PASS";

  if (!criticalPass) {
    return "C. CANARY FAIL — DO NOT PROCEED";
  }

  const allPass = input.validation.canaryAudit.status === "PASS";
  if (allPass) {
    return "A. CANARY PASS — READY FOR LIMITED TRAFFIC";
  }

  return "B. CANARY PASS WITH ISSUES — REQUIRES REVIEW";
}

export async function buildCanaryProductionPackage(
  input: {
    baseUrl: string;
    rootDir?: string;
    environment?: string;
    offAudit: Awaited<ReturnType<typeof buildOffBehaviorHttpAudit>>;
    defaultOffAudit: Awaited<ReturnType<typeof buildOffBehaviorHttpAudit>>;
    canaryHttp: Awaited<ReturnType<typeof buildCanaryHttpAuditPackage>>;
    rollbackAudit: Awaited<ReturnType<typeof buildRollbackHttpAudit>>;
  },
) {
  const rootDir = input.rootDir ?? process.cwd();
  const environment = input.environment ?? "local-production-like";
  const offline = buildCanaryOfflinePackage(rootDir);
  const datasetAudit = verifyApprovedRedirectDatasetEquivalence(rootDir);
  const productionSafetyAudit = buildProductionSafetyAudit(rootDir);
  const redirectBundleAudit = buildRedirectBundleAudit(rootDir);
  const failureSafetyAudit = buildFailureSafetyValidation();
  const deploymentAudit = buildCanaryDeploymentAudit(input.baseUrl, environment);
  const comparisonAudit = buildCanaryComparisonAudit(input.offAudit, input.canaryHttp.httpRedirectAudit);

  const validation = assembleCanaryValidationAudit({
    offline,
    offAudit: input.offAudit,
    defaultOffAudit: input.defaultOffAudit,
    canaryHttp: input.canaryHttp,
    rollbackAudit: input.rollbackAudit,
    comparisonAudit,
    failureSafetyAudit,
  });

  const decision = classifyCanaryProductionDecision({
    deploymentAudit,
    validation,
    productionSafetyAudit,
    datasetAudit,
  });

  const finalCanaryManifest = productionEnvelope(decision.startsWith("C") ? "FAIL" : "PASS", {
    decision,
    environment,
    baseUrl: input.baseUrl,
    outputs: Object.freeze({
      deploymentAudit: `${integrationDataPaths(rootDir).seoCanaryProductionIntegrationDir}/canary-deployment-audit.json`,
      httpRedirectAudit: `${integrationDataPaths(rootDir).seoCanaryProductionIntegrationDir}/http-redirect-audit.json`,
      preservedUrlAudit: `${integrationDataPaths(rootDir).seoCanaryProductionIntegrationDir}/preserved-url-audit.json`,
      excludedUrlAudit: `${integrationDataPaths(rootDir).seoCanaryProductionIntegrationDir}/excluded-url-audit.json`,
      canonicalAudit: `${integrationDataPaths(rootDir).seoCanaryProductionIntegrationDir}/canonical-audit.json`,
      sitemapAudit: `${integrationDataPaths(rootDir).seoCanaryProductionIntegrationDir}/sitemap-audit.json`,
      emojiMatrixAudit: `${integrationDataPaths(rootDir).seoCanaryProductionIntegrationDir}/emoji-matrix-audit.json`,
      securityAudit: `${integrationDataPaths(rootDir).seoCanaryProductionIntegrationDir}/security-audit.json`,
      performanceAudit: `${integrationDataPaths(rootDir).seoCanaryProductionIntegrationDir}/performance-audit.json`,
      rollbackAudit: `${integrationDataPaths(rootDir).seoCanaryProductionIntegrationDir}/rollback-audit.json`,
      productionSafetyAudit: `${integrationDataPaths(rootDir).seoCanaryProductionIntegrationDir}/production-safety-audit.json`,
      finalCanaryManifest: `${integrationDataPaths(rootDir).seoCanaryProductionIntegrationDir}/final-canary-manifest.json`,
    }),
    summary: Object.freeze({
      approvedRedirects: APPROVED_REDIRECT_BASELINE,
      preservedUrls: PRESERVED_URL_BASELINE,
      excludedUrls: EXCLUDED_URL_BASELINE,
      productionPages: PRODUCTION_BASELINES.totalSearchable,
      redirectFailures: input.canaryHttp.httpRedirectAudit.failureCount,
      preservedBreakdown: input.canaryHttp.preservedUrlHttpAudit.byDecision,
      masterSEOEnabled: false,
      rolloutMode: "CANARY",
    }),
    sections: Object.freeze({
      deploymentAudit: deploymentAudit.status,
      datasetAudit: datasetAudit.status,
      httpRedirectAudit: input.canaryHttp.httpRedirectAudit.status,
      preservedUrlAudit: input.canaryHttp.preservedUrlHttpAudit.status,
      excludedUrlAudit: input.canaryHttp.excludedUrlAudit.status,
      canonicalAudit: input.canaryHttp.canonicalHttpAudit.status,
      sitemapAudit: input.canaryHttp.sitemapProductionAudit.status,
      emojiMatrixAudit: input.canaryHttp.emojiUrlMatrixAudit.status,
      securityAudit: input.canaryHttp.redirectSecurityAudit.status,
      performanceAudit: input.canaryHttp.redirectPerformanceAudit.status,
      rollbackAudit: input.rollbackAudit.status,
      offRollbackAudit: input.defaultOffAudit.status,
      productionSafetyAudit: productionSafetyAudit.status,
      redirectBundleAudit: redirectBundleAudit.status,
    }),
  });

  return Object.freeze({
    deploymentAudit,
    datasetAudit,
    httpRedirectAudit: input.canaryHttp.httpRedirectAudit,
    preservedUrlAudit: input.canaryHttp.preservedUrlHttpAudit,
    excludedUrlAudit: input.canaryHttp.excludedUrlAudit,
    canonicalAudit: input.canaryHttp.canonicalHttpAudit,
    sitemapAudit: input.canaryHttp.sitemapProductionAudit,
    emojiMatrixAudit: input.canaryHttp.emojiUrlMatrixAudit,
    securityAudit: input.canaryHttp.redirectSecurityAudit,
    performanceAudit: input.canaryHttp.redirectPerformanceAudit,
    rollbackAudit: input.rollbackAudit,
    offAudit: input.offAudit,
    defaultOffAudit: input.defaultOffAudit,
    comparisonAudit,
    productionSafetyAudit,
    redirectBundleAudit,
    validation,
    finalCanaryManifest,
    decision,
  });
}
