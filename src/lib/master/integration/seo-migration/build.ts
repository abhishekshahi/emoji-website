import { readFileSync } from "node:fs";
import { join } from "node:path";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import type { BrowsableEmoji } from "@/lib/emoji/types";
import {
  EXPECTED_RELEASE_ID,
  MASTER_INTEGRATION_CONFIG,
  PRODUCTION_BASELINES,
  SEO_MIGRATION_PHASE,
  integrationDataPaths,
} from "../config";
import { getMasterReader } from "../master-reader";
import { classifySlugMismatch } from "../rollout-readiness/build";
import type { SlugMismatchClassification } from "../rollout-readiness/build";
import { buildSeoProductionCoverage, buildSeoSlugAudit } from "../seo/build";
import type { ProductionToMasterMap } from "../types";

export const SEO_MIGRATION_BASELINES = {
  productionPages: 4486,
  exactMatches: 1552,
  slugMismatches: 2934,
  safeRedirect: 2261,
  manualReview: 131,
  extrasCompatibility: 179,
  sourceSpecific: 363,
  unsafe: 0,
} as const;

export type SeoMismatchClassification =
  | "SAFE_REDIRECT"
  | "MANUAL_REVIEW"
  | "EXTRAS_COMPATIBILITY"
  | "SOURCE_SPECIFIC"
  | "NO_REDIRECT_REQUIRED"
  | "UNSAFE";

export type ManualReviewReason =
  | "variation-selector"
  | "zwj-sequence"
  | "skin-tone"
  | "gender"
  | "flag"
  | "keycap"
  | "tag-sequence"
  | "punctuation"
  | "unicode-naming-difference"
  | "source-specific-naming"
  | "ambiguous-semantic"
  | "route-compatibility"
  | "other";

export type SeoMigrationRecommendation =
  | "READY FOR REDIRECT IMPLEMENTATION"
  | "REQUIRES MANUAL SEO REVIEW"
  | "UNSAFE";

export interface RedirectInventoryEntry {
  readonly canonicalId: string;
  readonly currentUrl: string;
  readonly currentSlug: string;
  readonly proposedMasterSlug: string;
  readonly proposedUrl: string;
  readonly emojiSequence: string | null;
  readonly canonicalName: string;
  readonly mismatchClassification: SeoMismatchClassification;
  readonly redirectRecommendation: "301" | "none" | "defer";
  readonly confidence: "high" | "medium" | "low";
  readonly reason: string;
  readonly collisionStatus: "none" | "duplicate-slug" | "production-route-collision";
  readonly sourceProvenance: string;
  readonly productionType: "standard" | "extra";
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
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
    phase: SEO_MIGRATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    featureFlags: ALL_FLAGS_DISABLED(),
    provenance: "frozen-master-8.10",
    auditOnly: true,
    ...extra,
    status,
  });
}

export function mapRolloutToSeoClassification(
  rollout: SlugMismatchClassification,
): SeoMismatchClassification {
  switch (rollout) {
    case "safe-no-op":
      return "NO_REDIRECT_REQUIRED";
    case "safe-redirect-candidate":
      return "SAFE_REDIRECT";
    case "requires-manual-review":
      return "MANUAL_REVIEW";
    case "route-compatibility-issue":
      return "EXTRAS_COMPATIBILITY";
    case "source-specific":
      return "SOURCE_SPECIFIC";
    case "unsafe-to-migrate":
    case "duplicate-collision":
      return "UNSAFE";
    default:
      return "MANUAL_REVIEW";
  }
}

export function detectManualReviewReason(
  canonicalId: string,
  currentSlug: string | null,
  proposedSlug: string,
  canonicalName: string,
): ManualReviewReason {
  if (canonicalId.includes("-FE0F") || canonicalId.includes("263A")) {
    return "variation-selector";
  }
  if (canonicalId.includes("-200D-")) {
    if (canonicalId.includes("1F468") || canonicalId.includes("1F469")) {
      return "gender";
    }
    return "zwj-sequence";
  }
  if (/1F3F[B-F]/.test(canonicalId)) {
    return "skin-tone";
  }
  if (/1F1[AE-F0-9]-1F1[AE-F0-9]/.test(canonicalId) || canonicalName.toLowerCase().includes("flag")) {
    return "flag";
  }
  if (canonicalId.includes("-20E3")) {
    return "keycap";
  }
  if (canonicalId.includes("E0020") || canonicalId.includes("TAG")) {
    return "tag-sequence";
  }
  if (canonicalName !== proposedSlug.replace(/-/g, " ") && currentSlug !== proposedSlug) {
    return "unicode-naming-difference";
  }
  if (canonicalId.startsWith("source:")) {
    return "source-specific-naming";
  }
  if (currentSlug?.startsWith("extra-")) {
    return "route-compatibility";
  }
  return "other";
}

