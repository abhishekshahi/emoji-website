import type { EmojiEnrichmentRecord } from "./enrichment-types";
import type { RelatedEmojiGroupView } from "./emoji-page-model";
import type { BrowsableEmoji } from "./types";

const GROUP_META: Record<
  RelatedEmojiGroupView["id"],
  { title: string; description: string }
> = {
  variants: {
    title: "Variants",
    description: "Related Unicode forms of this emoji.",
  },
  semantic: {
    title: "Similar",
    description: "Emojis connected by meaning, usage, or shared concepts.",
  },
  subcategory: {
    title: "Same subcategory",
    description: "More emojis from the same Unicode subcategory.",
  },
  category: {
    title: "Same category",
    description: "More emojis from the same top-level category.",
  },
};

function resolveEmojis(
  slugs: readonly string[],
  resolveEmoji: (slug: string) => BrowsableEmoji | undefined,
): BrowsableEmoji[] {
  const emojis: BrowsableEmoji[] = [];
  const seen = new Set<string>();

  for (const slug of slugs) {
    if (seen.has(slug)) continue;
    const emoji = resolveEmoji(slug);
    if (!emoji) continue;
    seen.add(slug);
    emojis.push(emoji);
  }

  return emojis;
}

function pushGroup(
  groups: RelatedEmojiGroupView[],
  id: RelatedEmojiGroupView["id"],
  emojis: BrowsableEmoji[],
  minSize = 2,
): void {
  if (emojis.length < minSize) {
    return;
  }

  const meta = GROUP_META[id];
  groups.push({
    id,
    title: meta.title,
    description: meta.description,
    emojis: emojis.slice(0, 12),
  });
}

export function buildRelatedEmojiGroups(
  emoji: BrowsableEmoji,
  enrichment: EmojiEnrichmentRecord | null,
  categoryRelated: readonly BrowsableEmoji[],
  resolveEmoji: (slug: string) => BrowsableEmoji | undefined,
  limitPerGroup = 10,
): RelatedEmojiGroupView[] {
  const groups: RelatedEmojiGroupView[] = [];
  const usedSlugs = new Set<string>([emoji.slug]);

  for (const variant of enrichment?.variants ?? []) {
    usedSlugs.add(variant.slug);
  }

  const semanticEmojis = resolveEmojis(
    (enrichment?.related ?? [])
      .filter((related) => related.reason === "semantic")
      .map((related) => related.slug),
    resolveEmoji,
  ).filter((entry) => {
    if (usedSlugs.has(entry.slug)) return false;
    usedSlugs.add(entry.slug);
    return true;
  });
  pushGroup(groups, "semantic", semanticEmojis.slice(0, limitPerGroup));

  const subcategoryEmojis = resolveEmojis(
    (enrichment?.related ?? [])
      .filter((related) => related.reason === "subcategory")
      .map((related) => related.slug),
    resolveEmoji,
  ).filter((entry) => {
    if (usedSlugs.has(entry.slug)) return false;
    usedSlugs.add(entry.slug);
    return true;
  });
  pushGroup(groups, "subcategory", subcategoryEmojis.slice(0, limitPerGroup));

  const categoryEmojis = categoryRelated.filter((entry) => {
    if (usedSlugs.has(entry.slug)) return false;
    usedSlugs.add(entry.slug);
    return true;
  });
  pushGroup(groups, "category", categoryEmojis.slice(0, limitPerGroup));

  return groups;
}
