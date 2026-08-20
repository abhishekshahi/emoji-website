import "server-only";

import { getArtworkPath } from "@/lib/artwork/providers";
import type { BrowsableEmoji } from "@/lib/emoji/types";
import { MASTER_INTEGRATION_CONFIG } from "../config";
import { resolveProductionCanonicalId } from "../production-map";
import {
  getEmojiMasterBundle,
  isR2MetadataBackendActive,
  mapSearchRecordToUiFields,
} from "@/lib/r2";
import { getUiArtworkProviders } from "./artwork-ui-adapter";
import { getUiMetadataPayload } from "./metadata-ui-adapter";
import { getUiProductionArtworkProviders, getUiProductionMetadata } from "./production-bridge";
import { toUiProductionContext } from "./shared";
import type { MasterEmojiUiModel, UiArtworkProviderOption, UiMetadataPayload } from "./types";

export type { MasterEmojiUiModel };

export function isMasterUiEnabled(): boolean {
  return MASTER_INTEGRATION_CONFIG.masterArtworkEnabled || MASTER_INTEGRATION_CONFIG.masterMetadataEnabled;
}

async function loadR2MetadataPayload(
  canonicalId: string,
  emoji: BrowsableEmoji,
  rootDir?: string,
): Promise<UiMetadataPayload | null> {
  try {
    const bundle = await getEmojiMasterBundle(canonicalId);
    if (!bundle?.search) {
      return getUiMetadataPayload(canonicalId, rootDir);
    }

    const mapped = mapSearchRecordToUiFields(bundle.search);
    if (!mapped) {
      return getUiMetadataPayload(canonicalId, rootDir);
    }

    return Object.freeze({
      canonicalId,
      canonicalName: mapped.canonicalName,
      emoji: bundle.search.emoji ?? emoji.emoji,
      safeKeywords: Object.freeze(mapped.safeKeywords),
      safeAliases: Object.freeze(mapped.safeAliases),
      shortcodes: Object.freeze(mapped.shortcodes),
      sourcePanels: Object.freeze([]),
    });
  } catch {
    return getUiMetadataPayload(canonicalId, rootDir);
  }
}

export async function loadMasterEmojiUiModel(
  emoji: BrowsableEmoji,
  rootDir?: string,
): Promise<MasterEmojiUiModel | null> {
  if (!isMasterUiEnabled()) {
    return null;
  }

  const context = toUiProductionContext(emoji);
  const canonicalId = resolveProductionCanonicalId(context.hexcode, context.productionType, rootDir);

  let artworkProviders: readonly UiArtworkProviderOption[] = [];
  if (MASTER_INTEGRATION_CONFIG.masterArtworkEnabled) {
    try {
      artworkProviders = getUiProductionArtworkProviders(context, rootDir);
    } catch {
      artworkProviders = Object.freeze([]);
    }
  }

  let metadata: UiMetadataPayload | null = null;
  if (MASTER_INTEGRATION_CONFIG.masterMetadataEnabled) {
    try {
      metadata = isR2MetadataBackendActive()
        ? await loadR2MetadataPayload(canonicalId, emoji, rootDir)
        : getUiProductionMetadata(context, rootDir);
    } catch {
      metadata = null;
    }
  }

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

export function loadMasterEmojiUiModelSync(emoji: BrowsableEmoji, rootDir?: string): MasterEmojiUiModel | null {
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
