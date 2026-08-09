import type { BrowsableEmoji } from "@/lib/emoji/types";
import { createEmojiPageMetadata } from "@/lib/seo/metadata";
import { getOpenMojiArtworkPath } from "@/lib/artwork/openmoji";
import { MASTER_INTEGRATION_CONFIG } from "../config";
import { buildProductionSeoLookup } from "./enrichment";
import type { ProductionSeoLookup } from "./types";

export function isMasterSeoIntegrationEnabled(): boolean {
  return MASTER_INTEGRATION_CONFIG.masterSEOEnabled;
}

export function getProductionSEO(
  canonicalId: string,
  rootDir?: string,
): ProductionSeoLookup | null {
  if (!isMasterSeoIntegrationEnabled()) {
    return null;
  }

  return buildProductionSeoLookup(canonicalId, rootDir);
}

export function getProductionSEOByEmoji(
  emoji: BrowsableEmoji,
  canonicalId: string,
  rootDir?: string,
): ProductionSeoLookup | null {
  if (!isMasterSeoIntegrationEnabled()) {
    return null;
  }

  return buildProductionSeoLookup(canonicalId, rootDir);
}

export function getExistingProductionPageMetadata(emoji: BrowsableEmoji) {
  return createEmojiPageMetadata({
    name: emoji.name,
    emoji: emoji.emoji,
    slug: emoji.slug,
    keywords: emoji.keywords,
    codePointString: emoji.codePointString,
    artworkPath: getOpenMojiArtworkPath(emoji.hexcode),
  });
}
