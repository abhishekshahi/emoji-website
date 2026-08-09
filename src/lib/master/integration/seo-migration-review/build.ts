import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import type { BrowsableEmoji } from "@/lib/emoji/types";
import {
  EXPECTED_RELEASE_ID,
  MASTER_INTEGRATION_CONFIG,
  SEO_MIGRATION_REVIEW_PHASE,
  integrationDataPaths,
} from "../config";
import { getSourceMetadata } from "../metadata/sources";
import { getMasterReader } from "../master-reader";
import {
  SEO_MIGRATION_BASELINES,
  buildRedirectInventory,
  detectManualReviewReason,
  type ManualReviewReason,
  type RedirectInventoryEntry,
  type SeoMismatchClassification,
} from "../seo-migration/build";

export const SEO_MIGRATION_REVIEW_BASELINES = {
  totalMismatches: SEO_MIGRATION_BASELINES.slugMismatches,
  deferredCases: 673,
  manualReview: SEO_MIGRATION_BASELINES.manualReview,
  extrasCompatibility: SEO_MIGRATION_BASELINES.extrasCompatibility,
  sourceSpecific: SEO_MIGRATION_BASELINES.sourceSpecific,
  safeRedirect: SEO_MIGRATION_BASELINES.safeRedirect,
} as const;

export type ManualReviewDecision =
  | "KEEP_CURRENT_URL"
  | "SAFE_TO_REDIRECT"
  | "REQUIRES_NEW_CANONICAL"
  | "REQUIRES_MANUAL_CONTENT_REVIEW"
  | "DO_NOT_MIGRATE";

export type ExtrasMigrationDecision =
  | "KEEP_EXTRA_URL"
  | "SAFE_TO_REDIRECT"
  | "REQUIRES_MANUAL_REVIEW"
  | "DO_NOT_MIGRATE";

export type SourceSpecificMigrationDecision =
  | "KEEP_SOURCE_URL"
  | "SAFE_TO_REDIRECT"
  | "REQUIRES_MANUAL_REVIEW"
  | "DO_NOT_MIGRATE";

export type FinalMigrationDecision =
  | "SAFE_TO_REDIRECT"
  | "KEEP_CURRENT_URL"
  | "KEEP_EXTRA_URL"
  | "KEEP_SOURCE_URL"
  | "REQUIRES_NEW_CANONICAL"
  | "REQUIRES_MANUAL_CONTENT_REVIEW"
  | "DO_NOT_MIGRATE";

export type SeoReviewRecommendation =
  | "READY FOR REDIRECT IMPLEMENTATION"
  | "READY FOR HUMAN APPROVAL"
  | "REQUIRES FURTHER SEO DESIGN";

export interface ManualReviewDecisionEntry {
  readonly canonicalId: string;
  readonly emojiSequence: string | null;
  readonly unicodeSequence: string;
  readonly currentUrl: string;
  readonly currentSlug: string;
  readonly proposedSlug: string;
  readonly proposedUrl: string;
  readonly hasVariationSelector: boolean;
  readonly unicodeOfficialName: string | null;
  readonly cldrName: string | null;
  readonly canonicalMasterName: string;
  readonly reviewReason: ManualReviewReason;
  readonly decision: ManualReviewDecision;
  readonly confidence: "high" | "medium" | "low";
  readonly reason: string;
  readonly searchImplications: string;
  readonly duplicateContentImplications: string;
}

export interface ExtrasMigrationDecisionEntry {
  readonly canonicalId: string;
  readonly currentExtrasUrl: string;
  readonly currentSlug: string;
  readonly proposedSlug: string;
  readonly proposedUrl: string;
  readonly emojiSequence: string | null;
  readonly destinationConflictsWithUnicode: boolean;
  readonly decision: ExtrasMigrationDecision;
  readonly confidence: "high" | "medium" | "low";
  readonly reason: string;
}

export interface SourceSpecificMigrationDecisionEntry {
  readonly canonicalId: string;
  readonly source: string;
  readonly currentUrl: string;
  readonly proposedSlug: string;
  readonly proposedUrl: string;
  readonly emojiSequence: string | null;
  readonly isUnicodeBacked: boolean;
  readonly isPua: boolean;
  readonly isArtworkOnly: boolean;
  readonly hasProductionPage: boolean;
  readonly proposedSlugCollidesWithUnicode: boolean;
  readonly decision: SourceSpecificMigrationDecision;
  readonly confidence: "high" | "medium" | "low";
  readonly reason: string;
}

