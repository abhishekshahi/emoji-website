export const CLIENT_ARTWORK_PROVIDERS = ["openmoji", "noto", "twemoji", "fluent"] as const;

export type ClientArtworkProvider = (typeof CLIENT_ARTWORK_PROVIDERS)[number];

export type {
  ArtworkAttributionInfo,
  UiArtworkProviderOption,
  UiArtworkVariantOption,
  UiMetadataPayload,
  UiProductionContext,
  UiSourceMetadataPanel,
} from "./types";
