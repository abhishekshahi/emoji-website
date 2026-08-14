import { PRODUCTION_BASELINES } from "@/lib/master/integration/config";

/**
 * MASTER DATA = all canonical identities in the frozen master release.
 * PUBLIC SEO CATALOG = currently approved production emoji pages only.
 *
 * Storage coverage and URL coverage are intentionally separate.
 *
 * R2 layers:
 * - FULL MASTER ARCHIVE (.r2-export-full/) = complete byte-for-byte preservation
 * - OPTIMIZED APPLICATION DATA (.r2-export/) = compact runtime shards for Worker/R2
 */
export const MASTER_IDENTITY_COUNT = 6955 as const;
export const MASTER_ARTWORK_RECORD_COUNT = 40071 as const;
export const PUBLIC_SEO_EMOJI_PAGE_COUNT = PRODUCTION_BASELINES.totalSearchable;
export const PUBLIC_SITEMAP_URL_COUNT = 4522 as const;

export function isPublicSeoCatalogSlug(slug: string, approvedSlugs: ReadonlySet<string>): boolean {
  return approvedSlugs.has(slug);
}

export function filterPublicSeoCatalogSlugs(slugs: readonly string[]): string[] {
  return slugs.slice(0, PUBLIC_SEO_EMOJI_PAGE_COUNT);
}
