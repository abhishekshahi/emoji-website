import type { R2ArtworkKeyEntry, R2IdentityRecord, R2Manifest } from "../types";
import type { ArtworkProvider } from "@/lib/master/artwork/types";

export interface MasterDataProvider {
  getManifest(): Promise<R2Manifest | null>;
  getIdentity(canonicalId: string): Promise<R2IdentityRecord | null>;
  getArtworkKey(artworkId: string): Promise<R2ArtworkKeyEntry | null>;
  getArtworkBytes(storageKey: string): Promise<Uint8Array | null>;
  listArtworkKeysForCanonical(canonicalId: string): Promise<readonly R2ArtworkKeyEntry[]>;
  isArtworkKeyAllowed(storageKey: string): Promise<boolean>;
}

export interface MasterDataProviderContext {
  readonly exportRootDir: string;
}

export function isArtworkProvider(value: string): value is ArtworkProvider {
  return value === "openmoji" || value === "noto" || value === "twemoji" || value === "fluent";
}