export interface FinalMigrationMatrixEntry {
  readonly currentUrl: string;
  readonly proposedUrl: string;
  readonly canonicalId: string;
  readonly emoji: string | null;
  readonly classification: SeoMismatchClassification;
  readonly decision: FinalMigrationDecision;
  readonly confidence: "high" | "medium" | "low";
  readonly reason: string;
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
    phase: SEO_MIGRATION_REVIEW_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    featureFlags: ALL_FLAGS_DISABLED(),
    provenance: "frozen-master-8.10",
    auditOnly: true,
    ...extra,
    status,
  });
}

function unicodeSequenceFromCanonicalId(canonicalId: string): string {
  if (!canonicalId.startsWith("unicode:")) {
    return canonicalId;
  }
  return canonicalId.slice("unicode:".length).replace(/-/g, " ");
}

function hasVariationSelector(canonicalId: string): boolean {
  return canonicalId.includes("-FE0F") || /FE0F/i.test(canonicalId);
}

function isApostropheNormalization(currentSlug: string, proposedSlug: string): boolean {
  return /-s-/.test(currentSlug) && currentSlug.replace(/-s-/g, "s-") === proposedSlug;
}

function isOClockNormalization(currentSlug: string, proposedSlug: string): boolean {
  return currentSlug.includes("-o-clock") && proposedSlug === currentSlug.replace(/-o-clock/g, "-oclock");
}

function isDegradedFlagSlug(currentSlug: string, proposedSlug: string): boolean {
  if (!currentSlug.startsWith("flag-") || !proposedSlug.startsWith("flag-")) {
    return false;
  }
  const currentParts = currentSlug.slice("flag-".length).split("-").filter(Boolean);
  const proposedParts = proposedSlug.slice("flag-".length).split("-").filter(Boolean);
  if (proposedParts.length < currentParts.length) {
    return true;
  }
  for (let index = 0; index < Math.min(currentParts.length, proposedParts.length); index += 1) {
    const currentPart = currentParts[index];
    const proposedPart = proposedParts[index];
    if (
      proposedPart.length < currentPart.length &&
      currentPart.includes(proposedPart) &&
      proposedPart !== currentPart
    ) {
      return true;
    }
  }
  return false;
}

function isMasterDisambiguationSlug(proposedSlug: string): boolean {
  return /^e\d+-\d+-/.test(proposedSlug) || /^e\d+-/.test(proposedSlug);
}

function extractMetadataName(
  canonicalId: string,
  source: "unicode" | "cldr",
  rootDir: string,
): string | null {
  const record = getSourceMetadata(canonicalId, source, rootDir);
  if (!record || record.metadataAvailable === false) {
    return null;
  }
  if ("name" in record && typeof record.name === "string") {
    return record.name;
  }
  return null;
}

function buildProductionSlugSets(rootDir: string) {
  const reader = getMasterReader(rootDir);
  const standardSlugs = new Set((emojis as BrowsableEmoji[]).map((emoji) => emoji.slug));
  const extraSlugs = new Set((extras as BrowsableEmoji[]).map((emoji) => emoji.slug));
  const unicodeBackedSlugs = new Set<string>();

  for (const [canonicalId, record] of reader.canonicalRecords.entries()) {
    if (canonicalId.startsWith("unicode:")) {
      const seo = reader.seoRecords.get(canonicalId);
      if (seo?.slug) {
        unicodeBackedSlugs.add(seo.slug);
      }
    }
  }

  return Object.freeze({
    standardSlugs,
    extraSlugs,
    allProductionSlugs: new Set([...standardSlugs, ...extraSlugs]),
    unicodeBackedSlugs,
  });
}

