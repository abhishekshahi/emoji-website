import type { ArtworkProvider, ArtworkMasterRecord } from "@/lib/master/artwork/types";
import type { ArtworkIdentityInput, ArtworkAssetRef } from "./resolve-preferred-artwork";
import { ARTWORK_PRIORITY_ORDER } from "./provider-architecture";

export interface CanonicalArtworkRefs {
  readonly openmoji: readonly string[];
  readonly noto: readonly string[];
  readonly twemoji: readonly string[];
  readonly fluent: readonly string[];
}

export function buildArtworkIdentityInput(
  canonicalId: string,
  refs: CanonicalArtworkRefs,
  masterByArtworkId: ReadonlyMap<string, ArtworkMasterRecord>,
): ArtworkIdentityInput {
  const artwork: ArtworkIdentityInput["artwork"] = {};

  for (const provider of ARTWORK_PRIORITY_ORDER) {
    const ids = refs[provider];
    if (!ids?.length) continue;

    const assets: ArtworkAssetRef[] = [];
    for (const artworkId of ids) {
      const record = masterByArtworkId.get(artworkId);
      if (!record) continue;
      assets.push({
        sourceId: record.sourceId,
        path: record.filePath,
        format: record.format,
        variant: record.artworkVariant,
      });
    }
    if (assets.length > 0) {
      artwork[provider] = assets;
    }
  }

  return { canonicalId, artwork };
}

export function indexArtworkMasterById(
  records: readonly ArtworkMasterRecord[],
): Map<string, ArtworkMasterRecord> {
  const map = new Map<string, ArtworkMasterRecord>();
  for (const record of records) {
    map.set(record.artworkId, record);
  }
  return map;
}
