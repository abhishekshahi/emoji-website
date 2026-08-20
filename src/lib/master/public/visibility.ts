import type { CanonicalIdentityType } from "@/lib/master/canonical/types";
import type { ArtworkProvider } from "@/lib/master/canonical/types";
import { getMasterReader } from "@/lib/master/integration/master-reader";
import { evaluateSeoPolicy } from "@/lib/master/integration/seo/policy";
import { loadProductionCanonicalRecords } from "@/lib/master/integration/production-map";
import { isUtilityCanonicalId } from "@/lib/master/integration/seo/policy";
import { getArtworkProviderPolicy } from "./license-registry";
import { getProductionSlugForCanonical } from "./production-slug";

export interface PublicVisibilityMatrix {
  readonly canonicalId: string;
  readonly identityType: CanonicalIdentityType | "unknown";
  readonly public: boolean;
  readonly indexable: boolean;
  readonly downloadable: boolean;
  readonly artworkPublic: boolean;
  readonly metadataPublic: boolean;
  readonly apiPublic: boolean;
  readonly seoPageUrl: string | null;
  readonly catalogUrl: string;
  readonly reason: string;
}

export function encodeCatalogPath(canonicalId: string): string {
  return `/catalog/${encodeURIComponent(canonicalId)}`;
}

export function resolvePublicVisibility(
  canonicalId: string,
  rootDir: string = process.cwd(),
): PublicVisibilityMatrix | null {
  const reader = getMasterReader(rootDir);
  const canonical = reader.canonicalRecords.get(canonicalId);
  if (!canonical) {
    return null;
  }

  const seoRecord = reader.seoRecords.get(canonicalId) ?? null;
  const semanticEntry = reader.semanticIndex.get(canonicalId) ?? null;
  const productionRecord = loadProductionCanonicalRecords(rootDir).get(canonicalId);
  const productionSlug = getProductionSlugForCanonical(canonicalId, rootDir);
  const policy = evaluateSeoPolicy({
    canonical,
    seoRecord,
    productionRecord,
    productionSlug,
    semanticEntry,
  });

  const artworkLookup = reader.artworkByCanonical.get(canonicalId);
  const providers: ArtworkProvider[] = ["openmoji", "noto", "twemoji", "fluent"];
  const artworkPublic = providers.some((provider) => {
    const records = artworkLookup?.[provider] ?? [];
    if (records.length === 0) return false;
    return getArtworkProviderPolicy(provider).publicServingAllowed;
  });

  const metadataPublic =
    canonical.metadataSources.length > 0 || Boolean(seoRecord) || Boolean(semanticEntry);
  const isUtility = isUtilityCanonicalId(canonicalId);

  return Object.freeze({
    canonicalId,
    identityType: canonical.identityType,
    public: !isUtility,
    indexable: policy.indexable,
    downloadable: metadataPublic,
    artworkPublic,
    metadataPublic,
    apiPublic: !isUtility,
    seoPageUrl: productionSlug ? `/emoji/${productionSlug}` : null,
    catalogUrl: encodeCatalogPath(canonicalId),
    reason: policy.reason,
  });
}

export function getIdentityTypeLabel(identityType: CanonicalIdentityType | "unknown"): string {
  switch (identityType) {
    case "unicode":
      return "Unicode";
    case "source-specific":
      return "Source-specific";
    case "private-use":
      return "Private-use";
    default:
      return "Unknown";
  }
}

export function getIdentityTypeDescription(identityType: CanonicalIdentityType | "unknown"): string {
  switch (identityType) {
    case "unicode":
      return "Official Unicode emoji identity.";
    case "source-specific":
      return "Source-specific record — not an official Unicode emoji identity.";
    case "private-use":
      return "Private-use OpenMoji identity — not an official Unicode emoji.";
    default:
      return "";
  }
}
