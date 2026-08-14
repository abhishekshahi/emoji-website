import { getCanonicalEmoji } from "@/lib/master/integration/canonical-adapter";
import { getMasterReader } from "@/lib/master/integration/master-reader";
import { getArtwork, listAvailableProviders } from "@/lib/master/integration/artwork/adapter";
import { PROVIDER_LABELS } from "@/lib/master/integration/ui/attribution";
import { getIdentityTypeLabel } from "./visibility";
import { getArtworkProviderPolicy } from "./license-registry";
import { getProductionSlugForCanonical } from "./production-slug";
import { resolvePublicVisibility } from "./visibility";
import type { PublicArtworkProviderInfo, PublicIdentityResponse } from "./types";

export type { PublicArtworkProviderInfo, PublicIdentityResponse } from "./types";

export function buildPublicIdentityResponse(
  canonicalId: string,
  rootDir: string = process.cwd(),
): PublicIdentityResponse | null {
  const lookup = getCanonicalEmoji(canonicalId, rootDir);
  const visibility = resolvePublicVisibility(canonicalId, rootDir);
  if (!lookup || !visibility?.public) {
    return null;
  }

  const { identity, canonicalName, aliases, keywords, safeSearchTerms, seoRecord } = lookup;
  const reader = getMasterReader(rootDir);
  const searchIndexEntry = reader.searchIndex.get(canonicalId);

  const definitions: string[] = [];
  if (seoRecord?.seoDescription) definitions.push(seoRecord.seoDescription);

  const artworkProviders: PublicArtworkProviderInfo[] = [];
  const available = listAvailableProviders(canonicalId, { rootDir, verifyChecksum: false });
  for (const provider of available) {
    const policy = getArtworkProviderPolicy(provider);
    const records = getArtwork(canonicalId, { rootDir, verifyChecksum: false })?.providers[provider] ?? [];
    const primary = records[0];
    const publicServing = policy.publicServingAllowed;
    artworkProviders.push(
      Object.freeze({
        provider,
        label: PROVIDER_LABELS[provider],
        format: primary?.format ?? "unknown",
        license: primary?.license ?? "See /licenses",
        licenseURL: primary?.licenseURL ?? "",
        attribution: primary?.attribution ?? null,
        publicServingAllowed: publicServing,
        downloadAllowed: policy.publicDownloadAllowed && publicServing,
        artworkUrl:
          publicServing && primary
            ? `/api/artwork/${provider}/${primary.sourceId}.${primary.format}`
            : null,
        status: publicServing ? "public" : "restricted",
        message: publicServing
          ? null
          : "Artwork stored in master archive but not publicly served for this provider.",
      }),
    );
  }

  const provenance: { source: string; field: string }[] = [];
  if (canonicalName) provenance.push({ source: canonicalName.source, field: "name" });
  for (const alias of aliases.slice(0, 5)) {
    provenance.push({ source: alias.source, field: "alias" });
  }

  const productionSlug = getProductionSlugForCanonical(canonicalId, rootDir);

  return Object.freeze({
    canonicalId,
    glyph: identity.emoji,
    unicodeSequence: identity.unicodeSequence,
    hexcode: searchIndexEntry?.hexcode ?? null,
    officialName: canonicalName?.value ?? seoRecord?.canonicalName ?? canonicalId,
    identityType: identity.identityType,
    identityTypeLabel: getIdentityTypeLabel(identity.identityType),
    aliases: Object.freeze(aliases.map((a) => a.value)),
    keywords: Object.freeze(keywords.map((k) => k.value)),
    definitions: Object.freeze(definitions),
    semanticTerms: Object.freeze(safeSearchTerms.map((t) => t.value)),
    category: null,
    subcategory: null,
    variants: Object.freeze([]),
    related: Object.freeze([]),
    artworkProviders: Object.freeze(artworkProviders),
    visibility,
    seoPageUrl: productionSlug ? `/emoji/${productionSlug}` : null,
    catalogUrl: visibility.catalogUrl,
    provenance: Object.freeze(provenance),
  });
}

export function buildPublicArtworkResponse(canonicalId: string, rootDir: string = process.cwd()) {
  const identity = buildPublicIdentityResponse(canonicalId, rootDir);
  if (!identity) return null;
  return Object.freeze({
    canonicalId,
    providers: identity.artworkProviders,
  });
}
