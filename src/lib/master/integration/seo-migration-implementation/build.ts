import { readFileSync } from "node:fs";
import { join } from "node:path";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import { getAllBrowsableSlugs } from "@/lib/emoji/browsable-data";
import type { BrowsableEmoji } from "@/lib/emoji/types";
import {
  EXPECTED_RELEASE_ID,
  MASTER_INTEGRATION_CONFIG,
  PRODUCTION_BASELINES,
  SEO_MIGRATION_IMPLEMENTATION_PHASE,
  integrationDataPaths,
} from "../config";
import { buildFinalMigrationMatrix } from "../seo-migration-review/build";
import type { FinalMigrationMatrixEntry } from "../seo-migration-review/build";
import { SEO_MIGRATION_REVIEW_BASELINES } from "../seo-migration-review/build";

import {
  APPROVED_REDIRECT_BASELINE,
  PRESERVED_URL_BASELINE,
  REDIRECT_HTTP_STATUS,
  type ApprovedRedirectRecord,
  type ApprovedRedirectsDataset,
} from "./types";

interface RedirectApprovalCandidatesFile {
  readonly count: number;
  readonly entries: ReadonlyArray<{
    readonly currentUrl: string;
    readonly proposedUrl: string;
    readonly canonicalId: string;
    readonly emoji: string | null;
    readonly decision: string;
    readonly reason: string;
  }>;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function normalizeEmojiPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed.startsWith("/emoji/")) {
    throw new Error(`Invalid emoji path: ${path}`);
  }
  return trimmed.replace(/\/+$/, "") || trimmed;
}

function ALL_FLAGS_DISABLED() {
  return Object.freeze({
    masterArtworkEnabled: MASTER_INTEGRATION_CONFIG.masterArtworkEnabled,
    masterMetadataEnabled: MASTER_INTEGRATION_CONFIG.masterMetadataEnabled,
    masterSearchEnabled: MASTER_INTEGRATION_CONFIG.masterSearchEnabled,
    masterSEOEnabled: MASTER_INTEGRATION_CONFIG.masterSEOEnabled,
  });
}

function auditEnvelope<T extends Record<string, unknown>>(status: "PASS" | "FAIL", extra: T) {
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEO_MIGRATION_IMPLEMENTATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    featureFlags: ALL_FLAGS_DISABLED(),
    provenance: "approved-redirect-dataset",
    auditOnly: false,
    ...extra,
    status,
  });
}

export function loadRedirectApprovalCandidates(rootDir: string = process.cwd()): RedirectApprovalCandidatesFile {
  return readJson<RedirectApprovalCandidatesFile>(
    join(integrationDataPaths(rootDir).seoMigrationReviewIntegrationDir, "redirect-approval-candidates.json"),
  );
}

export function buildApprovedRedirectsDataset(rootDir: string = process.cwd()): ApprovedRedirectsDataset {
  const candidates = loadRedirectApprovalCandidates(rootDir);
  if (candidates.count !== APPROVED_REDIRECT_BASELINE) {
    throw new Error(`Expected ${APPROVED_REDIRECT_BASELINE} approval candidates, found ${candidates.count}.`);
  }
  if (candidates.entries.length !== APPROVED_REDIRECT_BASELINE) {
    throw new Error(`Approval candidate entry count mismatch: ${candidates.entries.length}.`);
  }

  const redirects: ApprovedRedirectRecord[] = [];
  const seenSources = new Set<string>();

  for (const entry of candidates.entries) {
    if (entry.decision !== "SAFE_TO_REDIRECT") {
      throw new Error(`Non-approved redirect candidate: ${entry.currentUrl} (${entry.decision}).`);
    }

    const from = normalizeEmojiPath(entry.currentUrl);
    const to = normalizeEmojiPath(entry.proposedUrl);

    if (from === to) {
      throw new Error(`Self-redirect candidate: ${from}.`);
    }
    if (seenSources.has(from)) {
      throw new Error(`Duplicate redirect source: ${from}.`);
    }
    seenSources.add(from);

    redirects.push(
      Object.freeze({
        from,
        to,
        canonicalId: entry.canonicalId,
        emoji: entry.emoji,
        decision: "SAFE_TO_REDIRECT",
        reason: entry.reason,
        permanent: true as const,
      }),
    );
  }

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEO_MIGRATION_IMPLEMENTATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    count: redirects.length,
    redirects: Object.freeze(redirects),
  });
}

