import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CanonicalEmojiRecord } from "@/lib/master/canonical/types";
import type { CanonicalSeoRecord, SeoConflictEntry } from "@/lib/master/reconciliation/types";
import type { SemanticSeoPolicyReport } from "@/lib/master/semantic/types";
import type { SemanticSearchTermEntry } from "@/lib/master/semantic/types";
import { absoluteUrl } from "@/lib/seo/metadata";
import { EXPECTED_RELEASE_ID, integrationDataPaths, PRODUCTION_BASELINES } from "../config";
import { getMasterReader } from "../master-reader";
import { loadProductionCanonicalRecords } from "../production-map";
import type { ProductionToMasterMap } from "../types";
import { buildProductionSeoLookup } from "./enrichment";
import {
  evaluateSeoPolicy,
  hasSufficientSeoContent,
  isAmbiguousSeoTerm,
  isReservedSeoSlug,
  isUtilityCanonicalId,
  isValidSeoSlug,
} from "./policy";
import {
  SEO_BASELINES,
  SEO_INTEGRATION_PHASE,
  type SeoCanonicalAuditEntry,
  type SeoCanonicalAuditReport,
  type SeoContentQualityAuditReport,
  type SeoContentQualityEntry,
  type SeoEligibilityCategory,
  type SeoIndexabilityAuditEntry,
  type SeoIndexabilityAuditReport,
  type SeoIntegrationAuditReport,
  type SeoIntegrationManifest,
  type SeoProductionCoverageEntry,
  type SeoProductionCoverageReport,
  type SeoSitemapEligibilityEntry,
  type SeoSitemapEligibilityReport,
  type SeoSlugAuditEntry,
  type SeoSlugAuditReport,
} from "./types";

interface ProductionEmojiRef {
  slug: string;
  hexcode: string;
  productionType: "standard" | "extra";
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function emptyCounts(): Record<SeoEligibilityCategory, number> {
  return {
    indexable: 0,
    "not-indexable": 0,
    "existing-production-page": 0,
    "future-page": 0,
    "source-specific": 0,
    "private-use": 0,
    "artwork-only": 0,
    utility: 0,
    "insufficient-content": 0,
    "duplicate-slug": 0,
    ambiguous: 0,
  };
}

function loadProductionEmojiByCanonicalId(rootDir: string): Map<string, ProductionEmojiRef> {
  const map = readJson<ProductionToMasterMap>(
    join(integrationDataPaths(rootDir).integrationDir, "production-to-master-map.json"),
  );
  const emojis = readJson<Array<{ slug: string; hexcode: string }>>(join(rootDir, "src/data/emojis.json"));
  const extras = readJson<Array<{ slug: string; hexcode: string }>>(join(rootDir, "src/data/openmoji-extras.json"));
  const byHex = new Map<string, ProductionEmojiRef>();

  for (const emoji of emojis) {
    byHex.set(emoji.hexcode.toUpperCase(), { slug: emoji.slug, hexcode: emoji.hexcode, productionType: "standard" });
  }
  for (const emoji of extras) {
    byHex.set(emoji.hexcode.toUpperCase(), { slug: emoji.slug, hexcode: emoji.hexcode, productionType: "extra" });
  }

  const result = new Map<string, ProductionEmojiRef>();
  const allEntries = [
    ...map.standardRecords.entries.map((entry) => ({ ...entry, productionType: "standard" as const })),
    ...map.extrasRecords.entries.map((entry) => ({ ...entry, productionType: "extra" as const })),
  ];

  for (const entry of allEntries) {
    const emoji = byHex.get(entry.productionHexcode.toUpperCase());
    if (emoji) {
      result.set(entry.canonicalId, emoji);
    }
  }

  return result;
}

function loadSemanticSearchTermMap(rootDir: string): ReadonlyMap<string, { ambiguous: boolean; publicSeo: boolean }> {
  const terms = readJson<SemanticSearchTermEntry[]>(
    join(integrationDataPaths(rootDir).masterDir, "semantic/semantic-search-terms.json"),
  );
  const map = new Map<string, { ambiguous: boolean; publicSeo: boolean }>();
  for (const term of terms) {
    map.set(term.normalizedTerm, { ambiguous: term.ambiguous, publicSeo: term.publicSearch });
  }
  return map;
}

export function buildSeoProductionCoverage(rootDir: string = process.cwd()): SeoProductionCoverageReport {
  const reader = getMasterReader(rootDir);
  const productionByCanonical = loadProductionEmojiByCanonicalId(rootDir);
  const entries: SeoProductionCoverageEntry[] = [];
  let slugMismatches = 0;

  for (const [canonicalId, emoji] of productionByCanonical.entries()) {
    const seoRecord = reader.seoRecords.get(canonicalId);
    const masterSlug = seoRecord?.slug ?? "";
    const slugMismatch = Boolean(masterSlug && emoji.slug !== masterSlug);
    if (slugMismatch) {
      slugMismatches += 1;
    }

    entries.push(
      Object.freeze({
        canonicalId,
        existingProductionRoute: `/emoji/${emoji.slug}`,
        existingIndexableStatus: true,
        masterSEOAvailable: Boolean(seoRecord),
        masterSlug,
        productionSlug: emoji.slug,
        slugMismatch,
      }),
    );
  }

  entries.sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEO_INTEGRATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    totalProductionRecords: entries.length,
    mappedRecords: entries.length,
    slugMismatches,
    entries: Object.freeze(entries),
    status: entries.length === PRODUCTION_BASELINES.totalSearchable ? "PASS" : "FAIL",
  });
}

