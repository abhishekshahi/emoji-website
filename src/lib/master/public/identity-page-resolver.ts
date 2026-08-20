import { cache } from "react";
import { getBrowsableEmojiBySlug } from "@/lib/emoji/browsable-data";
import { isUtilityCanonicalId } from "@/lib/master/integration/seo/policy";
import { getCanonicalIdForSlug, getIdentitySlugEntry } from "@/lib/master/public/identity-slug-map";
import type { PublicIdentityResponse } from "@/lib/master/public/types";
import { shouldReadFromR2Binding } from "@/lib/master/r2/config";

export type EmojiPageKind = "browsable" | "master-identity";

export interface EmojiPageResolution {
  readonly kind: EmojiPageKind;
  readonly slug: string;
  readonly canonicalId: string;
  readonly identity: PublicIdentityResponse | null;
}

function buildFallbackIdentity(canonicalId: string, slug: string, name: string): PublicIdentityResponse {
  const identityType = canonicalId.startsWith("unicode:") ? "unicode" : "source-specific";
  return Object.freeze({
    canonicalId,
    glyph: null,
    unicodeSequence: null,
    hexcode: null,
    officialName: name,
    identityType,
    identityTypeLabel: identityType === "unicode" ? "Unicode emoji" : "Source-specific",
    aliases: Object.freeze([]),
    keywords: Object.freeze([]),
    definitions: Object.freeze([]),
    semanticTerms: Object.freeze([]),
    category: null,
    subcategory: null,
    variants: Object.freeze([]),
    related: Object.freeze([]),
    artworkProviders: Object.freeze([]),
    visibility: Object.freeze({
      canonicalId,
      identityType,
      public: true,
      indexable: true,
      downloadable: false,
      artworkPublic: false,
      metadataPublic: true,
      apiPublic: true,
      seoPageUrl: `/emoji/${slug}`,
      catalogUrl: `/catalog/${encodeURIComponent(canonicalId)}`,
      reason: "Master identity page.",
    }),
    seoPageUrl: `/emoji/${slug}`,
    catalogUrl: `/catalog/${encodeURIComponent(canonicalId)}`,
    provenance: Object.freeze([]),
  });
}

async function resolveEmojiPageUncached(slug: string): Promise<EmojiPageResolution | null> {
  const canonicalId = getCanonicalIdForSlug(slug);
  if (!canonicalId) {
    return null;
  }

  if (getBrowsableEmojiBySlug(slug)) {
    return Object.freeze({ kind: "browsable", slug, canonicalId, identity: null });
  }

  if (isUtilityCanonicalId(canonicalId)) {
    return null;
  }

  const identity = shouldReadFromR2Binding()
    ? await (await import("@/lib/master/public/r2-identity-loader")).buildPublicIdentityResponseFromR2(
        canonicalId,
      )
    : (await import("@/lib/master/public/identity-service")).buildPublicIdentityResponse(
        canonicalId,
      );

  const resolvedIdentity =
    identity ??
    (() => {
      const entry = getIdentitySlugEntry(canonicalId);
      return entry ? buildFallbackIdentity(canonicalId, slug, entry.canonicalName) : null;
    })();

  if (!resolvedIdentity) {
    return null;
  }

  return Object.freeze({
    kind: "master-identity",
    slug,
    canonicalId,
    identity: resolvedIdentity,
  });
}

/** Dedupes generateMetadata + page render within the same request. */
export const resolveEmojiPage = cache(resolveEmojiPageUncached);