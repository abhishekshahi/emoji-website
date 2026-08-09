import "server-only";

import { getArtworkPath } from "@/lib/artwork/providers";
import type { BrowsableEmoji } from "@/lib/emoji/types";
import { MASTER_INTEGRATION_CONFIG } from "../config";
import { getUiArtworkProviders } from "./artwork-ui-adapter";
import { getUiMetadataPayload } from "./metadata-ui-adapter";
import { getUiProductionArtworkProviders, getUiProductionMetadata } from "./production-bridge";
import { toUiProductionContext } from "./shared";
import type { MasterEmojiUiModel } from "./types";

export type { MasterEmojiUiModel };

export function isMasterUiEnabled(): boolean {
  return MASTER_INTEGRATION_CONFIG.masterArtworkEnabled || MASTER_INTEGRATION_CONFIG.masterMetadataEnabled;
}

export function loadMasterEmojiUiModel(emoji: BrowsableEmoji, rootDir?: string): MasterEmojiUiModel | null {
  if (!isMasterUiEnabled()) {
    return null;
  }

  const context = toUiProductionContext(emoji);
  const artworkProviders = MASTER_INTEGRATION_CONFIG.masterArtworkEnabled
    ? getUiProductionArtworkProviders(context, rootDir)
    : [];
  const metadata = MASTER_INTEGRATION_CONFIG.masterMetadataEnabled
    ? getUiProductionMetadata(context, rootDir)
    : null;

  if (artworkProviders.length === 0 && !metadata) {
    return null;
  }

  return Object.freeze({
    emoji: emoji.emoji,
    name: emoji.name,
    fallbackSrc: getArtworkPath(emoji.hexcode),
    artworkProviders,
    metadata,
  });
}

export function loadMasterEmojiUiModelByCanonicalId(
  canonicalId: string,
  emoji: string,
  name: string,
  hexcode: string,
  rootDir?: string,
): Pick<MasterEmojiUiModel, "artworkProviders" | "metadata"> | null {
  if (!isMasterUiEnabled()) {
    return null;
  }

  return Object.freeze({
    artworkProviders: MASTER_INTEGRATION_CONFIG.masterArtworkEnabled
      ? getUiArtworkProviders(canonicalId, rootDir)
      : [],
    metadata: MASTER_INTEGRATION_CONFIG.masterMetadataEnabled
      ? getUiMetadataPayload(canonicalId, rootDir)
      : null,
  });
}