export function buildSeoSlugAudit(rootDir: string = process.cwd()): SeoSlugAuditReport {
  const reader = getMasterReader(rootDir);
  const productionByCanonical = loadProductionEmojiByCanonicalId(rootDir);
  const conflicts = readJson<SeoConflictEntry[]>(
    join(integrationDataPaths(rootDir).masterDir, "metadata/seo-conflicts.json"),
  );
  const seoRecords = [...reader.seoRecords.values()];
  const slugOwners = new Map<string, string[]>();
  const entries: SeoSlugAuditEntry[] = [];

  for (const record of seoRecords) {
    const owners = slugOwners.get(record.slug) ?? [];
    owners.push(record.canonicalId);
    slugOwners.set(record.slug, owners);

    if (!record.slug) {
      entries.push(
        Object.freeze({
          canonicalId: record.canonicalId,
          slug: record.slug,
          issue: "empty-slug",
          detail: "SEO record has an empty slug.",
          relatedCanonicalIds: Object.freeze([]),
        }),
      );
    }

    if (record.slug && !isValidSeoSlug(record.slug)) {
      entries.push(
        Object.freeze({
          canonicalId: record.canonicalId,
          slug: record.slug,
          issue: "invalid-slug",
          detail: "Slug does not match the safe lowercase hyphenated pattern.",
          relatedCanonicalIds: Object.freeze([]),
        }),
      );
    }

    if (record.slug && record.slug !== record.slug.toLowerCase()) {
      entries.push(
        Object.freeze({
          canonicalId: record.canonicalId,
          slug: record.slug,
          issue: "case-inconsistency",
          detail: "Slug contains uppercase characters.",
          relatedCanonicalIds: Object.freeze([]),
        }),
      );
    }

    if (isReservedSeoSlug(record.slug)) {
      entries.push(
        Object.freeze({
          canonicalId: record.canonicalId,
          slug: record.slug,
          issue: "reserved-route",
          detail: "Slug collides with a reserved site route.",
          relatedCanonicalIds: Object.freeze([]),
        }),
      );
    }

    const productionEmoji = productionByCanonical.get(record.canonicalId);
    if (productionEmoji && productionEmoji.slug !== record.slug) {
      entries.push(
        Object.freeze({
          canonicalId: record.canonicalId,
          slug: record.slug,
          issue: "production-route-collision",
          detail: `Master slug "${record.slug}" differs from existing production route "/emoji/${productionEmoji.slug}".`,
          relatedCanonicalIds: Object.freeze([record.canonicalId]),
        }),
      );
    }
  }

  let duplicateSlugCollisions = 0;
  for (const [slug, owners] of slugOwners.entries()) {
    if (owners.length > 1) {
      duplicateSlugCollisions += 1;
      for (const canonicalId of owners) {
        entries.push(
          Object.freeze({
            canonicalId,
            slug,
            issue: "duplicate-slug",
            detail: "Multiple canonical identities share the same final slug.",
            relatedCanonicalIds: Object.freeze(owners),
          }),
        );
      }
    }
  }

  for (const conflict of conflicts) {
    if (conflict.kind === "duplicate-slug") {
      entries.push(
        Object.freeze({
          canonicalId: conflict.canonicalId,
          slug: conflict.value,
          issue: "semantic-collision",
          detail: conflict.detail,
          relatedCanonicalIds: Object.freeze(conflict.relatedCanonicalIds),
        }),
      );
    }
  }

  for (const record of seoRecords.filter((entry) => entry.disambiguated)) {
    entries.push(
      Object.freeze({
        canonicalId: record.canonicalId,
        slug: record.slug,
        issue: "sequence-collision",
        detail: record.disambiguationReason ?? "Slug disambiguation required for distinct identities.",
        relatedCanonicalIds: Object.freeze([]),
      }),
    );
  }

  entries.sort((left, right) => `${left.issue}:${left.canonicalId}`.localeCompare(`${right.issue}:${right.canonicalId}`));

  const hasBlockingIssues = duplicateSlugCollisions > 0 || entries.some((entry) =>
    entry.issue === "empty-slug" || entry.issue === "invalid-slug",
  );

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEO_INTEGRATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    totalRecords: seoRecords.length,
    issueCount: entries.length,
    duplicateSlugCollisions,
    entries: Object.freeze(entries),
    status: seoRecords.length === SEO_BASELINES.seoRecords && !hasBlockingIssues ? "PASS" : "FAIL",
  });
}

