export const KAOMOJI_SEARCH_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600" as const;
export const KAOMOJI_DETAIL_CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400" as const;
export const KAOMOJI_COLLECTIONS_CACHE_CONTROL = "public, s-maxage=1800, stale-while-revalidate=3600" as const;

export function kaomojiSearchCacheHeaders(): Record<string, string> {
  return { "Cache-Control": KAOMOJI_SEARCH_CACHE_CONTROL };
}

export function kaomojiDetailCacheHeaders(): Record<string, string> {
  return { "Cache-Control": KAOMOJI_DETAIL_CACHE_CONTROL };
}

export function kaomojiCollectionsCacheHeaders(): Record<string, string> {
  return { "Cache-Control": KAOMOJI_COLLECTIONS_CACHE_CONTROL };
}
