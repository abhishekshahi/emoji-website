import type { ArtworkProvider } from "@/lib/master/artwork/types";

const SOURCE_ID_HAS_EXTENSION = /\.(svg|png|webp|gif|jpg|jpeg)$/i;

/** Build a public artwork API path without duplicating file extensions in sourceId. */
export function buildPublicArtworkApiUrl(
  provider: ArtworkProvider,
  sourceId: string,
  format?: string,
): string {
  if (SOURCE_ID_HAS_EXTENSION.test(sourceId)) {
    return `/api/artwork/${provider}/${sourceId}`;
  }

  const ext = (format ?? "svg").toLowerCase();
  return `/api/artwork/${provider}/${sourceId}.${ext}`;
}