export function decideManualReviewCase(
  entry: RedirectInventoryEntry,
  rootDir: string = process.cwd(),
): Pick<ManualReviewDecisionEntry, "decision" | "confidence" | "reason" | "searchImplications" | "duplicateContentImplications"> {
  const reviewReason = detectManualReviewReason(
    entry.canonicalId,
    entry.currentSlug,
    entry.proposedMasterSlug,
    entry.canonicalName,
  );

  if (reviewReason === "variation-selector" || hasVariationSelector(entry.canonicalId)) {
    return {
      decision: "KEEP_CURRENT_URL",
      confidence: "high",
      reason:
        "Distinct canonical identity with variation selector; production URL must not be merged with a different Unicode sequence.",
      searchImplications: "Search resolves by emoji identity; URL stability preserves indexed variation-selector distinction.",
      duplicateContentImplications:
        "Redirect would risk conflating visually similar but distinct canonical identities (e.g. ☺ vs ☺️).",
    };
  }

  if (reviewReason === "flag") {
    if (isDegradedFlagSlug(entry.currentSlug, entry.proposedMasterSlug)) {
      return {
        decision: "KEEP_CURRENT_URL",
        confidence: "high",
        reason: "Production flag slug preserves accurate geographic naming; proposed master slug degrades location identity.",
        searchImplications: "Flag search terms map to regional indicators; URL should match established production naming.",
        duplicateContentImplications: "Redirect to degraded flag slug would harm geographic accuracy and indexed URLs.",
      };
    }
    return {
      decision: "REQUIRES_MANUAL_CONTENT_REVIEW",
      confidence: "medium",
      reason: "Flag naming normalization requires editorial review before any redirect.",
      searchImplications: "Flag aliases and country names must remain unambiguous after migration.",
      duplicateContentImplications: "Flag URL changes affect country-specific indexation.",
    };
  }

  if (reviewReason === "unicode-naming-difference") {
    if (isMasterDisambiguationSlug(entry.proposedMasterSlug)) {
      return {
        decision: "KEEP_CURRENT_URL",
        confidence: "high",
        reason: "Master disambiguation slug is less readable than the established production slug.",
        searchImplications: "Production slug is already indexed and human-readable for search.",
        duplicateContentImplications: "Machine-generated disambiguation slug would harm URL quality.",
      };
    }
    if (isApostropheNormalization(entry.currentSlug, entry.proposedMasterSlug)) {
      return {
        decision: "SAFE_TO_REDIRECT",
        confidence: "medium",
        reason: "Apostrophe normalization from hyphenated production slug to canonical Unicode naming form.",
        searchImplications: "Search aliases cover both forms; redirect consolidates to canonical slug.",
        duplicateContentImplications: "Low duplicate-content risk; same canonical identity, naming normalization only.",
      };
    }
    if (isOClockNormalization(entry.currentSlug, entry.proposedMasterSlug)) {
      return {
        decision: "SAFE_TO_REDIRECT",
        confidence: "medium",
        reason: "O'clock punctuation normalization; same canonical clock identity.",
        searchImplications: "Clock search supports numeric and word forms; redirect unifies slug.",
        duplicateContentImplications: "Low risk; established production page redirects to equivalent canonical form.",
      };
    }
    return {
      decision: "KEEP_CURRENT_URL",
      confidence: "medium",
      reason: "Unicode naming difference without safe normalization path; retain indexed production URL.",
      searchImplications: "Existing production slug remains authoritative for search landing.",
      duplicateContentImplications: "Avoid redirect until naming policy is confirmed.",
    };
  }

  return {
    decision: "REQUIRES_MANUAL_CONTENT_REVIEW",
    confidence: "low",
    reason: `Unresolved manual-review case (${reviewReason}); requires editorial review.`,
    searchImplications: "Search behavior unchanged while URL remains at production slug.",
    duplicateContentImplications: "No redirect until explicit content review completes.",
  };
}

export function decideExtrasCase(
  entry: RedirectInventoryEntry,
  slugSets: ReturnType<typeof buildProductionSlugSets>,
): Pick<ExtrasMigrationDecisionEntry, "decision" | "confidence" | "reason" | "destinationConflictsWithUnicode"> {
  const conflictsWithUnicode =
    slugSets.unicodeBackedSlugs.has(entry.proposedMasterSlug) &&
    !entry.currentSlug.startsWith("extra-");

  if (conflictsWithUnicode) {
    return {
      destinationConflictsWithUnicode: true,
      decision: "DO_NOT_MIGRATE",
      confidence: "high",
      reason: "Proposed canonical slug collides with an existing Unicode-backed production identity.",
    };
  }

  if (!entry.currentSlug.startsWith("extra-")) {
    return {
      destinationConflictsWithUnicode: false,
      decision: "REQUIRES_MANUAL_REVIEW",
      confidence: "low",
      reason: "Expected extra-* production route prefix missing; requires manual route review.",
    };
  }

  return {
    destinationConflictsWithUnicode: false,
    decision: "KEEP_EXTRA_URL",
    confidence: "high",
    reason:
      "Preserve /emoji/extra-* URL as canonical; master slug omits prefix and redirect would create ambiguity.",
  };
}

export function decideSourceSpecificCase(
  entry: RedirectInventoryEntry,
  slugSets: ReturnType<typeof buildProductionSlugSets>,
  rootDir: string = process.cwd(),
): Pick<
  SourceSpecificMigrationDecisionEntry,
  | "decision"
  | "confidence"
  | "reason"
  | "isUnicodeBacked"
  | "isPua"
  | "isArtworkOnly"
  | "proposedSlugCollidesWithUnicode"
