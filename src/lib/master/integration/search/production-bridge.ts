import type { BrowsableEmoji } from "@/lib/emoji/types";
import { searchEmojis, type SearchResult } from "@/lib/emoji/search";
import { MASTER_INTEGRATION_CONFIG } from "../config";
import { searchMasterIntegrated } from "./adapter";
import type { MasterSearchIntegrationResult } from "./types";

export function isMasterSearchIntegrationEnabled(): boolean {
  return MASTER_INTEGRATION_CONFIG.masterSearchEnabled;
}

function mapMasterResultToSearchResult(
  emojis: BrowsableEmoji[],
  masterResult: MasterSearchIntegrationResult,
): SearchResult | null {
  const hexcode = masterResult.productionHexcode ?? masterResult.canonicalId.replace(/^unicode:/, "");
  const emoji = emojis.find((entry) => entry.hexcode.toUpperCase() === hexcode.toUpperCase());
  if (!emoji) {
    return null;
  }

  return {
    emoji: {
      id: emoji.id,
      emoji: emoji.emoji,
      name: emoji.name,
      slug: emoji.slug,
      keywords: [...emoji.keywords],
      shortcodes: [...emoji.shortcodes],
      codePoints: [...emoji.codePoints],
      hexcode: emoji.hexcode,
      category: emoji.category,
      isExtra: masterResult.isExtra,
    },
    score: masterResult.score,
  };
}

export function searchProductionEmojis(
  emojis: BrowsableEmoji[],
  query: string,
  limit = 120,
  rootDir?: string,
): SearchResult[] {
  if (!isMasterSearchIntegrationEnabled()) {
    return searchEmojis(emojis, query, limit);
  }

  const masterResults = searchMasterIntegrated(query, rootDir, limit);
  const mapped = masterResults.results
    .map((result) => mapMasterResultToSearchResult(emojis, result))
    .filter((result): result is SearchResult => result !== null);

  if (mapped.length > 0) {
    return mapped;
  }

  return searchEmojis(emojis, query, limit);
}
