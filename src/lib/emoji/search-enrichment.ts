import searchEnrichmentFile from "@/data/emoji-search-enrichment.json";
import type { EmojiSearchEnrichmentFile } from "./enrichment-types";

const searchEnrichment = searchEnrichmentFile as EmojiSearchEnrichmentFile;

let cachedTerms: Readonly<Record<string, readonly string[]>> | null = null;

export function getEmojiSearchEnrichmentById(emojiId: string): readonly string[] {
  return searchEnrichment.byId[emojiId] ?? [];
}

export function getAllEmojiSearchEnrichmentById(): Readonly<Record<string, readonly string[]>> {
  if (!cachedTerms) {
    cachedTerms = searchEnrichment.byId;
  }
  return cachedTerms;
}

export function getEmojiSearchEnrichmentStats(): Pick<
  EmojiSearchEnrichmentFile,
  "generatedAt" | "releaseId" | "recordCount"
> {
  return {
    generatedAt: searchEnrichment.generatedAt,
    releaseId: searchEnrichment.releaseId,
    recordCount: searchEnrichment.recordCount,
  };
}