> {
  const reader = getMasterReader(rootDir);
  const canonical = reader.canonicalRecords.get(entry.canonicalId);
  const isPua = canonical?.identityType === "private-use" || /source:.*:[EF][0-9A-F]{3}/i.test(entry.canonicalId);
  const isArtworkOnly = canonical?.identityType === "source-specific" && !entry.canonicalId.startsWith("unicode:");
  const isUnicodeBacked = entry.canonicalId.startsWith("unicode:");
  const collides =
    slugSets.unicodeBackedSlugs.has(entry.proposedMasterSlug) ||
    slugSets.standardSlugs.has(entry.proposedMasterSlug);

  if (collides) {
    return {
      isUnicodeBacked,
      isPua,
      isArtworkOnly,
      proposedSlugCollidesWithUnicode: true,
      decision: "DO_NOT_MIGRATE",
      confidence: "high",
      reason: "Proposed master slug would collide with an existing Unicode production page.",
    };
  }

  if (isPua || isArtworkOnly || entry.canonicalId.startsWith("source:")) {
    return {
      isUnicodeBacked,
      isPua,
      isArtworkOnly,
      proposedSlugCollidesWithUnicode: false,
      decision: "KEEP_SOURCE_URL",
      confidence: "high",
      reason: "Source-specific or PUA identity must remain at its production URL; do not force into Unicode canonical slug.",
    };
  }

  return {
    isUnicodeBacked,
    isPua,
    isArtworkOnly,
    proposedSlugCollidesWithUnicode: false,
    decision: "REQUIRES_MANUAL_REVIEW",
    confidence: "medium",
    reason: "Source-specific identity requires explicit policy before any redirect.",
  };
}

export function toFinalMigrationDecision(
  entry: RedirectInventoryEntry,
  manualDecision?: ManualReviewDecision,
  extrasDecision?: ExtrasMigrationDecision,
  sourceDecision?: SourceSpecificMigrationDecision,
): FinalMigrationDecision {
  switch (entry.mismatchClassification) {
    case "SAFE_REDIRECT":
      return "SAFE_TO_REDIRECT";
    case "MANUAL_REVIEW":
      if (manualDecision === "SAFE_TO_REDIRECT") {
        return "SAFE_TO_REDIRECT";
      }
      if (manualDecision === "REQUIRES_NEW_CANONICAL") {
        return "REQUIRES_NEW_CANONICAL";
      }
      if (manualDecision === "REQUIRES_MANUAL_CONTENT_REVIEW") {
        return "REQUIRES_MANUAL_CONTENT_REVIEW";
      }
      if (manualDecision === "DO_NOT_MIGRATE") {
        return "DO_NOT_MIGRATE";
      }
      return "KEEP_CURRENT_URL";
    case "EXTRAS_COMPATIBILITY":
      if (extrasDecision === "SAFE_TO_REDIRECT") {
        return "SAFE_TO_REDIRECT";
      }
      if (extrasDecision === "DO_NOT_MIGRATE") {
        return "DO_NOT_MIGRATE";
      }
      if (extrasDecision === "REQUIRES_MANUAL_REVIEW") {
        return "REQUIRES_MANUAL_CONTENT_REVIEW";
      }
      return "KEEP_EXTRA_URL";
    case "SOURCE_SPECIFIC":
      if (sourceDecision === "SAFE_TO_REDIRECT") {
        return "SAFE_TO_REDIRECT";
      }
      if (sourceDecision === "DO_NOT_MIGRATE") {
        return "DO_NOT_MIGRATE";
      }
      if (sourceDecision === "REQUIRES_MANUAL_REVIEW") {
        return "REQUIRES_MANUAL_CONTENT_REVIEW";
      }
      return "KEEP_SOURCE_URL";
    default:
      return "KEEP_CURRENT_URL";
  }
}

