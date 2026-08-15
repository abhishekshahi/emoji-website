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
  SEO_CANARY_STAGING_PHASE,
  integrationDataPaths,
} from "../config";
import { parseSeoRolloutMode } from "../seo-canary/rollout";

export type StagingCanaryDecision =
  | "A. STAGING CANARY PASS — READY FOR LIMITED TRAFFIC"
  | "B. STAGING CANARY PASS WITH ISSUES — REVIEW REQUIRED"
  | "C. STAGING CANARY FAIL — DO NOT PROCEED";

function stagingEnvelope<T extends Record<string, unknown>>(status: "PASS" | "FAIL" | "BLOCKED", extra: T) {
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEO_CANARY_STAGING_PHASE,
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

export function isLocalhostUrl(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return true;
  }
}

export function validateStagingEnvironment(
  baseUrl: string | undefined,
  environment: string | undefined,
  offBaseUrl?: string,
  rollbackBaseUrl?: string,
) {
  const errors: string[] = [];
  if (!baseUrl?.trim()) {
    errors.push("SEO_QA_BASE_URL is required for staging validation");
  } else if (isLocalhostUrl(baseUrl)) {
    errors.push("SEO_QA_BASE_URL must not be localhost for Phase 8.12G");
  }
  if (offBaseUrl?.trim() && isLocalhostUrl(offBaseUrl)) {
    errors.push("SEO_QA_OFF_BASE_URL must not be localhost for Phase 8.12G");
  }
  if (rollbackBaseUrl?.trim() && isLocalhostUrl(rollbackBaseUrl)) {
    errors.push("SEO_QA_ROLLBACK_BASE_URL must not be localhost for Phase 8.12G");
  }
  if (environment !== "staging") {
    errors.push("SEO_CANARY_ENVIRONMENT must be set to staging");
  }
  if (!offBaseUrl?.trim()) {
    errors.push("SEO_QA_OFF_BASE_URL is required for Phase 8.12G phased staging validation");
  }
  if (!rollbackBaseUrl?.trim()) {
    errors.push("SEO_QA_ROLLBACK_BASE_URL is required for Phase 8.12G phased staging validation");
  }
  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    baseUrl: baseUrl ?? null,
    offBaseUrl: offBaseUrl?.trim() || null,
    rollbackBaseUrl: rollbackBaseUrl?.trim() || null,
    environment: environment ?? null,
  });
}

export function buildStagingDeploymentAudit(
  baseUrl: string | null,
  environment: string | null,
  offBaseUrl: string | null = null,
  rollbackBaseUrl: string | null = null,
) {
  const checks = Object.freeze({
    baseUrlConfigured: Boolean(baseUrl && !isLocalhostUrl(baseUrl)),
    offBaseUrlConfigured: Boolean(offBaseUrl && !isLocalhostUrl(offBaseUrl)),
    rollbackBaseUrlConfigured: Boolean(rollbackBaseUrl && !isLocalhostUrl(rollbackBaseUrl)),
    environmentIsStaging: environment === "staging",
    rolloutModeCanarySupported: parseSeoRolloutMode("CANARY") === "CANARY",
    masterSeoFlagFalse: MASTER_INTEGRATION_CONFIG.masterSEOEnabled === false,
    masterArtworkFlagFalse: MASTER_INTEGRATION_CONFIG.masterArtworkEnabled === false,
    masterMetadataFlagFalse: MASTER_INTEGRATION_CONFIG.masterMetadataEnabled === false,
    masterSearchFlagFalse: MASTER_INTEGRATION_CONFIG.masterSearchEnabled === false,
  });
  return stagingEnvelope(Object.values(checks).every(Boolean) ? "PASS" : "FAIL", {
    environment,
    baseUrl,
    offBaseUrl,
    rollbackBaseUrl,
    seoRolloutMode: "CANARY",
    masterSeoFeatureFlag: false,
    checks,
  });
}