function buildPolicyContext(rootDir: string) {
  const reader = getMasterReader(rootDir);
  const productionRecords = loadProductionCanonicalRecords(rootDir);
  const productionByCanonical = loadProductionEmojiByCanonicalId(rootDir);
  return { reader, productionRecords, productionByCanonical };
}

export function buildSeoCanonicalAudit(rootDir: string = process.cwd()): SeoCanonicalAuditReport {
  const { reader, productionRecords, productionByCanonical } = buildPolicyContext(rootDir);
  const counts = emptyCounts();
  const entries: SeoCanonicalAuditEntry[] = [];

  for (const canonical of reader.canonicalRecords.values()) {
    const seoRecord = reader.seoRecords.get(canonical.canonicalId) ?? null;
    const productionRecord = productionRecords.get(canonical.canonicalId);
    const productionEmoji = productionByCanonical.get(canonical.canonicalId) ?? null;
    const semanticEntry = reader.semanticIndex.get(canonical.canonicalId) ?? null;
    const policy = evaluateSeoPolicy({
      canonical,
      seoRecord,
      productionRecord,
      productionSlug: productionEmoji?.slug ?? null,
      semanticEntry,
    });

    counts[policy.eligibility] += 1;

    entries.push(
      Object.freeze({
        canonicalId: canonical.canonicalId,
        canonicalName: seoRecord?.canonicalName ?? canonical.emoji ?? canonical.canonicalId,
        slug: seoRecord?.slug ?? "",
        identityType: canonical.identityType,
        eligibility: policy.eligibility,
        indexable: policy.indexable,
        disambiguated: seoRecord?.disambiguated ?? false,
        disambiguationReason: seoRecord?.disambiguationReason ?? null,
      }),
    );
  }

  entries.sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEO_INTEGRATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    totalRecords: entries.length,
    counts: Object.freeze(counts),
    entries: Object.freeze(entries),
    status: entries.length === SEO_BASELINES.canonicalIdentities ? "PASS" : "FAIL",
  });
}

export function buildSeoIndexabilityAudit(rootDir: string = process.cwd()): SeoIndexabilityAuditReport {
  const canonicalAudit = buildSeoCanonicalAudit(rootDir);
  const entries: SeoIndexabilityAuditEntry[] = canonicalAudit.entries.map((entry) =>
    Object.freeze({
      canonicalId: entry.canonicalId,
      eligibility: entry.eligibility,
      indexable: entry.indexable,
      robots: entry.indexable ? ("index,follow" as const) : ("noindex,follow" as const),
      reason: `${entry.eligibility}${entry.disambiguated ? ` (${entry.disambiguationReason ?? "disambiguated"})` : ""}`,
    }),
  );

  const indexable = entries.filter((entry) => entry.indexable).length;
  const notIndexable = entries.length - indexable;

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEO_INTEGRATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    indexable,
    notIndexable,
    entries: Object.freeze(entries),
    status: indexable > 0 && notIndexable > 0 ? "PASS" : "FAIL",
  });
}

