import type { CanonicalEmojiRecord } from "@/lib/master/canonical/types";
import type { CanonicalSeoRecord } from "@/lib/master/reconciliation/types";
import type { CanonicalSemanticIndexEntry } from "@/lib/master/semantic/types";
import type { ProductionCanonicalRecord } from "../production-map";
import type { SeoEligibilityCategory, SeoPolicyDecision, SeoRobotsDirective } from "./types";

const UTILITY_CANONICAL_IDS = new Set([
  "source:noto:noto.png",
  "source:noto:noto.png:noto.png",
]);

const RESERVED_SLUGS = new Set([
  "emoji",
  "extras",
  "popular",
  "new",
  "search",
  "licenses",
  "category",
  "api",
  "admin",
]);

export function isUtilityCanonicalId(canonicalId: string): boolean {
  if (UTILITY_CANONICAL_IDS.has(canonicalId)) {
    return true;
  }
  return canonicalId.includes(":noto.png") && canonicalId.startsWith("source:noto:");
}

export function isArtworkOnlyIdentity(
  canonical: CanonicalEmojiRecord,
  productionRecord: ProductionCanonicalRecord | undefined,
): boolean {
  if (productionRecord) {
    return false;
  }
  if (canonical.isUnicode) {
    return false;
  }
  if (canonical.identityType === "source-specific") {
    const hasMetadata = canonical.metadataSources.length > 0;
    const hasSemantic = canonical.semanticSources.length > 0;
    const hasUnicodeEmoji = Boolean(canonical.emoji);
    return !hasMetadata && !hasSemantic && !hasUnicodeEmoji;
  }
  return false;
}

export function hasSufficientSeoContent(
  canonical: CanonicalEmojiRecord,
  seoRecord: CanonicalSeoRecord | null,
  productionRecord: ProductionCanonicalRecord | undefined,
): boolean {
  const hasCanonicalName = Boolean(seoRecord?.canonicalName?.trim() || canonical.emoji);
  const hasEmojiCharacter = Boolean(canonical.emoji);
  const hasProductionPage = Boolean(productionRecord);
  return hasCanonicalName && (hasEmojiCharacter || hasProductionPage);
}

export function evaluateSeoPolicy(input: {
  canonical: CanonicalEmojiRecord;
  seoRecord: CanonicalSeoRecord | null;
  productionRecord: ProductionCanonicalRecord | undefined;
  productionSlug: string | null;
  semanticEntry: CanonicalSemanticIndexEntry | null;
}): SeoPolicyDecision {
  const { canonical, seoRecord, productionRecord, productionSlug } = input;
  const canonicalId = canonical.canonicalId;

  if (isUtilityCanonicalId(canonicalId)) {
    return freezeDecision({
      canonicalId,
      identityType: canonical.identityType,
      eligibility: "utility",
      indexable: false,
      robots: "noindex,nofollow",
      sitemapEligible: false,
      reason: "Utility/support artwork is not indexable as an emoji page.",
    });
  }

  if (productionRecord && productionSlug) {
    return freezeDecision({
      canonicalId,
      identityType: canonical.identityType,
      eligibility: "existing-production-page",
      indexable: true,
      robots: "index,follow",
      sitemapEligible: true,
      reason: canonical.identityType === "private-use"
        ? "Existing OpenMoji extra page; not promoted to a Unicode identity."
        : "Existing production emoji page.",
    });
  }

  if (canonical.identityType === "private-use") {
    return freezeDecision({
      canonicalId,
      identityType: canonical.identityType,
      eligibility: "private-use",
      indexable: false,
      robots: "noindex,follow",
      sitemapEligible: false,
      reason: "Private-use OpenMoji identities must not become normal Unicode emoji pages.",
    });
  }

  if (canonical.identityType === "source-specific" && !productionRecord) {
    if (isArtworkOnlyIdentity(canonical, productionRecord)) {
      return freezeDecision({
        canonicalId,
        identityType: canonical.identityType,
        eligibility: "artwork-only",
        indexable: false,
        robots: "noindex,follow",
        sitemapEligible: false,
        reason: "Artwork-only source asset without emoji identity.",
      });
    }

    return freezeDecision({
      canonicalId,
      identityType: canonical.identityType,
      eligibility: "source-specific",
      indexable: false,
      robots: "noindex,follow",
      sitemapEligible: false,
      reason: "Source-specific identity without production page.",
    });
  }

  if (!hasSufficientSeoContent(canonical, seoRecord, productionRecord)) {
    return freezeDecision({
      canonicalId,
      identityType: canonical.identityType,
      eligibility: "insufficient-content",
      indexable: false,
      robots: "noindex,nofollow",
      sitemapEligible: false,
      reason: "Insufficient meaningful content for indexation.",
    });
  }

  if (seoRecord?.disambiguated) {
    return freezeDecision({
      canonicalId,
      identityType: canonical.identityType,
      eligibility: "duplicate-slug",
      indexable: false,
      robots: "noindex,follow",
      sitemapEligible: false,
      reason: seoRecord.disambiguationReason ?? "Slug required disambiguation; no production page.",
    });
  }

  if (canonical.isUnicode) {
    return freezeDecision({
      canonicalId,
      identityType: canonical.identityType,
      eligibility: "future-page",
      indexable: false,
      robots: "noindex,follow",
      sitemapEligible: false,
      reason: "Unicode identity without existing production page.",
    });
  }

  return freezeDecision({
    canonicalId,
    identityType: canonical.identityType,
    eligibility: "not-indexable",
    indexable: false,
    robots: "noindex,follow",
    sitemapEligible: false,
    reason: "Not eligible for public indexation.",
  });
}

export function isAmbiguousSeoTerm(
  term: string,
  semanticTerms: ReadonlyMap<string, { ambiguous: boolean; publicSeo: boolean }>,
  seoSlugOwners?: ReadonlyMap<string, readonly string[]>,
): boolean {
  const normalized = term.trim().toLowerCase();
  const entry = semanticTerms.get(normalized);
  if (!entry) {
    return false;
  }

  if (seoSlugOwners) {
    const owners = seoSlugOwners.get(normalized) ?? [];
    if (owners.length === 1) {
      return false;
    }
  }

  return entry.ambiguous || !entry.publicSeo;
}

export function isReservedSeoSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

export function isValidSeoSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function freezeDecision(decision: {
  canonicalId: string;
  identityType: CanonicalEmojiRecord["identityType"] | "unknown";
  eligibility: SeoEligibilityCategory;
  indexable: boolean;
  robots: SeoRobotsDirective;
  sitemapEligible: boolean;
  reason: string;
}): SeoPolicyDecision {
  return Object.freeze(decision);
}
