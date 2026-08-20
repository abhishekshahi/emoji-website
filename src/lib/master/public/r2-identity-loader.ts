import type { ArtworkProvider } from "@/lib/master/canonical/types";
import type { CanonicalIdentityType } from "@/lib/master/canonical/types";
import type { CanonicalSearchRecord } from "@/lib/r2/types";
import { getPublicIdentityR2Payload } from "@/lib/r2";
import { MasterObjectNotFoundError } from "@/lib/r2";
import { isUtilityCanonicalId } from "@/lib/master/integration/seo/policy";
import { PROVIDER_LABELS } from "@/lib/master/integration/ui/attribution";
import { getProductionSlugForCanonicalEdge, resolvePublicCanonicalIdParam } from "./edge-context";
import { getArtworkProviderPolicy } from "./license-registry";
import { buildPublicArtworkApiUrl } from "./artwork-api-url";
import type { PublicArtworkProviderInfo, PublicIdentityResponse } from "./types";
import { encodeCatalogPath, getIdentityTypeLabel } from "./visibility";

/** Minimal R2 identity loader for on-demand emoji pages (kept out of catalog/search bundle). */
const ARTWORK_PROVIDERS: ArtworkProvider[] = ["openmoji", "noto", "twemoji", "fluent"];

type R2IdentityPayload = {
  readonly canonicalId: string;
  readonly emoji: string | null;
  readonly unicodeSequence: string | null;
  readonly identityType: CanonicalIdentityType;
  readonly metadataSources?: readonly string[];
  readonly artwork?: Partial<
    Record<
      ArtworkProvider,
      Array<{
        provider: ArtworkProvider;
        sourceId: string;
        path: string;
      }>
    >
  >;
};

function resolvePublicVisibilityFromR2(
  canonicalId: string,
  identity: R2IdentityPayload,
  slug: string | null,
  hasArtwork: boolean,
  hasMetadata: boolean,
) {
  const isUtility = isUtilityCanonicalId(canonicalId);
  const indexable = slug !== null && !isUtility;

  return Object.freeze({
    canonicalId,
    identityType: identity.identityType,
    public: !isUtility,
    indexable,
    downloadable: hasMetadata,
    artworkPublic: hasArtwork,
    metadataPublic: hasMetadata,
    apiPublic: !isUtility,
    seoPageUrl: slug ? `/emoji/${slug}` : null,
    catalogUrl: encodeCatalogPath(canonicalId),
    reason: indexable ? "Production SEO page available." : "Catalog entry only.",
  });
}

function formatFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  return ext === "png" ? "png" : ext === "svg" ? "svg" : "unknown";
}

function buildArtworkProviders(identity: R2IdentityPayload): PublicArtworkProviderInfo[] {
  const providers: PublicArtworkProviderInfo[] = [];

  for (const provider of ARTWORK_PROVIDERS) {
    const records = identity.artwork?.[provider] ?? [];
    if (records.length === 0) continue;

    const primary = records[0]!;
    const policy = getArtworkProviderPolicy(provider);
    const format = formatFromPath(primary.path);
    const publicServing = policy.publicServingAllowed;

    providers.push(
      Object.freeze({
        provider,
        label: PROVIDER_LABELS[provider],
        format,
        license: "See /licenses",
        licenseURL: "",
        attribution: null,
        publicServingAllowed: publicServing,
        downloadAllowed: policy.publicDownloadAllowed && publicServing,
        artworkUrl:
          publicServing && format !== "unknown"
            ? buildPublicArtworkApiUrl(provider, primary.sourceId, format)
            : null,
        status: publicServing ? "public" : "restricted",
        message: publicServing
          ? null
          : "Artwork stored in master archive but not publicly served for this provider.",
      }),
    );
  }

  return providers;
}

async function loadR2IdentityPayload(canonicalId: string): Promise<{
  identity: R2IdentityPayload;
  search: CanonicalSearchRecord | null;
}> {
  const payload = await getPublicIdentityR2Payload(canonicalId);
  if (!payload) {
    throw new MasterObjectNotFoundError();
  }

  const identity = (payload.identity ?? {
    canonicalId,
    emoji: payload.search?.emoji ?? null,
    unicodeSequence: payload.search?.hexcode ?? null,
    identityType: "unicode",
  }) as R2IdentityPayload;

  return {
    identity,
    search: payload.search ?? null,
  };
}

export async function buildPublicIdentityResponseFromR2(
  canonicalIdInput: string,
): Promise<PublicIdentityResponse | null> {
  const canonicalId = resolvePublicCanonicalIdParam(canonicalIdInput);
  const { identity, search } = await loadR2IdentityPayload(canonicalId);

  if (isUtilityCanonicalId(canonicalId)) {
    return null;
  }

  const slug = getProductionSlugForCanonicalEdge(canonicalId);
  const artworkProviders = buildArtworkProviders(identity);
  const hasArtwork = artworkProviders.some((provider) => provider.publicServingAllowed);
  const hasMetadata = (identity.metadataSources?.length ?? 0) > 0 || Boolean(search);
  const visibility = resolvePublicVisibilityFromR2(canonicalId, identity, slug, hasArtwork, hasMetadata);

  if (!visibility.public) {
    return null;
  }

  return Object.freeze({
    canonicalId,
    glyph: identity.emoji ?? search?.emoji ?? null,
    unicodeSequence: identity.unicodeSequence ?? search?.hexcode ?? null,
    hexcode: search?.hexcode ?? identity.unicodeSequence ?? null,
    officialName: search?.canonicalName ?? canonicalId,
    identityType: identity.identityType,
    identityTypeLabel: getIdentityTypeLabel(identity.identityType),
    aliases: Object.freeze([...(search?.aliases ?? [])]),
    keywords: Object.freeze([...(search?.keywords ?? [])]),
    definitions: Object.freeze([]),
    semanticTerms: Object.freeze([]),
    category: null,
    subcategory: null,
    variants: Object.freeze([]),
    related: Object.freeze([]),
    artworkProviders: Object.freeze(artworkProviders),
    visibility,
    seoPageUrl: slug ? `/emoji/${slug}` : null,
    catalogUrl: visibility.catalogUrl,
    provenance: Object.freeze(
      search?.canonicalName ? [{ source: "master-r2-search", field: "name" }] : [],
    ),
  });
}