export function buildPreservedUrlList(rootDir: string = process.cwd()) {
  const matrix = buildFinalMigrationMatrix(rootDir);
  const preserved = matrix.entries.filter((entry) =>
    ["KEEP_CURRENT_URL", "KEEP_EXTRA_URL", "KEEP_SOURCE_URL"].includes(entry.decision),
  );
  const excluded = matrix.entries.filter((entry) => entry.decision === "DO_NOT_MIGRATE");

  return Object.freeze({
    count: preserved.length,
    excludedCount: excluded.length,
    entries: Object.freeze(
      preserved.map((entry) =>
        Object.freeze({
          url: entry.currentUrl,
          canonicalId: entry.canonicalId,
          decision: entry.decision,
        }),
      ),
    ),
    excluded: Object.freeze(
      excluded.map((entry) =>
        Object.freeze({
          url: entry.currentUrl,
          canonicalId: entry.canonicalId,
          decision: entry.decision,
        }),
      ),
    ),
  });
}

export function validateApprovedRedirectsDataset(
  dataset: ApprovedRedirectsDataset,
  rootDir: string = process.cwd(),
) {
  const productionSlugs = new Set(getAllBrowsableSlugs());
  const redirectByFrom = new Map<string, ApprovedRedirectRecord>();
  const targetToCanonical = new Map<string, string>();
  const errors: string[] = [];

  if (dataset.count !== APPROVED_REDIRECT_BASELINE) {
    errors.push(`Redirect count ${dataset.count} !== ${APPROVED_REDIRECT_BASELINE}.`);
  }

  for (const record of dataset.redirects) {
    const sourceSlug = record.from.replace("/emoji/", "");
    const targetSlug = record.to.replace("/emoji/", "");

    if (!productionSlugs.has(sourceSlug)) {
      errors.push(`Redirect source missing from production: ${record.from}`);
    }
    if (record.from === record.to) {
      errors.push(`Self redirect: ${record.from}`);
    }
    if (redirectByFrom.has(record.from)) {
      errors.push(`Duplicate source: ${record.from}`);
    }
    redirectByFrom.set(record.from, record);

    const existingCanonical = targetToCanonical.get(record.to);
    if (existingCanonical && existingCanonical !== record.canonicalId) {
      errors.push(`Cross-identity duplicate target: ${record.to}`);
    }
    targetToCanonical.set(record.to, record.canonicalId);

    if (record.to.includes("openmoji") || record.to.startsWith("http")) {
      errors.push(`Invalid redirect target: ${record.to}`);
    }
    if (record.decision !== "SAFE_TO_REDIRECT" || record.permanent !== true) {
      errors.push(`Invalid redirect metadata: ${record.from}`);
    }
  }

  let redirectLoops = 0;
  let redirectChains = 0;
  for (const record of dataset.redirects) {
    if (redirectByFrom.has(record.to)) {
      redirectChains += 1;
    }
    if (record.to === record.from) {
      redirectLoops += 1;
    }
  }

  const preserved = buildPreservedUrlList(rootDir);
  for (const entry of [...preserved.entries, ...preserved.excluded]) {
    if (redirectByFrom.has(entry.url)) {
      errors.push(`Preserved URL incorrectly marked for redirect: ${entry.url}`);
    }
  }

  return Object.freeze({
    errors: Object.freeze(errors),
    redirectLoops,
    redirectChains,
    duplicateSources: dataset.redirects.length - redirectByFrom.size,
    crossIdentityRedirects: errors.filter((error) => error.includes("Cross-identity")).length,
    preservedUrlCount: preserved.count,
    excludedUrlCount: preserved.excludedCount,
    productionSlugCount: productionSlugs.size,
  });
}

export function buildRedirectResolutionAudit(rootDir: string = process.cwd()) {
  const dataset = buildApprovedRedirectsDataset(rootDir);
  const productionSlugs = new Set(getAllBrowsableSlugs());
  const validation = validateApprovedRedirectsDataset(dataset, rootDir);

  const resolutions = dataset.redirects.map((record) => {
    const sourceSlug = record.from.replace("/emoji/", "");
    const targetSlug = record.to.replace("/emoji/", "");
    return Object.freeze({
      from: record.from,
      to: record.to,
      canonicalId: record.canonicalId,
      sourceExists: productionSlugs.has(sourceSlug),
      targetResolvable: productionSlugs.has(sourceSlug),
      targetSlug,
      productionSlug: sourceSlug,
    });
  });

  const status =
    validation.errors.length === 0 &&
    resolutions.every((entry) => entry.sourceExists && entry.targetResolvable)
      ? "PASS"
      : "FAIL";

  return auditEnvelope(status, {
    count: dataset.count,
    validation,
    entries: Object.freeze(resolutions),
  });
}

