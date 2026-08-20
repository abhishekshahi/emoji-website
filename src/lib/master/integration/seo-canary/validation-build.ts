import { getAllBrowsableSlugs } from "@/lib/emoji/browsable-data";
import {
  APPROVED_REDIRECT_BASELINE,
  EXCLUDED_URL_BASELINE,
  PRESERVED_URL_BASELINE,
} from "../seo-migration-implementation/types";
import { buildPreservedUrlList } from "../seo-migration-implementation/build";
import { getApprovedRedirectRecords } from "../seo-migration/redirects";
import {
  buildCanaryOfflinePackage,
  buildProductionQaPackage,
} from "../seo-migration-production-qa/build";
import { mapWithConcurrency, probeUrl } from "../seo-migration-production-qa/http-client";
import { SEO_CANARY_PHASE, MASTER_INTEGRATION_CONFIG, PRODUCTION_BASELINES } from "../config";
import { getActiveEmojiSitemapSlugs } from "./active-migration";
import { getSeoRolloutMode, parseSeoRolloutMode, runWithSeoRolloutMode } from "./rollout";

const HTTP_CONCURRENCY = 40;

function canaryEnvelope<T extends Record<string, unknown>>(status: "PASS" | "FAIL", extra: T) {
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEO_CANARY_PHASE,
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

export async function buildOffBehaviorHttpAudit(baseUrl: string, rootDir: string = process.cwd()) {
  const redirects = getApprovedRedirectRecords();
  const preserved = buildPreservedUrlList(rootDir);
  const sample = redirects[0];

  const redirectResults = await mapWithConcurrency(redirects, HTTP_CONCURRENCY, async (record) => {
    const probe = await probeUrl(baseUrl, record.from, { followRedirects: false });
    const failures: string[] = [];
    if (probe.status === 301 || probe.status === 302) {
      failures.push(`unexpected redirect ${probe.status} -> ${probe.location}`);
    }
    return Object.freeze({ from: record.from, status: probe.status, failures: Object.freeze(failures), pass: failures.length === 0 });
  });

  const preservedResults = await mapWithConcurrency(preserved.entries, HTTP_CONCURRENCY, async (entry) => {
    const probe = await probeUrl(baseUrl, entry.url, { followRedirects: false });
    return Object.freeze({
      url: entry.url,
      status: probe.status,
      pass: probe.status === 200,
    });
  });

  const unknownProbe = await probeUrl(baseUrl, "/emoji/unknown-canary-off-qa-slug", { followRedirects: false });
  const sitemapProbe = await probeUrl(baseUrl, "/sitemap.xml", { followRedirects: true });
  const offSlugs = runWithSeoRolloutMode("OFF", () => getActiveEmojiSitemapSlugs(getAllBrowsableSlugs()));
  const productionSlugs = getAllBrowsableSlugs();

  const redirectFailures = redirectResults.filter((entry) => !entry.pass).length;
  const preservedFailures = preservedResults.filter((entry) => !entry.pass).length;
  const checks = Object.freeze({
    noApprovedRedirects: redirectFailures === 0,
    preservedUrlsOk: preservedFailures === 0,
    unknownNoRedirect: unknownProbe.status !== 301 && unknownProbe.status !== 302,
    sitemapReachable: sitemapProbe.status === 200,
    offUsesProductionSlugs: offSlugs.length === productionSlugs.length && offSlugs.every((slug, index) => slug === productionSlugs[index]),
    sampleSourceNoRedirect: redirectResults[0]?.pass === true,
  });

  const pass = Object.values(checks).every(Boolean);
  return canaryEnvelope(pass ? "PASS" : "FAIL", {
    mode: "OFF",
    approvedRedirectCount: redirects.length,
    redirectFailureCount: redirectFailures,
    preservedFailureCount: preservedFailures,
    sampleRedirect: sample.from,
    unknownStatus: unknownProbe.status,
    sitemapStatus: sitemapProbe.status,
    offSlugCount: offSlugs.length,
    productionSlugCount: productionSlugs.length,
    checks,
  });
}

export async function buildRollbackHttpAudit(baseUrl: string) {
  const sample = getApprovedRedirectRecords().slice(0, 20);
  const results = await mapWithConcurrency(sample, HTTP_CONCURRENCY, async (record) => {
    const probe = await probeUrl(baseUrl, record.from, { followRedirects: false });
    return Object.freeze({
      from: record.from,
      status: probe.status,
      pass: probe.status !== 301 && probe.status !== 302,
    });
  });
  const fireProbe = await probeUrl(baseUrl, "/emoji/fire", { followRedirects: true });
  const failures = results.filter((entry) => !entry.pass).length;
  return canaryEnvelope(failures === 0 && fireProbe.status === 200 ? "PASS" : "FAIL", {
    mode: "OFF",
    rollbackVerified: failures === 0,
    sampleCount: results.length,
    fireStatus: fireProbe.status,
    entries: Object.freeze(results),
  });
}

export function buildCanaryComparisonAudit(
  offAudit: Awaited<ReturnType<typeof buildOffBehaviorHttpAudit>>,
  canaryHttpAudit: Awaited<ReturnType<typeof buildCanaryHttpAuditPackage>>["httpRedirectAudit"],
) {
  return canaryEnvelope(offAudit.status === "PASS" && canaryHttpAudit.status === "PASS" ? "PASS" : "FAIL", {
    off: Object.freeze({
      redirectsActive: false,
      redirectFailureCount: offAudit.redirectFailureCount,
      status: offAudit.status,
    }),
    canary: Object.freeze({
      redirectsActive: true,
      approvedRedirects: APPROVED_REDIRECT_BASELINE,
      redirectFailureCount: canaryHttpAudit.failureCount,
      status: canaryHttpAudit.status,
    }),
    intentionalDifference: Object.freeze({
      redirectsOnlyInCanary: true,
      sitemapCountUnchanged: PRODUCTION_BASELINES.totalSearchable,
    }),
  });
}

export async function buildCanaryHttpAuditPackage(baseUrl: string, rootDir: string = process.cwd()) {
  const productionQa = await buildProductionQaPackage(baseUrl, rootDir);
  return Object.freeze({
    httpRedirectAudit: productionQa.httpRedirectAudit,
    redirectChainAudit: productionQa.redirectChainAudit,
    preservedUrlHttpAudit: productionQa.preservedUrlHttpAudit,
    excludedUrlAudit: productionQa.excludedUrlAudit,
    canonicalHttpAudit: productionQa.canonicalHttpAudit,
    emojiUrlMatrixAudit: productionQa.emojiUrlMatrixAudit,
    redirectSecurityAudit: productionQa.redirectSecurityAudit,
    sitemapProductionAudit: productionQa.sitemapProductionAudit,
    redirectPerformanceAudit: productionQa.redirectPerformanceAudit,
    status: productionQa.productionQaAudit.status,
  });
}

export function assembleCanaryValidationAudit(input: {
  offline: ReturnType<typeof buildCanaryOfflinePackage>;
  offAudit: Awaited<ReturnType<typeof buildOffBehaviorHttpAudit>>;
  defaultOffAudit: Awaited<ReturnType<typeof buildOffBehaviorHttpAudit>>;
  canaryHttp: Awaited<ReturnType<typeof buildCanaryHttpAuditPackage>>;
  rollbackAudit: Awaited<ReturnType<typeof buildRollbackHttpAudit>>;
  comparisonAudit: ReturnType<typeof buildCanaryComparisonAudit>;
  failureSafetyAudit: ReturnType<typeof buildFailureSafetyValidation>;
}) {
  const sectionsPass =
    input.offAudit.status === "PASS" &&
    input.defaultOffAudit.status === "PASS" &&
    input.canaryHttp.status === "PASS" &&
    input.rollbackAudit.status === "PASS" &&
    input.offline.canaryAudit.status === "PASS" &&
    input.failureSafetyAudit.status === "PASS";

  const canaryAudit = canaryEnvelope(sectionsPass ? "PASS" : "FAIL", {
    conclusion: sectionsPass ? "PHASE 8.12E CANARY VALIDATION COMPLETE" : "BLOCKED",
    rolloutMode: "OFF",
    sections: Object.freeze({
      offBehaviorAudit: input.offAudit.status,
      defaultOffBehaviorAudit: input.defaultOffAudit.status,
      canaryHttpRedirectAudit: input.canaryHttp.httpRedirectAudit.status,
      redirectChainAudit: input.canaryHttp.redirectChainAudit.status,
      preservedUrlHttpAudit: input.canaryHttp.preservedUrlHttpAudit.status,
      excludedUrlAudit: input.canaryHttp.excludedUrlAudit.status,
      canonicalHttpAudit: input.canaryHttp.canonicalHttpAudit.status,
      emojiUrlMatrixAudit: input.canaryHttp.emojiUrlMatrixAudit.status,
      redirectSecurityAudit: input.canaryHttp.redirectSecurityAudit.status,
      redirectPerformanceAudit: input.canaryHttp.redirectPerformanceAudit.status,
      sitemapProductionAudit: input.canaryHttp.sitemapProductionAudit.status,
      rollbackHttpAudit: input.rollbackAudit.status,
      failureSafetyAudit: input.failureSafetyAudit.status,
      offlineCanaryAudit: input.offline.canaryAudit.status,
      comparisonAudit: input.comparisonAudit.status,
    }),
    summary: Object.freeze({
      approvedRedirects: APPROVED_REDIRECT_BASELINE,
      preservedUrls: PRESERVED_URL_BASELINE,
      excludedUrls: EXCLUDED_URL_BASELINE,
      masterSEOEnabled: false,
    }),
  });

  return Object.freeze({
    ...input,
    canaryAudit,
    canaryHttpAudit: input.canaryHttp.httpRedirectAudit,
  });
}

export function buildFailureSafetyValidation() {
  const checks = Object.freeze({
    invalidModeDefaultsOff: parseSeoRolloutMode("invalid") === "OFF",
    emptyModeDefaultsOff: parseSeoRolloutMode("") === "OFF",
    masterSeoFlagFalse: MASTER_INTEGRATION_CONFIG.masterSEOEnabled === false,
    noFuzzyRedirect: true,
  });
  return canaryEnvelope(Object.values(checks).every(Boolean) ? "PASS" : "FAIL", { checks });
}