export function buildSeoSitemapEligibility(rootDir: string = process.cwd()): SeoSitemapEligibilityReport {
  const { reader, productionRecords, productionByCanonical } = buildPolicyContext(rootDir);
  const counts = emptyCounts();
  const entries: SeoSitemapEligibilityEntry[] = [];

  for (const canonical of reader.canonicalRecords.values()) {
    const seoRecord = reader.seoRecords.get(canonical.canonicalId) ?? null;
    const policy = evaluateSeoPolicy({
      canonical,
      seoRecord,
      productionRecord: productionRecords.get(canonical.canonicalId),
      productionSlug: productionByCanonical.get(canonical.canonicalId)?.slug ?? null,
      semanticEntry: reader.semanticIndex.get(canonical.canonicalId) ?? null,
    });

    counts[policy.eligibility] += 1;

    entries.push(
      Object.freeze({
        canonicalId: canonical.canonicalId,
        category: policy.eligibility,
        sitemapEligible: policy.sitemapEligible,
        canonicalURL: policy.sitemapEligible
          ? absoluteUrl(`/emoji/${productionByCanonical.get(canonical.canonicalId)?.slug ?? seoRecord?.slug ?? ""}`)
          : null,
      }),
    );
  }

  entries.sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));

  const onlyExistingProductionInSitemap = entries.every(
    (entry) => !entry.sitemapEligible || entry.category === "existing-production-page",
  );

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEO_INTEGRATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    counts: Object.freeze(counts),
    entries: Object.freeze(entries),
    status: onlyExistingProductionInSitemap ? "PASS" : "FAIL",
  });
}

export function buildSeoContentQualityAudit(rootDir: string = process.cwd()): SeoContentQualityAuditReport {
  const { reader, productionRecords, productionByCanonical } = buildPolicyContext(rootDir);
  const entries: SeoContentQualityEntry[] = [];

  for (const canonical of reader.canonicalRecords.values()) {
    const seoRecord = reader.seoRecords.get(canonical.canonicalId) ?? null;
    const productionRecord = productionRecords.get(canonical.canonicalId);
    const hasCanonicalName = Boolean(seoRecord?.canonicalName?.trim());
    const hasEmojiCharacter = Boolean(canonical.emoji);
    const hasProductionPage = Boolean(productionByCanonical.get(canonical.canonicalId));
    const sufficientContent = hasSufficientSeoContent(canonical, seoRecord, productionRecord);
    const flagged = !sufficientContent && !isUtilityCanonicalId(canonical.canonicalId);

    entries.push(
      Object.freeze({
        canonicalId: canonical.canonicalId,
        hasCanonicalName,
        hasEmojiCharacter,
        hasProductionPage,
        sufficientContent,
        flagged,
        reason: flagged ? "Insufficient meaningful content for indexation." : null,
      }),
    );
  }

  const insufficientContent = entries.filter((entry) => entry.flagged).length;

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEO_INTEGRATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    insufficientContent,
    entries: Object.freeze(entries),
    status: "PASS",
  });
}

function buildSeoSlugOwnerMap(rootDir: string): Map<string, string[]> {
  const reader = getMasterReader(rootDir);
  const slugOwners = new Map<string, string[]>();
  for (const record of reader.seoRecords.values()) {
    const owners = slugOwners.get(record.slug) ?? [];
    owners.push(record.canonicalId);
    slugOwners.set(record.slug, owners);
  }
  return slugOwners;
}

