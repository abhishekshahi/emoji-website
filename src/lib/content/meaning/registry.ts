import type { EmojiMeaningRecord } from "./types";
import { registerMediumMeanings } from "./medium-data";
import { registerPriorityMeanings } from "./priority-data";
import { registerRichEnhancements } from "./rich-enhancements";

const MEANINGS = new Map<string, EmojiMeaningRecord>();

function key(canonicalId: string, language: string): string {
  return `${language}:${canonicalId}`;
}

export function registerMeaning(record: EmojiMeaningRecord): void {
  MEANINGS.set(key(record.canonicalId, record.language), record);
}

export function getMeaning(canonicalId: string, language = "en"): EmojiMeaningRecord | null {
  return MEANINGS.get(key(canonicalId, language)) ?? null;
}

export function getMeaningBySlug(slug: string, language = "en"): EmojiMeaningRecord | null {
  for (const record of MEANINGS.values()) {
    if (record.slug === slug && record.language === language) return record;
  }
  return null;
}

export function listMeanings(): readonly EmojiMeaningRecord[] {
  return [...MEANINGS.values()];
}

/** Seed editorial meaning content — clearly labeled as EmojiQuick editorial, not Unicode official. */
export function bootstrapMeaningContent(): void {
  if (MEANINGS.size > 0) return;

  const now = new Date().toISOString();
  const base = {
    language: "en" as const,
    provenance: {
      source: "editorial" as const,
      author: "EmojiQuick Editorial",
      lastUpdated: now,
      qualityStatus: "partial" as const,
    },
  };

  registerPriorityMeanings(registerMeaning, base);
  registerMediumMeanings(registerMeaning, base);
  registerRichEnhancements(registerMeaning, base);
}

bootstrapMeaningContent();
