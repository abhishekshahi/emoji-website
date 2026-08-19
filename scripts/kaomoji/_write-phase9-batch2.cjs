const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const dir = path.join(root, "src/lib/kaomoji/processing/phase9");

function w(name, content) {
  fs.writeFileSync(path.join(dir, name), content, "utf8");
  console.log("wrote", name);
}

w("relationships.ts", `import type { KaomojiEditorialRecord, KaomojiRelationship } from "./types";

const OPPOSITE: Record<string, string> = {
  happy: "sad",
  sad: "happy",
  angry: "calm",
  love: "angry",
  crying: "laughing",
  laughing: "crying",
};

export function buildRelationships(records: readonly KaomojiEditorialRecord[]): KaomojiRelationship[] {
  const byCategory = new Map<string, KaomojiEditorialRecord[]>();
  const byVariant = new Map<string, KaomojiEditorialRecord[]>();
  const byId = new Map(records.map((r) => [r.canonical_id, r]));
  const rels: KaomojiRelationship[] = [];
  const seen = new Set<string>();

  for (const r of records) {
    if (!r.is_public) continue;
    const cat = r.emojiquick_categories[0]?.slug;
    if (cat) {
      const list = byCategory.get(cat) ?? [];
      list.push(r);
      byCategory.set(cat, list);
    }
    if (r.variant_group_id) {
      const list = byVariant.get(r.variant_group_id) ?? [];
      list.push(r);
      byVariant.set(r.variant_group_id, list);
    }
  }

  function add(from: string, to: string, type: KaomojiRelationship["relationship_type"], confidence: "high" | "medium" | "low", score: number) {
    if (from === to) return;
    const key = \`\${from}:\${to}:\${type}\`;
    if (seen.has(key)) return;
    seen.add(key);
    rels.push({ from_canonical_id: from, to_canonical_id: to, relationship_type: type, confidence, score });
  }

  for (const [vgId, members] of byVariant) {
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length && j < i + 6; j++) {
        add(members[i]!.canonical_id, members[j]!.canonical_id, "variant", "high", 90);
      }
    }
  }

  for (const r of records) {
    if (!r.is_public) continue;
    const cat = r.emojiquick_categories[0]?.slug;
    if (!cat) continue;
    const peers = (byCategory.get(cat) ?? [])
      .filter((p) => p.canonical_id !== r.canonical_id)
      .sort((a, b) => b.quality_score - a.quality_score || a.canonical_id.localeCompare(b.canonical_id))
      .slice(0, 6);
    for (const p of peers) {
      add(r.canonical_id, p.canonical_id, "same_category", "medium", 70 + Math.min(20, p.quality_score / 5));
    }
    const opposite = OPPOSITE[cat];
    if (opposite) {
      const opp = (byCategory.get(opposite) ?? [])[0];
      if (opp) add(r.canonical_id, opp.canonical_id, "opposite_emotion", "low", 50);
    }
    if (r.duplicate_group_id) {
      for (const p of peers.slice(0, 2)) add(r.canonical_id, p.canonical_id, "alternative", "medium", 60);
    }
  }

  return rels.sort((a, b) => a.from_canonical_id.localeCompare(b.from_canonical_id));
}

export function relatedForRecord(rels: readonly KaomojiRelationship[], canonicalId: string, limit = 8): KaomojiRelationship[] {
  return rels.filter((r) => r.from_canonical_id === canonicalId).slice(0, limit);
}
`);

w("collections.ts", `import type { KaomojiCollection, KaomojiEditorialRecord } from "./types";

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
`);

w("search-quality.ts", `import type { SearchQualityCase } from "./types";

export const SEARCH_QUALITY_DATASET: readonly SearchQualityCase[] = [
  { query: "cute", kind: "exact", expected_slugs: [], min_results: 5 },
  { query: "love", kind: "exact", expected_slugs: [], min_results: 5 },
  { query: "kawaii", kind: "exact", expected_slugs: [], min_results: 3 },
  { query: "happy", kind: "exact", expected_slugs: [], min_results: 5 },
  { query: "sad", kind: "exact", expected_slugs: [], min_results: 5 },
  { query: "angry", kind: "exact", expected_slugs: [], min_results: 3 },
  { query: "crying", kind: "partial", expected_slugs: [], min_results: 3 },
  { query: "laughing", kind: "partial", expected_slugs: [], min_results: 3 },
  { query: "cat", kind: "exact", expected_slugs: [], min_results: 3 },
  { query: "dog", kind: "exact", expected_slugs: [], min_results: 2 },
  { query: "hug", kind: "exact", expected_slugs: [], min_results: 2 },
  { query: "kiss", kind: "exact", expected_slugs: [], min_results: 2 },
  { query: "sorry", kind: "exact", expected_slugs: [], min_results: 2 },
  { query: "thank you", kind: "natural", expected_slugs: [], min_results: 2 },
  { query: "friendship", kind: "natural", expected_slugs: [], min_results: 2 },
  { query: "anime", kind: "category", expected_slugs: [], min_results: 3 },
  { query: "aesthetic", kind: "category", expected_slugs: [], min_results: 2 },
  { query: "funny", kind: "exact", expected_slugs: [], min_results: 3 },
  { query: "shy", kind: "exact", expected_slugs: [], min_results: 2 },
  { query: "blush", kind: "misspelling", expected_slugs: [], min_results: 2 },
  { query: "cute kaomoji", kind: "natural", expected_slugs: [], min_results: 5 },
  { query: "love kaomoji", kind: "natural", expected_slugs: [], min_results: 5 },
  { query: "kaomoji for girlfriend", kind: "natural", expected_slugs: [], min_results: 2 },
  { query: "kaomoji for boyfriend", kind: "natural", expected_slugs: [], min_results: 2 },
  { query: "happy kaomoji", kind: "natural", expected_slugs: [], min_results: 5 },
  { query: "sad face", kind: "natural", expected_slugs: [], min_results: 3 },
  { query: "angry face", kind: "natural", expected_slugs: [], min_results: 2 },
  { query: "cute cat", kind: "natural", expected_slugs: [], min_results: 2 },
  { query: "instagram", kind: "category", expected_slugs: [], min_results: 1 },
  { query: "discord", kind: "category", expected_slugs: [], min_results: 1 },
  { query: "whatsapp", kind: "category", expected_slugs: [], min_results: 1 },
  { query: "(｡♥‿♥｡)", kind: "character", expected_slugs: [], min_results: 1 },
];
`);

console.log("wrote batch 2");
