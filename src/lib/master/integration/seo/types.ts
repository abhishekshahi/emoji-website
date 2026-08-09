import type { CanonicalIdentityType } from "@/lib/master/canonical/types";

export const SEO_INTEGRATION_PHASE = "8.11D" as const;

export const SEO_BASELINES = {
  canonicalIdentities: 6955,
  seoRecords: 6955,
  safeSeoTerms: 11738,
  safeAliases: 3580,
  restrictedAliases: 435,
  ambiguousTerms: 115387,
  semanticDifferenceConflicts: 676,
  productionMappings: 4486,
} as const;

export type SeoEligibilityCategory =
  | "indexable"
  | "not-indexable"
  | "existing-production-page"
  | "future-page"
  | "source-specific"
  | "private-use"
  | "artwork-only"
  | "utility"
  | "insufficient-content"
  | "duplicate-slug"
  | "ambiguous";

export type SeoSlugIssueKind =
  | "empty-slug"
  | "duplicate-slug"
  | "invalid-slug"
  | "unsafe-characters"
  | "case-inconsistency"
  | "reserved-route"
  | "production-route-collision"
  | "sequence-collision"
  | "semantic-collision"
  | "source-specific-collision";

export type SeoRobotsDirective = "index,follow" | "noindex,follow" | "noindex,nofollow";

export interface SeoSourceProvenance {
  readonly term: string;
  readonly source: string;
  readonly canonicalId: string;
  readonly sourceVersion: string | null;
  readonly sourceRecordRef: string | null;
}

export interface ProductionSeoLookup {
  readonly canonicalId: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly canonicalURL: string;
  readonly indexable: boolean;
  readonly robots: SeoRobotsDirective;
  readonly keywords: readonly string[];
  readonly aliases: readonly string[];
  readonly sourceProvenance: readonly SeoSourceProvenance[];
}

export interface SeoPolicyDecision {
  readonly canonicalId: string;
  readonly identityType: CanonicalIdentityType | "unknown";
  readonly eligibility: SeoEligibilityCategory;
  readonly indexable: boolean;
  readonly robots: SeoRobotsDirective;
  readonly sitemapEligible: boolean;
  readonly reason: string;
}

export interface SeoProductionCoverageEntry {
  readonly canonicalId: string;
  readonly existingProductionRoute: string | null;
  readonly existingIndexableStatus: boolean;
  readonly masterSEOAvailable: boolean;
  readonly masterSlug: string;
  readonly productionSlug: string | null;
  readonly slugMismatch: boolean;
}

export interface SeoSlugAuditEntry {
  readonly canonicalId: string;
  readonly slug: string;
  readonly issue: SeoSlugIssueKind;
  readonly detail: string;
  readonly relatedCanonicalIds: readonly string[];
}

export interface SeoCanonicalAuditEntry {
  readonly canonicalId: string;
  readonly canonicalName: string;
  readonly slug: string;
  readonly identityType: CanonicalIdentityType | "unknown";
  readonly eligibility: SeoEligibilityCategory;
  readonly indexable: boolean;
  readonly disambiguated: boolean;
  readonly disambiguationReason: string | null;
}

export interface SeoIndexabilityAuditEntry {
  readonly canonicalId: string;
  readonly eligibility: SeoEligibilityCategory;
  readonly indexable: boolean;
  readonly robots: SeoRobotsDirective;
  readonly reason: string;
}

export interface SeoSitemapEligibilityEntry {
  readonly canonicalId: string;
  readonly category: SeoEligibilityCategory;
  readonly sitemapEligible: boolean;
  readonly canonicalURL: string | null;
}

export interface SeoContentQualityEntry {
  readonly canonicalId: string;
  readonly hasCanonicalName: boolean;
  readonly hasEmojiCharacter: boolean;
  readonly hasProductionPage: boolean;
  readonly sufficientContent: boolean;
  readonly flagged: boolean;
  readonly reason: string | null;
}

export interface SeoProductionCoverageReport {
  readonly generatedAt: string;
  readonly phase: typeof SEO_INTEGRATION_PHASE;
  readonly releaseId: string;
  readonly totalProductionRecords: number;
  readonly mappedRecords: number;
  readonly slugMismatches: number;
  readonly entries: readonly SeoProductionCoverageEntry[];
  readonly status: "PASS" | "FAIL";
}

export interface SeoSlugAuditReport {
  readonly generatedAt: string;
  readonly phase: typeof SEO_INTEGRATION_PHASE;
  readonly releaseId: string;
  readonly totalRecords: number;
  readonly issueCount: number;
  readonly duplicateSlugCollisions: number;
  readonly entries: readonly SeoSlugAuditEntry[];
  readonly status: "PASS" | "FAIL";
}

export interface SeoCanonicalAuditReport {
  readonly generatedAt: string;
  readonly phase: typeof SEO_INTEGRATION_PHASE;
  readonly releaseId: string;
  readonly totalRecords: number;
  readonly counts: Readonly<Record<SeoEligibilityCategory, number>>;
  readonly entries: readonly SeoCanonicalAuditEntry[];
  readonly status: "PASS" | "FAIL";
}

export interface SeoIndexabilityAuditReport {
  readonly generatedAt: string;
  readonly phase: typeof SEO_INTEGRATION_PHASE;
  readonly releaseId: string;
  readonly indexable: number;
  readonly notIndexable: number;
  readonly entries: readonly SeoIndexabilityAuditEntry[];
  readonly status: "PASS" | "FAIL";
}

export interface SeoSitemapEligibilityReport {
  readonly generatedAt: string;
  readonly phase: typeof SEO_INTEGRATION_PHASE;
  readonly releaseId: string;
  readonly counts: Readonly<Record<SeoEligibilityCategory, number>>;
  readonly entries: readonly SeoSitemapEligibilityEntry[];
  readonly status: "PASS" | "FAIL";
}

export interface SeoContentQualityAuditReport {
  readonly generatedAt: string;
  readonly phase: typeof SEO_INTEGRATION_PHASE;
  readonly releaseId: string;
  readonly insufficientContent: number;
  readonly entries: readonly SeoContentQualityEntry[];
  readonly status: "PASS" | "FAIL";
}

export interface SeoIntegrationAuditReport {
  readonly generatedAt: string;
  readonly phase: typeof SEO_INTEGRATION_PHASE;
  readonly releaseId: string;
  readonly metadataIntegration: "PASS" | "FAIL";
  readonly canonicalUrlIntegrity: "PASS" | "FAIL";
  readonly slugIntegrity: "PASS" | "FAIL";
  readonly indexabilitySafety: "PASS" | "FAIL";
  readonly sitemapSafety: "PASS" | "FAIL";
  readonly contentQuality: "PASS" | "FAIL";
  readonly licenseAttribution: "PASS" | "FAIL";
  readonly featureFlag: "PASS" | "FAIL";
  readonly productionSafety: "PASS" | "FAIL";
  readonly ambiguityProtection: "PASS" | "FAIL";
  readonly status: "PASS" | "FAIL";
}

export interface SeoIntegrationManifest {
  readonly generatedAt: string;
  readonly phase: typeof SEO_INTEGRATION_PHASE;
  readonly releaseId: string;
  readonly featureFlags: Readonly<{
    readonly masterSEOEnabled: false;
  }>;
  readonly outputs: Readonly<{
    readonly productionSeoCoverage: string;
    readonly seoCanonicalAudit: string;
    readonly seoSlugAudit: string;
    readonly seoIndexabilityAudit: string;
    readonly seoSitemapEligibility: string;
    readonly seoContentQualityAudit: string;
    readonly seoIntegrationAudit: string;
  }>;
}