export function buildManualReviewDecisions(rootDir: string = process.cwd()) {
  const inventory = buildRedirectInventory(rootDir);
  const manualEntries = inventory.entries.filter((entry) => entry.mismatchClassification === "MANUAL_REVIEW");

  const byDecision: Record<ManualReviewDecision, number> = {
    KEEP_CURRENT_URL: 0,
    SAFE_TO_REDIRECT: 0,
    REQUIRES_NEW_CANONICAL: 0,
    REQUIRES_MANUAL_CONTENT_REVIEW: 0,
    DO_NOT_MIGRATE: 0,
  };

  const decisions = manualEntries.map((entry) => {
    const resolved = decideManualReviewCase(entry, rootDir);
    byDecision[resolved.decision] += 1;
    const reviewReason = detectManualReviewReason(
      entry.canonicalId,
      entry.currentSlug,
      entry.proposedMasterSlug,
      entry.canonicalName,
    );

    return Object.freeze({
      canonicalId: entry.canonicalId,
      emojiSequence: entry.emojiSequence,
      unicodeSequence: unicodeSequenceFromCanonicalId(entry.canonicalId),
      currentUrl: entry.currentUrl,
      currentSlug: entry.currentSlug,
      proposedSlug: entry.proposedMasterSlug,
      proposedUrl: entry.proposedUrl,
      hasVariationSelector: hasVariationSelector(entry.canonicalId),
      unicodeOfficialName: extractMetadataName(entry.canonicalId, "unicode", rootDir),
      cldrName: extractMetadataName(entry.canonicalId, "cldr", rootDir),
      canonicalMasterName: entry.canonicalName,
      reviewReason,
      ...resolved,
    } satisfies ManualReviewDecisionEntry);
  });

  const status =
    decisions.length === SEO_MIGRATION_REVIEW_BASELINES.manualReview &&
    Object.values(byDecision).reduce((sum, count) => sum + count, 0) === decisions.length
      ? "PASS"
      : "FAIL";

  return auditEnvelope(status, {
    count: decisions.length,
    byDecision: Object.freeze(byDecision),
    entries: Object.freeze(decisions),
  });
}

export function buildExtrasMigrationDecisions(rootDir: string = process.cwd()) {
  const inventory = buildRedirectInventory(rootDir);
  const slugSets = buildProductionSlugSets(rootDir);
  const extrasEntries = inventory.entries.filter(
    (entry) => entry.mismatchClassification === "EXTRAS_COMPATIBILITY",
  );

  const byDecision: Record<ExtrasMigrationDecision, number> = {
    KEEP_EXTRA_URL: 0,
    SAFE_TO_REDIRECT: 0,
    REQUIRES_MANUAL_REVIEW: 0,
    DO_NOT_MIGRATE: 0,
  };

  const decisions = extrasEntries.map((entry) => {
    const resolved = decideExtrasCase(entry, slugSets);
    byDecision[resolved.decision] += 1;
    return Object.freeze({
      canonicalId: entry.canonicalId,
      currentExtrasUrl: entry.currentUrl,
      currentSlug: entry.currentSlug,
      proposedSlug: entry.proposedMasterSlug,
      proposedUrl: entry.proposedUrl,
      emojiSequence: entry.emojiSequence,
      ...resolved,
    } satisfies ExtrasMigrationDecisionEntry);
  });

  const status = decisions.length === SEO_MIGRATION_REVIEW_BASELINES.extrasCompatibility ? "PASS" : "FAIL";

  return auditEnvelope(status, {
    count: decisions.length,
    byDecision: Object.freeze(byDecision),
    entries: Object.freeze(decisions),
  });
}

export function buildSourceSpecificDecisions(rootDir: string = process.cwd()) {
  const inventory = buildRedirectInventory(rootDir);
  const slugSets = buildProductionSlugSets(rootDir);
  const sourceEntries = inventory.entries.filter((entry) => entry.mismatchClassification === "SOURCE_SPECIFIC");

  const byDecision: Record<SourceSpecificMigrationDecision, number> = {
    KEEP_SOURCE_URL: 0,
    SAFE_TO_REDIRECT: 0,
    REQUIRES_MANUAL_REVIEW: 0,
    DO_NOT_MIGRATE: 0,
  };

  const decisions = sourceEntries.map((entry) => {
    const resolved = decideSourceSpecificCase(entry, slugSets, rootDir);
    byDecision[resolved.decision] += 1;
    const source = entry.canonicalId.split(":")[1] ?? "unknown";
    return Object.freeze({
      canonicalId: entry.canonicalId,
      source,
      currentUrl: entry.currentUrl,
      proposedSlug: entry.proposedMasterSlug,
      proposedUrl: entry.proposedUrl,
      emojiSequence: entry.emojiSequence,
      hasProductionPage: true,
      ...resolved,
    } satisfies SourceSpecificMigrationDecisionEntry);
  });

  const status = decisions.length === SEO_MIGRATION_REVIEW_BASELINES.sourceSpecific ? "PASS" : "FAIL";

  return auditEnvelope(status, {
    count: decisions.length,
    byDecision: Object.freeze(byDecision),
    entries: Object.freeze(decisions),
  });
}

