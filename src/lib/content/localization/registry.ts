import type { LocalizedEmojiContent } from "./types";
import { PRIMARY_LANGUAGE } from "./types";

const REGISTRY = new Map<string, LocalizedEmojiContent>();

function key(canonicalId: string, language: string): string {
  return `${language}:${canonicalId}`;
}

export function registerLocalizedContent(record: LocalizedEmojiContent): void {
  REGISTRY.set(key(record.canonicalId, record.language), record);
}

export function getLocalizedContent(
  canonicalId: string,
  language: string = PRIMARY_LANGUAGE,
): LocalizedEmojiContent | null {
  return REGISTRY.get(key(canonicalId, language)) ?? null;
}

export function getLocalizedContentWithFallback(
  canonicalId: string,
  language: string,
): LocalizedEmojiContent | null {
  return getLocalizedContent(canonicalId, language) ?? getLocalizedContent(canonicalId, PRIMARY_LANGUAGE);
}

export function listLocalizedRecords(): readonly LocalizedEmojiContent[] {
  return [...REGISTRY.values()];
}

export function getLanguageCompletenessReport(): Readonly<
  Record<string, { total: number; published: number }>
> {
  const report: Record<string, { total: number; published: number }> = {};
  for (const record of REGISTRY.values()) {
    const bucket = report[record.language] ?? { total: 0, published: 0 };
    bucket.total += 1;
    if (record.provenance.qualityStatus === "complete") bucket.published += 1;
    report[record.language] = bucket;
  }
  return report;
}
