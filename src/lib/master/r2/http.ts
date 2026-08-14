export const R2_ARTWORK_CACHE_CONTROL = "public, max-age=31536000, immutable" as const;
export const R2_METADATA_CACHE_CONTROL = "public, max-age=3600, stale-while-revalidate=86400" as const;
export const R2_API_DISABLED_CACHE_CONTROL = "no-store" as const;

export function artworkResponseHeaders(contentType: string, publiclyServed: boolean): HeadersInit {
  return {
    "Content-Type": contentType,
    "Cache-Control": publiclyServed ? R2_ARTWORK_CACHE_CONTROL : "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; img-src 'self'",
  };
}

export function jsonResponseHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": R2_METADATA_CACHE_CONTROL,
  };
}