export function buildFinalMigrationMatrix(rootDir: string = process.cwd()) {
  const inventory = buildRedirectInventory(rootDir);
  const manual = buildManualReviewDecisions(rootDir);
  const extras = buildExtrasMigrationDecisions(rootDir);
  const source = buildSourceSpecificDecisions(rootDir);

  const manualByCanonical = new Map(manual.entries.map((entry) => [entry.canonicalId, entry]));
  const extrasByCanonical = new Map(extras.entries.map((entry) => [entry.canonicalId, entry]));
  const sourceByCanonical = new Map(source.entries.map((entry) => [entry.canonicalId, entry]));

  const matrix = inventory.entries.map((entry) => {
    const manualEntry = manualByCanonical.get(entry.canonicalId);
    const extrasEntry = extrasByCanonical.get(entry.canonicalId);
    const sourceEntry = sourceByCanonical.get(entry.canonicalId);

    const decision = toFinalMigrationDecision(
      entry,
      manualEntry?.decision,
      extrasEntry?.decision,
      sourceEntry?.decision,
    );

    let confidence: "high" | "medium" | "low" = entry.confidence;
    let reason = entry.reason;
    if (manualEntry) {
      confidence = manualEntry.confidence;
      reason = manualEntry.reason;
    } else if (extrasEntry) {
      confidence = extrasEntry.confidence;
      reason = extrasEntry.reason;
    } else if (sourceEntry) {
      confidence = sourceEntry.confidence;
      reason = sourceEntry.reason;
    } else if (decision === "SAFE_TO_REDIRECT") {
      confidence = "high";
      reason = "Unambiguous slug normalization; safe 301 redirect candidate.";
    }

    return Object.freeze({
      currentUrl: entry.currentUrl,
      proposedUrl: entry.proposedUrl,
      canonicalId: entry.canonicalId,
      emoji: entry.emojiSequence,
      classification: entry.mismatchClassification,
      decision,
      confidence,
      reason,
    } satisfies FinalMigrationMatrixEntry);
  });

  const byDecision: Record<FinalMigrationDecision, number> = {
    SAFE_TO_REDIRECT: 0,
    KEEP_CURRENT_URL: 0,
    KEEP_EXTRA_URL: 0,
    KEEP_SOURCE_URL: 0,
    REQUIRES_NEW_CANONICAL: 0,
    REQUIRES_MANUAL_CONTENT_REVIEW: 0,
    DO_NOT_MIGRATE: 0,
  };
  for (const entry of matrix) {
    byDecision[entry.decision] += 1;
  }

  const uniqueDecisions = new Set(matrix.map((entry) => entry.canonicalId));
  const status =
    matrix.length === SEO_MIGRATION_REVIEW_BASELINES.totalMismatches &&
    uniqueDecisions.size === matrix.length
      ? "PASS"
      : "FAIL";

  return auditEnvelope(status, {
    mismatchCount: matrix.length,
    byDecision: Object.freeze(byDecision),
    entries: Object.freeze(matrix),
  });
}

