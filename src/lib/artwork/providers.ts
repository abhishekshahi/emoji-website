import preferredArtworkUrls from "@/data/emoji-preferred-artwork-urls.json";
import { getOpenMojiArtworkPath } from "@/lib/artwork/openmoji";

export interface ArtworkProvider {
  id: string;
  name: string;
  license: string;
  getPath: (hexcode: string) => string | null;
}

export const OPENMOJI_PROVIDER_ID = "openmoji";

const PREFERRED_URL_MAP = preferredArtworkUrls as Record<string, string>;

export const openMojiProvider: ArtworkProvider = {
  id: OPENMOJI_PROVIDER_ID,
  name: "OpenMoji",
  license: "CC BY-SA 4.0",
  getPath: getOpenMojiArtworkPath,
};

const ARTWORK_PROVIDERS: Record<string, ArtworkProvider> = {
  [OPENMOJI_PROVIDER_ID]: openMojiProvider,
};

export const DEFAULT_ARTWORK_PROVIDER_ID = OPENMOJI_PROVIDER_ID;

export function getArtworkProvider(
  providerId: string = DEFAULT_ARTWORK_PROVIDER_ID,
): ArtworkProvider | null {
  return ARTWORK_PROVIDERS[providerId] ?? null;
}

/** Client-safe preferred artwork URL (Noto → Fluent → OpenMoji → Twemoji at build time). */
export function getArtworkPath(
  hexcode: string,
  providerId: string = DEFAULT_ARTWORK_PROVIDER_ID,
): string | null {
  const normalized = hexcode.toUpperCase();
  const preferred = PREFERRED_URL_MAP[normalized];
  if (preferred) return preferred;

  return getArtworkProvider(providerId)?.getPath(hexcode) ?? null;
}

export function listArtworkProviders(): ArtworkProvider[] {
  return Object.values(ARTWORK_PROVIDERS);
}