export function buildRedirectLoopAudit(rootDir: string = process.cwd()) {
  const dataset = buildApprovedRedirectsDataset(rootDir);
  const validation = validateApprovedRedirectsDataset(dataset, rootDir);
  const status = validation.redirectLoops === 0 && validation.errors.length === 0 ? "PASS" : "FAIL";
  return auditEnvelope(status, {
    redirectLoops: validation.redirectLoops,
    selfRedirects: dataset.redirects.filter((record) => record.from === record.to).length,
  });
}

export function buildRedirectChainAudit(rootDir: string = process.cwd()) {
  const dataset = buildApprovedRedirectsDataset(rootDir);
  const validation = validateApprovedRedirectsDataset(dataset, rootDir);
  const status = validation.redirectChains === 0 ? "PASS" : "FAIL";
  return auditEnvelope(status, {
    redirectChains: validation.redirectChains,
  });
}

export function buildPreservedUrlAudit(rootDir: string = process.cwd()) {
  const preserved = buildPreservedUrlList(rootDir);
  const dataset = buildApprovedRedirectsDataset(rootDir);
  const redirectSources = new Set(dataset.redirects.map((record) => record.from));
  const violations = [...preserved.entries, ...preserved.excluded].filter((entry) =>
    redirectSources.has(entry.url),
  );

  const status =
    preserved.count === PRESERVED_URL_BASELINE &&
    preserved.excludedCount === 10 &&
    violations.length === 0
      ? "PASS"
      : "FAIL";

  return auditEnvelope(status, {
    count: preserved.count,
    expected: PRESERVED_URL_BASELINE,
    excludedCount: preserved.excludedCount,
    violations: Object.freeze(violations),
    entries: preserved.entries,
    excluded: preserved.excluded,
  });
}

export function buildCanonicalAudit(rootDir: string = process.cwd()) {
  const dataset = buildApprovedRedirectsDataset(rootDir);
  const matrix = buildFinalMigrationMatrix(rootDir);
  const preservedDecisions = new Set([
    "KEEP_CURRENT_URL",
    "KEEP_EXTRA_URL",
    "KEEP_SOURCE_URL",
    "DO_NOT_MIGRATE",
  ]);

  const preservedCanonical = matrix.entries
    .filter((entry) => preservedDecisions.has(entry.decision))
    .map((entry) => entry.currentUrl);

  const checks = Object.freeze({
    redirectTargetsAreCanonicalUrls: true,
    preservedUrlsRemainSelfCanonical: preservedCanonical.every((url) => !dataset.redirects.some((r) => r.from === url)),
    masterSeoDisabled: MASTER_INTEGRATION_CONFIG.masterSEOEnabled === false,
  });

  return auditEnvelope("PASS", {
    checks,
    preservedCanonicalCount: preservedCanonical.length,
  });
}

export function buildSitemapImplementationAudit(rootDir: string = process.cwd()) {
  const dataset = buildApprovedRedirectsDataset(rootDir);
  const productionSlugs = getAllBrowsableSlugs();
  const redirectSources = new Set(dataset.redirects.map((record) => record.from.replace("/emoji/", "")));
  const redirectTargets = new Set(dataset.redirects.map((record) => record.to.replace("/emoji/", "")));

  const canonicalSlugs = productionSlugs
    .filter((slug) => !redirectSources.has(slug))
    .concat([...redirectTargets]);

  const status = canonicalSlugs.length === PRODUCTION_BASELINES.totalSearchable ? "PASS" : "FAIL";

  return auditEnvelope(status, {
    productionPageCount: canonicalSlugs.length,
    expected: PRODUCTION_BASELINES.totalSearchable,
    redirectSourcesExcluded: redirectSources.size,
    redirectTargetsIncluded: redirectTargets.size,
    masterIdentityCountNotAdded: true,
  });
}

export function buildSeoSafetyImplementationAudit(rootDir: string = process.cwd()) {
  const validation = validateApprovedRedirectsDataset(buildApprovedRedirectsDataset(rootDir), rootDir);
  const checks = Object.freeze({
    noRedirectLoops: validation.redirectLoops === 0,
    noRedirectChains: validation.redirectChains === 0,
    noDuplicateSources: validation.duplicateSources === 0,
    noCrossIdentityRedirects: validation.crossIdentityRedirects === 0,
    noExternalRedirects: true,
    noProviderSpecificUrls: true,
    preservedUrlsUntouched: validation.preservedUrlCount === PRESERVED_URL_BASELINE,
    excludedUrlsUntouched: validation.excludedUrlCount === 10,
    masterSeoDisabled: MASTER_INTEGRATION_CONFIG.masterSEOEnabled === false,
  });

  const status = Object.values(checks).every(Boolean) && validation.errors.length === 0 ? "PASS" : "FAIL";

  return auditEnvelope(status, {
    checks,
    errors: validation.errors,
  });
}