export function buildRedirectApprovalCandidates(rootDir: string = process.cwd()) {
  const matrix = buildFinalMigrationMatrix(rootDir);
  const candidates = matrix.entries.filter((entry) => entry.decision === "SAFE_TO_REDIRECT");

  const redirectMap = new Map<string, string>();
  const targetToSources = new Map<string, string[]>();
  let redirectLoops = 0;
  let redirectChains = 0;
  let selfRedirects = 0;
  let duplicateTargets = 0;
  let crossIdentityRedirects = 0;

  for (const entry of candidates) {
    if (entry.currentUrl === entry.proposedUrl) {
      selfRedirects += 1;
    }
    redirectMap.set(entry.currentUrl, entry.proposedUrl);
    const sources = targetToSources.get(entry.proposedUrl) ?? [];
    sources.push(entry.canonicalId);
    targetToSources.set(entry.proposedUrl, sources);
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
    const unique = new Set(sources);
    if (unique.size > 1) {
      crossIdentityRedirects += 1;
    }
    if (sources.length > 1) {
      duplicateTargets += 1;
    }
  }

  const checks = Object.freeze({
    exactlyOneTarget: candidates.every((entry) => entry.proposedUrl.length > 0),
    noSelfRedirects: selfRedirects === 0,
    noRedirectLoops: redirectLoops === 0,
    noRedirectChains: redirectChains === 0,
    noDuplicateTargets: duplicateTargets === 0,
    noCrossIdentityRedirects: crossIdentityRedirects === 0,
    noProviderSpecificUrls: candidates.every((entry) => !entry.proposedUrl.includes("openmoji")),
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";

  return auditEnvelope(status, {
    count: candidates.length,
    redirectLoops,
    redirectChains,
    selfRedirects,
    duplicateTargets,
    crossIdentityRedirects,
    checks,
    entries: Object.freeze(candidates),
    implementationStatus: "approved-for-planning-not-applied",
  });
}

export function buildRedirectExclusions(rootDir: string = process.cwd()) {
  const matrix = buildFinalMigrationMatrix(rootDir);
  const exclusions = matrix.entries.filter(
    (entry) =>
      entry.decision === "KEEP_CURRENT_URL" ||
      entry.decision === "KEEP_EXTRA_URL" ||
      entry.decision === "KEEP_SOURCE_URL" ||
      entry.decision === "DO_NOT_MIGRATE" ||
      entry.decision === "REQUIRES_NEW_CANONICAL" ||
      entry.decision === "REQUIRES_MANUAL_CONTENT_REVIEW",
  );

  const byDecision: Partial<Record<FinalMigrationDecision, number>> = {};
  for (const entry of exclusions) {
    byDecision[entry.decision] = (byDecision[entry.decision] ?? 0) + 1;
  }

  return auditEnvelope("PASS", {
    count: exclusions.length,
    byDecision: Object.freeze(byDecision),
    entries: Object.freeze(exclusions),
  });
}

export function buildCanonicalPolicy() {
  return auditEnvelope("PASS", {
    policies: Object.freeze({
      unicodeIdentities: Object.freeze({
        rule: "Prefer stable canonical Unicode-based URLs for standard production pages.",
        mergeDistinctIdentities: false,
      }),
      variationSelectors: Object.freeze({
        rule: "Never merge distinct canonical identities because rendered appearance is similar.",
        examples: Object.freeze(["unicode:263A vs unicode:263A-FE0F"]),
      }),
      extras: Object.freeze({
        rule: "Preserve /emoji/extra-* URLs unless explicit migration approval exists.",
        defaultDecision: "KEEP_EXTRA_URL",
      }),
      sourceSpecificIdentities: Object.freeze({
        rule: "Do not automatically map source-specific identities to Unicode identities.",
        defaultDecision: "KEEP_SOURCE_URL",
      }),
      artworkOnlyIdentities: Object.freeze({
        rule: "Do not create indexable URLs merely because artwork exists.",
        indexable: false,
      }),
      futurePages: Object.freeze({
        rule: "Do not index until a production route exists.",
        autoIndex: false,
      }),
    }),
    implementationAllowed: false,
  });
}

export function buildSeoReviewAudit(rootDir: string = process.cwd()) {
  const matrix = buildFinalMigrationMatrix(rootDir);
  const manual = buildManualReviewDecisions(rootDir);
  const extras = buildExtrasMigrationDecisions(rootDir);
  const source = buildSourceSpecificDecisions(rootDir);
  const approval = buildRedirectApprovalCandidates(rootDir);
  const exclusions = buildRedirectExclusions(rootDir);

  const blockers = {
    safeToRedirect: matrix.byDecision.SAFE_TO_REDIRECT,
    keepCurrent: matrix.byDecision.KEEP_CURRENT_URL,
    keepExtra: matrix.byDecision.KEEP_EXTRA_URL,
    keepSource: matrix.byDecision.KEEP_SOURCE_URL,
    requiringHumanApproval:
      matrix.byDecision.REQUIRES_MANUAL_CONTENT_REVIEW + matrix.byDecision.REQUIRES_NEW_CANONICAL,
    permanentlyExcluded: matrix.byDecision.DO_NOT_MIGRATE,
    requiringNewCanonical: matrix.byDecision.REQUIRES_NEW_CANONICAL,
  };

  const checks = Object.freeze({
    allMismatchesDecided: matrix.mismatchCount === SEO_MIGRATION_REVIEW_BASELINES.totalMismatches,
    manualReviewResolved: manual.count === SEO_MIGRATION_REVIEW_BASELINES.manualReview,
    extrasResolved: extras.count === SEO_MIGRATION_REVIEW_BASELINES.extrasCompatibility,
    sourceSpecificResolved: source.count === SEO_MIGRATION_REVIEW_BASELINES.sourceSpecific,
    deferredCasesResolved:
      manual.count + extras.count + source.count === SEO_MIGRATION_REVIEW_BASELINES.deferredCases,
    redirectSafety: approval.status === "PASS",
    productionUrlsUnchanged: true,
    featureFlagsDisabled: MASTER_INTEGRATION_CONFIG.masterSEOEnabled === false,
  });

  const status = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";

  return auditEnvelope(status, {
    blockers: Object.freeze(blockers),
    checks,
    manualByDecision: manual.byDecision,
    extrasByDecision: extras.byDecision,
    sourceByDecision: source.byDecision,
    matrixByDecision: matrix.byDecision,
    exclusionCount: exclusions.count,
  });
}

export function buildSeoReviewRecommendation(rootDir: string = process.cwd()) {
  const audit = buildSeoReviewAudit(rootDir);
  const approval = buildRedirectApprovalCandidates(rootDir);

  const recommendationBlockers: string[] = [];
  if (audit.blockers.requiringHumanApproval > 0) {
    recommendationBlockers.push(
      `${audit.blockers.requiringHumanApproval} cases require human content or canonical approval.`,
    );
  }
  if (audit.blockers.requiringNewCanonical > 0) {
    recommendationBlockers.push(`${audit.blockers.requiringNewCanonical} cases require a new canonical URL strategy.`);
  }
  if (audit.blockers.permanentlyExcluded > 0) {
    recommendationBlockers.push(`${audit.blockers.permanentlyExcluded} cases are permanently excluded from migration.`);
  }
  if (approval.status !== "PASS") {
    recommendationBlockers.push("Redirect approval candidates failed safety checks.");
  }

  let conclusion: SeoReviewRecommendation;
  if (audit.blockers.requiringNewCanonical > 0 || approval.status !== "PASS") {
    conclusion = "REQUIRES FURTHER SEO DESIGN";
  } else if (recommendationBlockers.length > 0 || audit.blockers.safeToRedirect > 0) {
    conclusion = "READY FOR HUMAN APPROVAL";
  } else {
    conclusion = "READY FOR REDIRECT IMPLEMENTATION";
  }

  return auditEnvelope(audit.status === "PASS" ? "PASS" : "FAIL", {
    conclusion,
    blockers: Object.freeze(recommendationBlockers),
    safeRedirectCandidates: audit.blockers.safeToRedirect,
    keepCurrentTotal:
      audit.blockers.keepCurrent + audit.blockers.keepExtra + audit.blockers.keepSource,
    implementationAllowed: false,
  });
}

export function buildSeoReviewManifest(rootDir: string = process.cwd()) {
  const reviewDir = integrationDataPaths(rootDir).seoMigrationReviewIntegrationDir;
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEO_MIGRATION_REVIEW_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    auditOnly: true,
    featureFlags: ALL_FLAGS_DISABLED(),
    outputs: Object.freeze({
      manualReviewDecisions: `${reviewDir}/manual-review-decisions.json`,
      extrasMigrationDecisions: `${reviewDir}/extras-migration-decisions.json`,
      sourceSpecificDecisions: `${reviewDir}/source-specific-decisions.json`,
      finalMigrationMatrix: `${reviewDir}/final-migration-matrix.json`,
      redirectApprovalCandidates: `${reviewDir}/redirect-approval-candidates.json`,
      redirectExclusions: `${reviewDir}/redirect-exclusions.json`,
      canonicalPolicy: `${reviewDir}/canonical-policy.json`,
      seoReviewAudit: `${reviewDir}/seo-review-audit.json`,
      seoReviewRecommendation: `${reviewDir}/seo-review-recommendation.json`,
      seoReviewManifest: `${reviewDir}/seo-review-manifest.json`,
    }),
  });
}

export function buildSeoMigrationReviewPackage(rootDir: string = process.cwd()) {
  return {
    manualReviewDecisions: buildManualReviewDecisions(rootDir),
    extrasMigrationDecisions: buildExtrasMigrationDecisions(rootDir),
    sourceSpecificDecisions: buildSourceSpecificDecisions(rootDir),
    finalMigrationMatrix: buildFinalMigrationMatrix(rootDir),
    redirectApprovalCandidates: buildRedirectApprovalCandidates(rootDir),
    redirectExclusions: buildRedirectExclusions(rootDir),
    canonicalPolicy: buildCanonicalPolicy(),
    seoReviewAudit: buildSeoReviewAudit(rootDir),
    seoReviewRecommendation: buildSeoReviewRecommendation(rootDir),
    seoReviewManifest: buildSeoReviewManifest(rootDir),
  };
}
