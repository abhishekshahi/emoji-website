/**
 * MASTER DATA = all canonical identities in the frozen master release.
 * PUBLIC SEO CATALOG = all 6955 master identity pages (Phase 8.61).
 */
export const MASTER_IDENTITY_COUNT = 6955 as const;
export const MASTER_ARTWORK_RECORD_COUNT = 40071 as const;
/** Legacy browsable production dataset (emojis.json + openmoji-extras.json). */
export const PRODUCTION_BROWSABLE_EMOJI_COUNT = 4486 as const;
export const PUBLIC_SEO_EMOJI_PAGE_COUNT = MASTER_IDENTITY_COUNT;
/** All identities minus 2 utility/support records (still have pages, not indexable). */
export const PUBLIC_INDEXABLE_IDENTITY_COUNT = 6953 as const;
/** 6953 indexable emoji + 7 static + 29 category + 57 hub pages (excludes 2 utility identities) */
export const PUBLIC_SITEMAP_URL_COUNT = 7046 as const;

export function isPublicSeoCatalogSlug(slug: string, approvedSlugs: ReadonlySet<string>): boolean {
  return approvedSlugs.has(slug);
}

export function filterPublicSeoCatalogSlugs(slugs: readonly string[]): string[] {
  return slugs.slice(0, PUBLIC_SEO_EMOJI_PAGE_COUNT);
}