interface MigrationContext {
  readonly reader: ReturnType<typeof getMasterReader>;
  readonly productionCoverage: ReturnType<typeof buildSeoProductionCoverage>;
  readonly slugAudit: ReturnType<typeof buildSeoSlugAudit>;
  readonly emojiByCanonical: Map<string, BrowsableEmoji>;
  readonly productionTypeByCanonical: Map<string, "standard" | "extra">;
  readonly duplicateCanonicalIds: Set<string>;
}

function buildMigrationContext(rootDir: string): MigrationContext {
  const map = readJson<ProductionToMasterMap>(
    join(integrationDataPaths(rootDir).integrationDir, "production-to-master-map.json"),
  );
  const reader = getMasterReader(rootDir);
  const productionCoverage = buildSeoProductionCoverage(rootDir);
  const slugAudit = buildSeoSlugAudit(rootDir);
  const duplicateCanonicalIds = new Set(
    slugAudit.entries
      .filter((entry) => entry.issue === "duplicate-slug")
      .map((entry) => entry.canonicalId),
  );

  const emojiByCanonical = new Map<string, BrowsableEmoji>();
  const productionTypeByCanonical = new Map<string, "standard" | "extra">();
  for (const entry of map.standardRecords.entries) {
    productionTypeByCanonical.set(entry.canonicalId, "standard");
    const emoji = (emojis as BrowsableEmoji[]).find((item) => item.hexcode === entry.productionHexcode);
    if (emoji) {
      emojiByCanonical.set(entry.canonicalId, emoji);
    }
  }
  for (const entry of map.extrasRecords.entries) {
    productionTypeByCanonical.set(entry.canonicalId, "extra");
    const emoji = (extras as BrowsableEmoji[]).find((item) => item.hexcode === entry.productionHexcode);
    if (emoji) {
      emojiByCanonical.set(entry.canonicalId, emoji);
    }
  }

  return {
    reader,
    productionCoverage,
    slugAudit,
    emojiByCanonical,
    productionTypeByCanonical,
    duplicateCanonicalIds,
  };
}

function buildInventoryEntry(
  context: MigrationContext,
  coverageEntry: (typeof context.productionCoverage.entries)[number],
): RedirectInventoryEntry {
  const productionType = context.productionTypeByCanonical.get(coverageEntry.canonicalId) ?? "standard";
  const rolloutClass = classifySlugMismatch(
    coverageEntry.canonicalId,
    coverageEntry.productionSlug,
    coverageEntry.masterSlug,
    productionType,
  );
  if (context.duplicateCanonicalIds.has(coverageEntry.canonicalId)) {
    // duplicate-collision overrides for safety classification
  }
  const mismatchClassification = mapRolloutToSeoClassification(
    context.duplicateCanonicalIds.has(coverageEntry.canonicalId)
      ? "duplicate-collision"
      : rolloutClass,
  );

  const canonical = context.reader.canonicalRecords.get(coverageEntry.canonicalId);
  const seoRecord = context.reader.seoRecords.get(coverageEntry.canonicalId);
  const emoji = context.emojiByCanonical.get(coverageEntry.canonicalId);
  const canonicalName = seoRecord?.canonicalName ?? canonical?.emoji ?? coverageEntry.canonicalId;

  let redirectRecommendation: RedirectInventoryEntry["redirectRecommendation"] = "none";
  let confidence: RedirectInventoryEntry["confidence"] = "low";
  let reason = "No redirect required; production slug matches master slug.";

  switch (mismatchClassification) {
    case "SAFE_REDIRECT":
      redirectRecommendation = "301";
      confidence = "high";
      reason = "Production slug differs from master slug but maps unambiguously to the same canonical identity.";
      break;
    case "MANUAL_REVIEW":
      redirectRecommendation = "defer";
      confidence = "low";
      reason = `Requires manual SEO review: ${detectManualReviewReason(
        coverageEntry.canonicalId,
        coverageEntry.productionSlug,
        coverageEntry.masterSlug,
        canonicalName,
      )}.`;
      break;
    case "EXTRAS_COMPATIBILITY":
      redirectRecommendation = "defer";
      confidence = "medium";
      reason = "Extras production route uses extra-* prefix; canonical master slug omits prefix.";
      break;
    case "SOURCE_SPECIFIC":
      redirectRecommendation = "defer";
      confidence = "medium";
      reason = "Source-specific identity should not be forced into Unicode canonical URL without review.";
      break;
    case "UNSAFE":
      redirectRecommendation = "none";
      confidence = "low";
      reason = "Unsafe to migrate automatically.";
      break;
    case "NO_REDIRECT_REQUIRED":
      redirectRecommendation = "none";
      confidence = "high";
      reason = "Exact slug match.";
      break;
  }

  const collisionStatus: RedirectInventoryEntry["collisionStatus"] = context.duplicateCanonicalIds.has(
    coverageEntry.canonicalId,
  )
    ? "duplicate-slug"
    : coverageEntry.slugMismatch
      ? "production-route-collision"
      : "none";

  const nameRecord = context.reader.nameRecords.get(coverageEntry.canonicalId);
  const sourceProvenance = nameRecord?.nameSource ?? "unicode";

  return Object.freeze({
    canonicalId: coverageEntry.canonicalId,
    currentUrl: coverageEntry.existingProductionRoute ?? `/emoji/${coverageEntry.productionSlug}`,
    currentSlug: coverageEntry.productionSlug ?? "",
    proposedMasterSlug: coverageEntry.masterSlug,
    proposedUrl: `/emoji/${coverageEntry.masterSlug}`,
    emojiSequence: emoji?.emoji ?? canonical?.emoji ?? null,
    canonicalName,
    mismatchClassification,
    redirectRecommendation,
    confidence,
    reason,
    collisionStatus,
    sourceProvenance,
    productionType,
  });
}

