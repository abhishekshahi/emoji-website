import type { KaomojiCollection, KaomojiEditorialRecord } from "./types";

interface CollectionDef {
  slug: string;
  title: string;
  description: string;
  rule: string;
  match: (r: KaomojiEditorialRecord) => boolean;
  max: number;
}

const DEFS: CollectionDef[] = [
  { slug: "best-kaomoji", title: "Best Kaomoji", description: "High-quality kaomoji selected by quality and source coverage.", rule: "quality>=75 AND public", max: 200, match: (r) => r.is_public && r.quality_score >= 75 },
  { slug: "cute-kaomoji", title: "Cute Kaomoji", description: "Adorable cute and kawaii text faces.", rule: "category:cute|kawaii", max: 300, match: (r) => r.is_public && r.emojiquick_categories.some((c) => c.slug === "cute" || c.slug === "kawaii") },
  { slug: "love-kaomoji", title: "Love Kaomoji", description: "Love, heart, and romantic kaomoji.", rule: "category:love|romantic", max: 300, match: (r) => r.is_public && r.emojiquick_categories.some((c) => c.slug === "love" || c.slug === "romantic") },
  { slug: "happy-kaomoji", title: "Happy Kaomoji", description: "Happy and joyful expressions.", rule: "category:happy", max: 300, match: (r) => r.is_public && r.emojiquick_categories.some((c) => c.slug === "happy") },
  { slug: "sad-kaomoji", title: "Sad Kaomoji", description: "Sad and melancholy text faces.", rule: "category:sad|crying", max: 300, match: (r) => r.is_public && r.emojiquick_categories.some((c) => c.slug === "sad" || c.slug === "crying") },
  { slug: "funny-kaomoji", title: "Funny Kaomoji", description: "Funny and playful kaomoji.", rule: "category:funny|laughing", max: 200, match: (r) => r.is_public && r.emojiquick_categories.some((c) => c.slug === "funny" || c.slug === "laughing") },
  { slug: "angry-kaomoji", title: "Angry Kaomoji", description: "Angry and frustrated expressions.", rule: "category:angry", max: 200, match: (r) => r.is_public && r.emojiquick_categories.some((c) => c.slug === "angry") },
  { slug: "anime-kaomoji", title: "Anime Kaomoji", description: "Japanese anime-style text faces.", rule: "style:japanese|aesthetic", max: 200, match: (r) => r.is_public && r.emojiquick_categories.some((c) => c.slug === "japanese" || c.slug === "aesthetic") },
  { slug: "kawaii-kaomoji", title: "Kawaii Kaomoji", description: "Kawaii Japanese emoticons.", rule: "category:kawaii", max: 300, match: (r) => r.is_public && r.emojiquick_categories.some((c) => c.slug === "kawaii") },
  { slug: "animal-kaomoji", title: "Animal Kaomoji", description: "Cat, dog, bear, and other animal faces.", rule: "group:ANIMALS", max: 300, match: (r) => r.is_public && r.emojiquick_categories.some((c) => c.group === "ANIMALS") },
  { slug: "aesthetic-kaomoji", title: "Aesthetic Kaomoji", description: "Decorative aesthetic text faces.", rule: "category:aesthetic|decorative", max: 200, match: (r) => r.is_public && r.emojiquick_categories.some((c) => c.slug === "aesthetic" || c.slug === "decorative") },
  { slug: "japanese-kaomoji", title: "Japanese Kaomoji", description: "Classic Japanese-style kaomoji.", rule: "style:japanese", max: 300, match: (r) => r.is_public && r.emojiquick_categories.some((c) => c.slug === "japanese") },
  { slug: "classic-kaomoji", title: "Classic Kaomoji", description: "Classic text face expressions.", rule: "style:classic", max: 200, match: (r) => r.is_public && r.emojiquick_categories.some((c) => c.slug === "classic" || c.slug === "ascii") },
  { slug: "minimal-kaomoji", title: "Minimal Kaomoji", description: "Short minimal text faces.", rule: "style:minimal AND len<=8", max: 200, match: (r) => r.is_public && r.canonical_content.length <= 8 },
  { slug: "kaomoji-for-instagram", title: "Kaomoji for Instagram", description: "Copy-ready kaomoji for Instagram bios and captions.", rule: "public AND quality>=65", max: 150, match: (r) => r.is_public && r.quality_score >= 65 && r.canonical_content.length <= 30 },
  { slug: "kaomoji-for-discord", title: "Kaomoji for Discord", description: "Kaomoji for Discord messages and status.", rule: "public AND quality>=60", max: 150, match: (r) => r.is_public && r.quality_score >= 60 },
  { slug: "kaomoji-for-whatsapp", title: "Kaomoji for WhatsApp", description: "Kaomoji for WhatsApp chats.", rule: "public AND len<=20", max: 150, match: (r) => r.is_public && r.canonical_content.length <= 20 },
  { slug: "kaomoji-for-texting", title: "Kaomoji for Texting", description: "Short kaomoji for SMS and texting.", rule: "public AND len<=12", max: 150, match: (r) => r.is_public && r.canonical_content.length <= 12 },
  { slug: "kaomoji-for-friendship", title: "Kaomoji for Friendship", description: "Friendship and greeting kaomoji.", rule: "category:friendship|greeting", max: 150, match: (r) => r.is_public && r.emojiquick_categories.some((c) => c.slug === "friendship" || c.slug === "greeting") },
  { slug: "kaomoji-for-couples", title: "Kaomoji for Couples", description: "Love and romantic kaomoji for couples.", rule: "category:love|romantic|kiss|hug", max: 150, match: (r) => r.is_public && r.emojiquick_categories.some((c) => ["love", "romantic", "kiss", "hug"].includes(c.slug)) },
];

export function buildCollections(records: readonly KaomojiEditorialRecord[]): KaomojiCollection[] {
  return DEFS.map((def) => {
    const ids = records
      .filter(def.match)
      .sort((a, b) => b.quality_score - a.quality_score || b.beauty_score - a.beauty_score || a.canonical_id.localeCompare(b.canonical_id))
      .slice(0, def.max)
      .map((r) => r.canonical_id);
    return { slug: def.slug, title: def.title, description: def.description, canonical_ids: ids, rule: def.rule };
  }).filter((c) => c.canonical_ids.length > 0);
}

export const COLLECTION_DEFS = DEFS;
