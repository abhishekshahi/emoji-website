import { EMOJIQUICK_TAXONOMY, getTaxonomyBySlug, TAXONOMY_GROUPS } from "../processing/phase9/taxonomy";
import type { TaxonomyCategory } from "../processing/phase9/types";

/** Minimum public records required before an intent page is indexable. */
export const MIN_INTENT_PAGE_RECORDS = 10 as const;

/** Curated high-value intent slugs — taxonomy-backed, not mass-generated. */
export const CURATED_INTENT_SLUGS = [
  "happy",
  "cute",
  "love",
  "sad",
  "hug",
  "angry",
  "funny",
  "shy",
  "thinking",
  "sleepy",
  "kawaii",
  "cat",
  "dog",
  "crying",
  "laughing",
  "kiss",
  "sorry",
  "friendship",
  "aesthetic",
  "japanese",
  "ascii",
] as const;

export type CuratedIntentSlug = (typeof CURATED_INTENT_SLUGS)[number];

const INTENT_SET = new Set<string>(CURATED_INTENT_SLUGS);

/** Detail record slugs always use kao- prefix — intent slugs are plain taxonomy words. */
export const KAOMOJI_DETAIL_SLUG_RE = /^kao-[a-f0-9]{16}$/i;

export function isKaomojiDetailSlug(slug: string): boolean {
  return KAOMOJI_DETAIL_SLUG_RE.test(slug);
}

export function isCuratedIntentSlug(slug: string): slug is CuratedIntentSlug {
  return INTENT_SET.has(slug);
}

export function resolveIntentTaxonomy(slug: string): TaxonomyCategory | undefined {
  if (!isCuratedIntentSlug(slug)) return undefined;
  return getTaxonomyBySlug(slug);
}

export function listCuratedIntentCategories(): readonly TaxonomyCategory[] {
  return CURATED_INTENT_SLUGS.map((s) => getTaxonomyBySlug(s)).filter((t): t is TaxonomyCategory => Boolean(t));
}

export function relatedIntentSlugs(slug: string, limit = 6): string[] {
  const cat = getTaxonomyBySlug(slug);
  if (!cat) return [];
  return EMOJIQUICK_TAXONOMY.filter((t) => t.group === cat.group && t.slug !== slug && INTENT_SET.has(t.slug))
    .slice(0, limit)
    .map((t) => t.slug);
}

export function groupLabel(group: string): string {
  return group.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildIntentPageTitle(label: string): string {
  return `${label} Kaomoji — Copy & Paste Text Faces`;
}

export function buildIntentPageDescription(label: string, count: number): string {
  const n = count.toLocaleString();
  return `Browse ${n} ${label.toLowerCase()} kaomoji (Japanese text faces). One-click copy for messages, social media, and chats.`;
}

export function buildIntentIntro(category: TaxonomyCategory, count: number): string {
  const label = category.label.toLowerCase();
  const group = groupLabel(category.group).toLowerCase();
  return `${count.toLocaleString()} ${label} kaomoji to copy and paste. These text faces are grouped under ${group} on EmojiQuick — curated from public records with editorial quality scoring. Use them in messages, captions, Discord, WhatsApp, and social posts when you want a ${label} tone without images or stickers.`;
}

export function buildIntentFaq(category: TaxonomyCategory): readonly { question: string; answer: string }[] {
  const label = category.label.toLowerCase();
  return [
    {
      question: "What is a kaomoji?",
      answer:
        "A kaomoji (顔文字) is a Japanese-style emoticon made from keyboard characters — for example (◕‿◕) or (´･ω･`). EmojiQuick lets you copy them in one click.",
    },
    {
      question: `What does a ${label} kaomoji mean?`,
      answer: `A ${label} kaomoji expresses a ${label} mood or tone in text. The exact face varies, but the category reflects how EmojiQuick classifies public kaomoji by emotion, style, or theme.`,
    },
    {
      question: "How do I copy a kaomoji?",
      answer: "Tap Copy on any card. The exact Unicode text is copied to your clipboard — not a link or image.",
    },
    {
      question: `When should I use ${label} kaomoji?`,
      answer: `Use ${label} kaomoji when your message needs a ${label} tone in chat, comments, bios, or captions. Pick a shorter face for SMS and a longer decorative one for social posts.`,
    },
  ];
}