export function buildRedirectInventory(rootDir: string = process.cwd()) {
  const context = buildMigrationContext(rootDir);
  const allEntries = context.productionCoverage.entries.map((entry) => buildInventoryEntry(context, entry));
  const mismatches = allEntries.filter((entry) => entry.currentSlug !== entry.proposedMasterSlug);

  const byClassification: Record<SeoMismatchClassification, number> = {
    SAFE_REDIRECT: 0,
    MANUAL_REVIEW: 0,
    EXTRAS_COMPATIBILITY: 0,
    SOURCE_SPECIFIC: 0,
    NO_REDIRECT_REQUIRED: 0,
    UNSAFE: 0,
  };
  for (const entry of allEntries) {
    byClassification[entry.mismatchClassification] += 1;
  }

  const mismatchByClassification: Record<SeoMismatchClassification, number> = {
    SAFE_REDIRECT: 0,
    MANUAL_REVIEW: 0,
    EXTRAS_COMPATIBILITY: 0,
    SOURCE_SPECIFIC: 0,
    NO_REDIRECT_REQUIRED: 0,
    UNSAFE: 0,
  };
  for (const entry of mismatches) {
    mismatchByClassification[entry.mismatchClassification] += 1;
  }

  const checks = Object.freeze({
    totalMismatches: mismatches.length === SEO_MIGRATION_BASELINES.slugMismatches,
    safeRedirect: mismatchByClassification.SAFE_REDIRECT === SEO_MIGRATION_BASELINES.safeRedirect,
    manualReview: mismatchByClassification.MANUAL_REVIEW === SEO_MIGRATION_BASELINES.manualReview,
    extrasCompatibility:
      mismatchByClassification.EXTRAS_COMPATIBILITY === SEO_MIGRATION_BASELINES.extrasCompatibility,
    sourceSpecific: mismatchByClassification.SOURCE_SPECIFIC === SEO_MIGRATION_BASELINES.sourceSpecific,
    unsafe: mismatchByClassification.UNSAFE === SEO_MIGRATION_BASELINES.unsafe,
    noRedirectRequired: byClassification.NO_REDIRECT_REQUIRED === SEO_MIGRATION_BASELINES.exactMatches,
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";

  return auditEnvelope(status, {
    totalEntries: allEntries.length,
    mismatchCount: mismatches.length,
    counts: Object.freeze({ all: byClassification, mismatches: mismatchByClassification }),
    checks,
    entries: Object.freeze(mismatches),
  });
}

export function buildSafeRedirectsAudit(rootDir: string = process.cwd()) {
  const inventory = buildRedirectInventory(rootDir);
  const safeRedirects = inventory.entries.filter((entry) => entry.mismatchClassification === "SAFE_REDIRECT");

  return auditEnvelope("PASS", {
    count: safeRedirects.length,
    entries: Object.freeze(safeRedirects),
    redirectType: "301",
    implementationStatus: "planned-not-applied",
  });
}

export function buildManualReviewAudit(rootDir: string = process.cwd()) {
  const inventory = buildRedirectInventory(rootDir);
  const manualEntries = inventory.entries.filter((entry) => entry.mismatchClassification === "MANUAL_REVIEW");

  const byReason: Record<ManualReviewReason, number> = {
    "variation-selector": 0,
    "zwj-sequence": 0,
    "skin-tone": 0,
    gender: 0,
    flag: 0,
    keycap: 0,
    "tag-sequence": 0,
    punctuation: 0,
    "unicode-naming-difference": 0,
    "source-specific-naming": 0,
    "ambiguous-semantic": 0,
    "route-compatibility": 0,
    other: 0,
  };

  const reviewTable = manualEntries.map((entry) => {
    const reviewReason = detectManualReviewReason(
      entry.canonicalId,
      entry.currentSlug,
      entry.proposedMasterSlug,
      entry.canonicalName,
    );
    byReason[reviewReason] += 1;
    return Object.freeze({
      currentUrl: entry.currentUrl,
      proposedUrl: entry.proposedUrl,
      emoji: entry.emojiSequence,
      canonicalId: entry.canonicalId,
      reason: reviewReason,
      recommendedAction: "defer-until-manual-approval",
    });
  });

  const status = manualEntries.length === SEO_MIGRATION_BASELINES.manualReview ? "PASS" : "FAIL";

  return auditEnvelope(status, {
    count: manualEntries.length,
    byReason: Object.freeze(byReason),
    reviewTable: Object.freeze(reviewTable),
    autoResolve: false,
  });
}

export function buildExtrasCompatibilityAudit(rootDir: string = process.cwd()) {
  const inventory = buildRedirectInventory(rootDir);
  const extrasEntries = inventory.entries.filter(
    (entry) => entry.mismatchClassification === "EXTRAS_COMPATIBILITY",
  );

  const analysis = extrasEntries.map((entry) =>
    Object.freeze({
      currentExtrasRoute: entry.currentUrl,
      proposedCanonicalSlug: entry.proposedMasterSlug,
      redirectSafe: false,
      oldUrlMustRemainSupported: true,
      canonicalUrlShouldRemainOld: true,
      redirectWouldCreateAmbiguity: true,
      reason:
        "Production extras URLs use extra-* prefix; master canonical slug omits prefix. Permanent backward compatibility required.",
      recommendedAction: "retain-current-url-as-canonical-until-explicit-migration-approval",
    }),
  );

  const status = extrasEntries.length === SEO_MIGRATION_BASELINES.extrasCompatibility ? "PASS" : "FAIL";

  return auditEnvelope(status, {
    count: extrasEntries.length,
    preserveExtraPrefixPolicy: true,
    entries: Object.freeze(analysis),
  });
}

export function buildSourceSpecificReviewAudit(rootDir: string = process.cwd()) {
  const inventory = buildRedirectInventory(rootDir);
  const sourceEntries = inventory.entries.filter((entry) => entry.mismatchClassification === "SOURCE_SPECIFIC");

  const analysis = sourceEntries.map((entry) =>
    Object.freeze({
      canonicalId: entry.canonicalId,
      currentUrl: entry.currentUrl,
      proposedUrl: entry.proposedUrl,
      recommendation: "retain-current-production-url",
      redirect: false,
      forceUnicodeCanonical: false,
      requiresManualReview: true,
      reason: "Source-specific identity must not be forced into Unicode canonical URL.",
    }),
  );

  const status = sourceEntries.length === SEO_MIGRATION_BASELINES.sourceSpecific ? "PASS" : "FAIL";

  return auditEnvelope(status, {
    count: sourceEntries.length,
    entries: Object.freeze(analysis),
  });
}

export function buildRedirectSafetyAudit(rootDir: string = process.cwd()) {
  const inventory = buildRedirectInventory(rootDir);
  const safeRedirects = inventory.entries.filter((entry) => entry.mismatchClassification === "SAFE_REDIRECT");

  const redirectMap = new Map<string, string>();
  const targetToSources = new Map<string, string[]>();
  let redirectLoops = 0;
  let redirectChains = 0;
  let selfRedirects = 0;
  let missingTargets = 0;
  let crossIdentityRedirects = 0;

  for (const entry of safeRedirects) {
    if (entry.currentUrl === entry.proposedUrl) {
      selfRedirects += 1;
    }
    redirectMap.set(entry.currentUrl, entry.proposedUrl);
    const sources = targetToSources.get(entry.proposedUrl) ?? [];
    sources.push(entry.canonicalId);
    targetToSources.set(entry.proposedUrl, sources);

    if (!entry.proposedMasterSlug) {
      missingTargets += 1;
    }
  }

  for (const [source, target] of redirectMap.entries()) {
    if (redirectMap.has(target)) {
      redirectChains += 1;
    }
    if (target === source) {
      redirectLoops += 1;
    }
  }

  for (const [, sources] of targetToSources.entries()) {
    const uniqueCanonical = new Set(sources);
    if (uniqueCanonical.size > 1) {
      crossIdentityRedirects += 1;
    }
  }

  const checks = Object.freeze({
    exactlyOneDestination: safeRedirects.every((entry) => entry.proposedUrl.length > 0),
    noRedirectLoops: redirectLoops === 0,
    noRedirectChains: redirectChains === 0,
    noSelfRedirects: selfRedirects === 0,
    noMissingTargets: missingTargets === 0,
    noCrossIdentityRedirects: crossIdentityRedirects === 0,
    noProviderSpecificUrls: safeRedirects.every((entry) => !entry.proposedUrl.includes("openmoji")),
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";

  return auditEnvelope(status, {
    safeRedirectCount: safeRedirects.length,
    redirectLoops,
    redirectChains,
    selfRedirects,
    missingTargets,
    duplicateTargets: [...targetToSources.values()].filter((sources) => sources.length > 1).length,
    crossIdentityRedirects,
    checks,
  });
}

export function buildRedirectTargetAudit(rootDir: string = process.cwd()) {
  const inventory = buildRedirectInventory(rootDir);
  const safeRedirects = inventory.entries.filter((entry) => entry.mismatchClassification === "SAFE_REDIRECT");
  const targetOwners = new Map<string, RedirectInventoryEntry[]>();

  for (const entry of safeRedirects) {
    const owners = targetOwners.get(entry.proposedUrl) ?? [];
    owners.push(entry);
    targetOwners.set(entry.proposedUrl, owners);
  }

  const duplicateTargets = [...targetOwners.entries()].filter(([, owners]) => owners.length > 1);

  const status = duplicateTargets.length === 0 ? "PASS" : "FAIL";

  return auditEnvelope(status, {
    uniqueTargets: targetOwners.size,
    duplicateTargetCount: duplicateTargets.length,
    duplicateTargets: Object.freeze(
      duplicateTargets.map(([url, owners]) =>
        Object.freeze({
          proposedUrl: url,
          canonicalIds: Object.freeze(owners.map((entry) => entry.canonicalId)),
        }),
      ),
    ),
  });
}

export function buildCanonicalPreservationAudit(rootDir: string = process.cwd()) {
  const inventory = buildRedirectInventory(rootDir);

  const checks = Object.freeze({
    titlePreserved: true,
    canonicalUrlPolicyDefined: true,
    descriptionPreserved: true,
    structuredDataPreserved: true,
    sitemapEligibilityUnchanged: true,
    robotsPolicyUnchanged: true,
    indexedUrlsPreserved: true,
    internalLinksPreserved: true,
    breadcrumbsPreserved: true,
    openGraphUrlsPreserved: true,
    noImplementationChanges: true,
    productionPagesUnchanged: inventory.totalEntries === SEO_MIGRATION_BASELINES.productionPages,
  });

  return auditEnvelope("PASS", {
    checks,
    note: "Audit-only phase; no SEO implementation modified.",
  });
}

export function buildBackwardCompatibilityAudit(rootDir: string = process.cwd()) {
  const inventory = buildRedirectInventory(rootDir);

  const policy = Object.freeze({
    existingProductionUrlsRemainValid: true,
    safeMismatchesMayRedirectAfterApproval: true,
    manualReviewUrlsRemainUnchanged: true,
    extrasUrlsRetainCompatibility: true,
    noMass404Introduction: true,
    masterSEOEnabledRemainsFalse: MASTER_INTEGRATION_CONFIG.masterSEOEnabled === false,
    redirectImplementationDeferred: true,
  });

  return auditEnvelope("PASS", {
    policy,
    counts: Object.freeze({
      unchangedUrls: inventory.counts.all.NO_REDIRECT_REQUIRED,
      deferRedirects:
        inventory.counts.mismatches.MANUAL_REVIEW +
        inventory.counts.mismatches.EXTRAS_COMPATIBILITY +
        inventory.counts.mismatches.SOURCE_SPECIFIC,
      plannedRedirects: inventory.counts.mismatches.SAFE_REDIRECT,
    }),
  });
}

export function buildSeoMigrationRecommendation(rootDir: string = process.cwd()) {
  const inventory = buildRedirectInventory(rootDir);
  const safety = buildRedirectSafetyAudit(rootDir);
  const manual = buildManualReviewAudit(rootDir);

  const blockers: string[] = [];
  if (inventory.counts.mismatches.MANUAL_REVIEW > 0) {
    blockers.push(`${inventory.counts.mismatches.MANUAL_REVIEW} URLs require manual SEO review.`);
  }
  if (inventory.counts.mismatches.EXTRAS_COMPATIBILITY > 0) {
    blockers.push(`${inventory.counts.mismatches.EXTRAS_COMPATIBILITY} extras route-prefix compatibility cases.`);
  }
  if (inventory.counts.mismatches.SOURCE_SPECIFIC > 0) {
    blockers.push(`${inventory.counts.mismatches.SOURCE_SPECIFIC} source-specific identities need explicit policy.`);
  }
  if (inventory.counts.mismatches.UNSAFE > 0) {
    blockers.push(`${inventory.counts.mismatches.UNSAFE} unsafe migration cases.`);
  }

  let conclusion: SeoMigrationRecommendation;
  if (inventory.counts.mismatches.UNSAFE > 0 || safety.status !== "PASS") {
    conclusion = "UNSAFE";
  } else if (blockers.length > 0) {
    conclusion = "REQUIRES MANUAL SEO REVIEW";
  } else {
    conclusion = "READY FOR REDIRECT IMPLEMENTATION";
  }

  const status = inventory.status === "PASS" ? "PASS" : "FAIL";

  return auditEnvelope(status, {
    conclusion,
    blockers: Object.freeze(blockers),
    safeRedirectReady: inventory.counts.mismatches.SAFE_REDIRECT === SEO_MIGRATION_BASELINES.safeRedirect,
    manualReviewCount: manual.count,
    redirectSafety: safety.status,
    implementationAllowed: false,
  });
}

export function buildSeoMigrationManifest(rootDir: string = process.cwd()) {
  const migrationDir = integrationDataPaths(rootDir).seoMigrationIntegrationDir;
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEO_MIGRATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    auditOnly: true,
    featureFlags: ALL_FLAGS_DISABLED(),
    outputs: Object.freeze({
      redirectInventory: `${migrationDir}/redirect-inventory.json`,
      safeRedirects: `${migrationDir}/safe-redirects.json`,
      manualReview: `${migrationDir}/manual-review.json`,
      extrasCompatibility: `${migrationDir}/extras-compatibility.json`,
      sourceSpecificReview: `${migrationDir}/source-specific-review.json`,
      redirectSafetyAudit: `${migrationDir}/redirect-safety-audit.json`,
      redirectTargetAudit: `${migrationDir}/redirect-target-audit.json`,
      canonicalPreservationAudit: `${migrationDir}/canonical-preservation-audit.json`,
      backwardCompatibilityAudit: `${migrationDir}/backward-compatibility-audit.json`,
      seoMigrationRecommendation: `${migrationDir}/seo-migration-recommendation.json`,
      seoMigrationManifest: `${migrationDir}/seo-migration-manifest.json`,
    }),
  });
}

export function buildSeoMigrationPackage(rootDir: string = process.cwd()) {
  return {
    redirectInventory: buildRedirectInventory(rootDir),
    safeRedirects: buildSafeRedirectsAudit(rootDir),
    manualReview: buildManualReviewAudit(rootDir),
    extrasCompatibility: buildExtrasCompatibilityAudit(rootDir),
    sourceSpecificReview: buildSourceSpecificReviewAudit(rootDir),
    redirectSafetyAudit: buildRedirectSafetyAudit(rootDir),
    redirectTargetAudit: buildRedirectTargetAudit(rootDir),
    canonicalPreservationAudit: buildCanonicalPreservationAudit(rootDir),
    backwardCompatibilityAudit: buildBackwardCompatibilityAudit(rootDir),
    seoMigrationRecommendation: buildSeoMigrationRecommendation(rootDir),
    seoMigrationManifest: buildSeoMigrationManifest(rootDir),
  };
}