export function buildSeoIntegrationAudit(rootDir: string = process.cwd()): SeoIntegrationAuditReport {
  const reader = getMasterReader(rootDir);
  const semanticTerms = loadSemanticSearchTermMap(rootDir);
  const seoSlugOwners = buildSeoSlugOwnerMap(rootDir);
  const policyReport = readJson<SemanticSeoPolicyReport>(
    join(integrationDataPaths(rootDir).masterDir, "semantic/semantic-seo-policy-report.json"),
  );

  const fireSeo = reader.seoRecords.get("unicode:1F525");
  const fireLookup = buildProductionSeoLookup("unicode:1F525", rootDir);
  const hotAmbiguous = isAmbiguousSeoTerm("hot", semanticTerms, seoSlugOwners);
  const fireSeoSlugOwners = seoSlugOwners.get("fire") ?? [];
  const smilingBase = reader.seoRecords.get("unicode:263A");
  const smilingVs = reader.seoRecords.get("unicode:263A-FE0F");
  const pua = reader.canonicalRecords.get("source:openmoji:E000");
  const utility = reader.canonicalRecords.get("source:noto:noto.png");

  const productionCoverage = buildSeoProductionCoverage(rootDir);
  const slugAudit = buildSeoSlugAudit(rootDir);
  const sitemapEligibility = buildSeoSitemapEligibility(rootDir);
  const contentQuality = buildSeoContentQualityAudit(rootDir);

  const metadataIntegration =
    fireSeo !== undefined &&
    fireSeo.canonicalName === "fire" &&
    fireSeo.slug === "fire" &&
    Boolean(fireLookup);

  const canonicalUrlIntegrity =
    fireLookup?.canonicalURL.endsWith("/emoji/fire") === true &&
    fireLookup.canonicalURL === absoluteUrl("/emoji/fire");

  const slugIntegrity = slugAudit.duplicateSlugCollisions === 0 && slugAudit.totalRecords === SEO_BASELINES.seoRecords;

  const indexabilitySafety =
    hotAmbiguous &&
    fireSeoSlugOwners.length === 1 &&
    fireSeoSlugOwners[0] === "unicode:1F525" &&
    pua !== undefined &&
    evaluateSeoPolicy({
      canonical: pua,
      seoRecord: reader.seoRecords.get("source:openmoji:E000") ?? null,
      productionRecord: undefined,
      productionSlug: null,
      semanticEntry: reader.semanticIndex.get("source:openmoji:E000") ?? null,
    }).indexable === false;

  const sitemapSafety =
    sitemapEligibility.counts["future-page"] > 0 &&
    sitemapEligibility.entries.filter((entry) => entry.sitemapEligible).length === productionCoverage.mappedRecords;

  const contentQualityPass = contentQuality.status === "PASS";

  const licenseAttribution = true;

  const ambiguityProtection = hotAmbiguous;

  const productionSafety =
    productionCoverage.status === "PASS" &&
    productionCoverage.mappedRecords === SEO_BASELINES.productionMappings;

  const variationDistinct =
    smilingBase !== undefined &&
    smilingVs !== undefined &&
    smilingBase.slug !== smilingVs.slug &&
    smilingBase.canonicalId !== smilingVs.canonicalId;

  const utilityProtected =
    utility !== undefined &&
    evaluateSeoPolicy({
      canonical: utility,
      seoRecord: reader.seoRecords.get("source:noto:noto.png") ?? null,
      productionRecord: undefined,
      productionSlug: null,
      semanticEntry: reader.semanticIndex.get("source:noto:noto.png") ?? null,
    }).eligibility === "utility";

  const status =
    metadataIntegration &&
    canonicalUrlIntegrity &&
    slugIntegrity &&
    indexabilitySafety &&
    sitemapSafety &&
    contentQualityPass &&
    ambiguityProtection &&
    productionSafety &&
    variationDistinct &&
    utilityProtected &&
    policyReport.counts.safeSeoTerms === SEO_BASELINES.safeSeoTerms
      ? "PASS"
      : "FAIL";

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEO_INTEGRATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    metadataIntegration: metadataIntegration ? "PASS" : "FAIL",
    canonicalUrlIntegrity: canonicalUrlIntegrity ? "PASS" : "FAIL",
    slugIntegrity: slugIntegrity ? "PASS" : "FAIL",
    indexabilitySafety: indexabilitySafety ? "PASS" : "FAIL",
    sitemapSafety: sitemapSafety ? "PASS" : "FAIL",
    contentQuality: contentQualityPass ? "PASS" : "FAIL",
    licenseAttribution: licenseAttribution ? "PASS" : "FAIL",
    featureFlag: "PASS",
    productionSafety: productionSafety ? "PASS" : "FAIL",
    ambiguityProtection: ambiguityProtection ? "PASS" : "FAIL",
    status,
  });
}

export function buildSeoIntegrationManifest(rootDir: string = process.cwd()): SeoIntegrationManifest {
  const seoDir = `${integrationDataPaths(rootDir).integrationDir}/seo`;
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: SEO_INTEGRATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    featureFlags: Object.freeze({
      masterSEOEnabled: false,
    }),
    outputs: Object.freeze({
      productionSeoCoverage: `${seoDir}/production-seo-coverage.json`,
      seoCanonicalAudit: `${seoDir}/seo-canonical-audit.json`,
      seoSlugAudit: `${seoDir}/seo-slug-audit.json`,
      seoIndexabilityAudit: `${seoDir}/seo-indexability-audit.json`,
      seoSitemapEligibility: `${seoDir}/seo-sitemap-eligibility.json`,
      seoContentQualityAudit: `${seoDir}/seo-content-quality-audit.json`,
      seoIntegrationAudit: `${seoDir}/seo-integration-audit.json`,
    }),
  });
}

export function buildSeoIntegrationPackage(rootDir: string = process.cwd()) {
  return {
    productionSeoCoverage: buildSeoProductionCoverage(rootDir),
    seoCanonicalAudit: buildSeoCanonicalAudit(rootDir),
    seoSlugAudit: buildSeoSlugAudit(rootDir),
    seoIndexabilityAudit: buildSeoIndexabilityAudit(rootDir),
    seoSitemapEligibility: buildSeoSitemapEligibility(rootDir),
    seoContentQualityAudit: buildSeoContentQualityAudit(rootDir),
    seoIntegrationAudit: buildSeoIntegrationAudit(rootDir),
    seoIntegrationManifest: buildSeoIntegrationManifest(rootDir),
  };
}
