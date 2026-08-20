import type { TaxonomyCategory } from "./types";

export function buildSourceKeywords(sourceCategories: readonly string[]): string[] {
  return [...new Set(sourceCategories.map((c) => c.toLowerCase().trim()).filter(Boolean))].sort();
}

export function buildEmojiquickKeywords(
  content: string,
  categories: readonly TaxonomyCategory[],
  sourceKeywords: readonly string[],
): string[] {
  const keywords = new Set<string>();
  for (const c of categories) {
    keywords.add(c.slug);
    keywords.add(c.label.toLowerCase());
    keywords.add(c.group.toLowerCase().replace(/_/g, " "));
  }
  for (const sk of sourceKeywords) {
    if (sk.length >= 2 && sk.length <= 32 && !/^(slug|root|direct|null)$/i.test(sk)) keywords.add(sk);
  }
  if (/[♥♡❤]/u.test(content)) keywords.add("heart");
  if (/[｡◕‿◕｡]/u.test(content)) keywords.add("kawaii");
  if (/\(.*?[_^].*?\)/.test(content)) keywords.add("text face");
  keywords.add("kaomoji");
  return [...keywords].sort();
}

export const SEARCH_INTENT_TERMS = [
  "cute", "love", "kawaii", "happy", "sad", "angry", "crying", "laughing",
  "cat", "dog", "hug", "kiss", "sorry", "thank you", "friendship", "shy", "blush",
  "anime", "aesthetic", "funny", "beautiful", "girlfriend", "boyfriend",
  "instagram", "discord", "whatsapp",
] as const;

export function tokenizeForSearch(text: string): string[] {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s+-]/gu, " ").split(/\s+/).map((t) => t.trim()).filter((t) => t.length >= 2);
}