export function buildStagingBlockedPackage(
  rootDir: string = process.cwd(),
  reason: string,
  baseUrl?: string,
  environment?: string,
) {
  const datasetAudit = verifyApprovedRedirectDatasetEquivalence(rootDir);
  const productionSafetyAudit = buildProductionSafetyAudit(rootDir);
  const redirectBundleAudit = buildRedirectBundleAudit(rootDir);
  const deploymentAudit = buildStagingDeploymentAudit(baseUrl ?? null, environment ?? null);
  const skipped = stagingEnvelope("BLOCKED", {
    reason,
    note: "HTTP audits not executed — staging deployment unavailable",
  });

  const decision: StagingCanaryDecision = "C. STAGING CANARY FAIL — DO NOT PROCEED";
  const stagingDir = integrationDataPaths(rootDir).seoCanaryStagingIntegrationDir;
  const stagingManifest = stagingEnvelope("FAIL", {
    decision,
    blocker: reason,
    environment: environment ?? null,
    baseUrl: baseUrl ?? null,
    outputs: Object.freeze({
      stagingDeploymentAudit: `${stagingDir}/staging-deployment-audit.json`,
      httpRedirectAudit: `${stagingDir}/http-redirect-audit.json`,
      preservedUrlAudit: `${stagingDir}/preserved-url-audit.json`,
      excludedUrlAudit: `${stagingDir}/excluded-url-audit.json`,
      canonicalAudit: `${stagingDir}/canonical-audit.json`,
      sitemapAudit: `${stagingDir}/sitemap-audit.json`,
      emojiMatrixAudit: `${stagingDir}/emoji-matrix-audit.json`,
      securityAudit: `${stagingDir}/security-audit.json`,
      performanceAudit: `${stagingDir}/performance-audit.json`,
      rollbackAudit: `${stagingDir}/rollback-audit.json`,
      productionSafetyAudit: `${stagingDir}/production-safety-audit.json`,
      stagingManifest: `${stagingDir}/staging-manifest.json`,
    }),
    summary: Object.freeze({
      approvedRedirects: APPROVED_REDIRECT_BASELINE,
      preservedUrls: PRESERVED_URL_BASELINE,
      excludedUrls: EXCLUDED_URL_BASELINE,
      productionPages: PRODUCTION_BASELINES.totalSearchable,
      httpValidationExecuted: false,
      masterSEOEnabled: false,
    }),
    sections: Object.freeze({
      stagingDeploymentAudit: deploymentAudit.status,
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
    }),
  });

  return Object.freeze({
    deploymentAudit,
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
    stagingManifest,
    decision,
  });
}

export function classifyStagingCanaryDecision(input: {
  deploymentAudit: ReturnType<typeof buildStagingDeploymentAudit>;
  validation: ReturnType<typeof assembleCanaryValidationAudit>;
  productionSafetyAudit: ReturnType<typeof buildProductionSafetyAudit>;
  datasetAudit: ReturnType<typeof verifyApprovedRedirectDatasetEquivalence>;
}): StagingCanaryDecision {
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
    return "C. STAGING CANARY FAIL — DO NOT PROCEED";
  }

  const allPass = input.validation.canaryAudit.status === "PASS";
  if (allPass) {
    return "A. STAGING CANARY PASS — READY FOR LIMITED TRAFFIC";
  }

  return "B. STAGING CANARY PASS WITH ISSUES — REVIEW REQUIRED";
}

export async function buildStagingCanaryPackage(input: {
  baseUrl: string;
  offBaseUrl: string;
  rollbackBaseUrl: string;
  rootDir?: string;
  environment: string;
  offAudit: Awaited<ReturnType<typeof buildOffBehaviorHttpAudit>>;
  defaultOffAudit: Awaited<ReturnType<typeof buildOffBehaviorHttpAudit>>;
  canaryHttp: Awaited<ReturnType<typeof buildCanaryHttpAuditPackage>>;
  rollbackAudit: Awaited<ReturnType<typeof buildRollbackHttpAudit>>;
}) {
  const rootDir = input.rootDir ?? process.cwd();
  const offline = buildCanaryOfflinePackage(rootDir);
  const datasetAudit = verifyApprovedRedirectDatasetEquivalence(rootDir);
  const productionSafetyAudit = buildProductionSafetyAudit(rootDir);
  const redirectBundleAudit = buildRedirectBundleAudit(rootDir);
  const failureSafetyAudit = buildFailureSafetyValidation();
  const deploymentAudit = buildStagingDeploymentAudit(input.baseUrl, input.environment, input.offBaseUrl, input.rollbackBaseUrl);
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

  const decision = classifyStagingCanaryDecision({
    deploymentAudit,
    validation,
    productionSafetyAudit,
    datasetAudit,
  });

  const stagingDir = integrationDataPaths(rootDir).seoCanaryStagingIntegrationDir;
  const stagingManifest = stagingEnvelope(decision.startsWith("C") ? "FAIL" : "PASS", {
    decision,
    environment: input.environment,
    baseUrl: input.baseUrl,
    offBaseUrl: input.offBaseUrl,
    rollbackBaseUrl: input.rollbackBaseUrl,
    outputs: Object.freeze({
      stagingDeploymentAudit: `${stagingDir}/staging-deployment-audit.json`,
      httpRedirectAudit: `${stagingDir}/http-redirect-audit.json`,
      preservedUrlAudit: `${stagingDir}/preserved-url-audit.json`,
      excludedUrlAudit: `${stagingDir}/excluded-url-audit.json`,
      canonicalAudit: `${stagingDir}/canonical-audit.json`,
      sitemapAudit: `${stagingDir}/sitemap-audit.json`,
      emojiMatrixAudit: `${stagingDir}/emoji-matrix-audit.json`,
      securityAudit: `${stagingDir}/security-audit.json`,
      performanceAudit: `${stagingDir}/performance-audit.json`,
      rollbackAudit: `${stagingDir}/rollback-audit.json`,
      productionSafetyAudit: `${stagingDir}/production-safety-audit.json`,
      stagingManifest: `${stagingDir}/staging-manifest.json`,
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
      httpValidationExecuted: true,
    }),
    sections: Object.freeze({
      stagingDeploymentAudit: deploymentAudit.status,
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
    stagingManifest,
    decision,
  });
}