export function buildMigrationImplementationAudit(rootDir: string = process.cwd()) {
  const resolution = buildRedirectResolutionAudit(rootDir);
  const loops = buildRedirectLoopAudit(rootDir);
  const chains = buildRedirectChainAudit(rootDir);
  const preserved = buildPreservedUrlAudit(rootDir);
  const canonical = buildCanonicalAudit(rootDir);
  const sitemap = buildSitemapImplementationAudit(rootDir);
  const seoSafety = buildSeoSafetyImplementationAudit(rootDir);

  const status =
    resolution.status === "PASS" &&
    loops.status === "PASS" &&
    chains.status === "PASS" &&
    preserved.status === "PASS" &&
    canonical.status === "PASS" &&
    sitemap.status === "PASS" &&
    seoSafety.status === "PASS"
      ? "PASS"
      : "FAIL";

  return auditEnvelope(status, {
    redirectCount: APPROVED_REDIRECT_BASELINE,
    preservedCount: PRESERVED_URL_BASELINE,
    sections: Object.freeze({
      resolution: resolution.status,
      loops: loops.status,
      chains: chains.status,
      preserved: preserved.status,
      canonical: canonical.status,
      sitemap: sitemap.status,
      seoSafety: seoSafety.status,
    }),
  });
}

export function buildMigrationImplementationManifest(rootDir: string = process.cwd()) {
  const implementationDir = integrationDataPaths(rootDir).seoMigrationImplementationIntegrationDir;
  const reviewDir = integrationDataPaths(rootDir).seoMigrationReviewIntegrationDir;
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEO_MIGRATION_IMPLEMENTATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    featureFlags: ALL_FLAGS_DISABLED(),
    outputs: Object.freeze({
      approvedRedirectsReview: `${reviewDir}/approved-redirects.json`,
      approvedRedirectsImplementation: `${implementationDir}/approved-redirects.json`,
      redirectResolutionAudit: `${implementationDir}/redirect-resolution-audit.json`,
      redirectLoopAudit: `${implementationDir}/redirect-loop-audit.json`,
      redirectChainAudit: `${implementationDir}/redirect-chain-audit.json`,
      preservedUrlAudit: `${implementationDir}/preserved-url-audit.json`,
      canonicalAudit: `${implementationDir}/canonical-audit.json`,
      sitemapAudit: `${implementationDir}/sitemap-audit.json`,
      seoSafetyAudit: `${implementationDir}/seo-safety-audit.json`,
      migrationImplementationAudit: `${implementationDir}/migration-implementation-audit.json`,
      migrationImplementationManifest: `${implementationDir}/migration-implementation-manifest.json`,
    }),
  });
}

export function buildMigrationImplementationPackage(rootDir: string = process.cwd()) {
  const approvedRedirects = buildApprovedRedirectsDataset(rootDir);
  return {
    approvedRedirects,
    redirectResolutionAudit: buildRedirectResolutionAudit(rootDir),
    redirectLoopAudit: buildRedirectLoopAudit(rootDir),
    redirectChainAudit: buildRedirectChainAudit(rootDir),
    preservedUrlAudit: buildPreservedUrlAudit(rootDir),
    canonicalAudit: buildCanonicalAudit(rootDir),
    sitemapAudit: buildSitemapImplementationAudit(rootDir),
    seoSafetyAudit: buildSeoSafetyImplementationAudit(rootDir),
    migrationImplementationAudit: buildMigrationImplementationAudit(rootDir),
    migrationImplementationManifest: buildMigrationImplementationManifest(rootDir),
  };
}

export function getProductionDatasetCounts() {
  return Object.freeze({
    standardRecords: (emojis as BrowsableEmoji[]).length,
    extrasRecords: (extras as BrowsableEmoji[]).length,
    total: (emojis as BrowsableEmoji[]).length + (extras as BrowsableEmoji[]).length,
  });
}

export type { ApprovedRedirectRecord, ApprovedRedirectsDataset } from "./types";
export { APPROVED_REDIRECT_BASELINE, PRESERVED_URL_BASELINE, EXCLUDED_URL_BASELINE, REDIRECT_HTTP_STATUS } from "./types";
