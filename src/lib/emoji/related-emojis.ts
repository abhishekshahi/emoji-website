import "server-only";

import { getBrowsableEmojiBySlug, getRelatedBrowsableEmojis } from "./browsable-data";
import { getEmojiEnrichmentBySlug } from "./enrichment";
import { buildRelatedEmojiGroups } from "./related-emojis-core";
import type { BrowsableEmoji } from "./types";

export function getEnrichedRelatedEmojiGroups(
  emoji: BrowsableEmoji,
  limitPerGroup = 12,
) {
  const enrichment = getEmojiEnrichmentBySlug(emoji.slug);
  const categoryRelated = getRelatedBrowsableEmojis(emoji, limitPerGroup * 2);

  return buildRelatedEmojiGroups(
    emoji,
    enrichment,
    categoryRelated,
    getBrowsableEmojiBySlug,
    limitPerGroup,
  );
}

export function getEnrichedRelatedBrowsableEmojis(
  emoji: BrowsableEmoji,
  limit = 16,
): BrowsableEmoji[] {
  const merged: BrowsableEmoji[] = [];
  const seen = new Set<string>([emoji.slug]);

  for (const group of getEnrichedRelatedEmojiGroups(emoji)) {
    for (const entry of group.emojis) {
      if (seen.has(entry.slug)) continue;
      seen.add(entry.slug);
      merged.push(entry);
      if (merged.length >= limit) {
        return merged;
      }
    }
  }

  return merged;
}
