import { getOpenMojiArtworkPath } from "@/lib/artwork/openmoji";

export interface ArtworkProvider {
  id: string;
  name: string;
  license: string;
  getPath: (hexcode: string) => string | null;
}

export const OPENMOJI_PROVIDER_ID = "openmoji";

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

export function getArtworkPath(
  hexcode: string,
  providerId: string = DEFAULT_ARTWORK_PROVIDER_ID,
): string | null {
  return getArtworkProvider(providerId)?.getPath(hexcode) ?? null;
}

export function listArtworkProviders(): ArtworkProvider[] {
  return Object.values(ARTWORK_PROVIDERS);
}
