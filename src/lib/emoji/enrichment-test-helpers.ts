import compactFile from "@/data/emoji-enrichment.json";
import { getBrowsableEmojiBySlug } from "./browsable-data";
import { parseEmojiEnrichmentCompactFile } from "./enrichment-compact-types";
import { expandCompactEnrichmentFile } from "./enrichment-expand";
import type { EmojiEnrichmentFile } from "./enrichment-types";

let cachedExpanded: EmojiEnrichmentFile | null = null;

export function getTestEnrichmentFile(): EmojiEnrichmentFile {
  if (!cachedExpanded) {
    cachedExpanded = expandCompactEnrichmentFile(
      parseEmojiEnrichmentCompactFile(compactFile),
      getBrowsableEmojiBySlug,
    );
  }
  return cachedExpanded;
}