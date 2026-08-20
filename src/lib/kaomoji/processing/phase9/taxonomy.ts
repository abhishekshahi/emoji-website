import type { TaxonomyCategory } from "./types";

export const TAXONOMY_GROUPS = [
  "EMOTION",
  "LOVE_RELATIONSHIP",
  "CUTE_KAWAII",
  "ANIMALS",
  "ACTIONS",
  "STYLE",
] as const;

/** EmojiQuick-owned taxonomy — not a copy of source categories. */
export const EMOJIQUICK_TAXONOMY: readonly TaxonomyCategory[] = [
  { group: "EMOTION", label: "Happy", slug: "happy" },
  { group: "EMOTION", label: "Sad", slug: "sad" },
  { group: "EMOTION", label: "Angry", slug: "angry" },
  { group: "EMOTION", label: "Crying", slug: "crying" },
  { group: "EMOTION", label: "Laughing", slug: "laughing" },
  { group: "EMOTION", label: "Excited", slug: "excited" },
  { group: "EMOTION", label: "Surprised", slug: "surprised" },
  { group: "EMOTION", label: "Scared", slug: "scared" },
  { group: "EMOTION", label: "Confused", slug: "confused" },
  { group: "EMOTION", label: "Worried", slug: "worried" },
  { group: "EMOTION", label: "Embarrassed", slug: "embarrassed" },
  { group: "EMOTION", label: "Shy", slug: "shy" },
  { group: "EMOTION", label: "Blushing", slug: "blushing" },
  { group: "EMOTION", label: "Tired", slug: "tired" },
  { group: "EMOTION", label: "Sleepy", slug: "sleepy" },
  { group: "EMOTION", label: "Bored", slug: "bored" },
  { group: "EMOTION", label: "Shocked", slug: "shocked" },
  { group: "EMOTION", label: "Disappointed", slug: "disappointed" },
  { group: "EMOTION", label: "Proud", slug: "proud" },
  { group: "LOVE_RELATIONSHIP", label: "Love", slug: "love" },
  { group: "LOVE_RELATIONSHIP", label: "Romantic", slug: "romantic" },
  { group: "LOVE_RELATIONSHIP", label: "Kiss", slug: "kiss" },
  { group: "LOVE_RELATIONSHIP", label: "Hug", slug: "hug" },
  { group: "LOVE_RELATIONSHIP", label: "Flirty", slug: "flirty" },
  { group: "LOVE_RELATIONSHIP", label: "Crush", slug: "crush" },
  { group: "LOVE_RELATIONSHIP", label: "Friendship", slug: "friendship" },
  { group: "LOVE_RELATIONSHIP", label: "Thank You", slug: "thank-you" },
  { group: "LOVE_RELATIONSHIP", label: "Sorry", slug: "sorry" },
  { group: "LOVE_RELATIONSHIP", label: "Greeting", slug: "greeting" },
  { group: "LOVE_RELATIONSHIP", label: "Goodbye", slug: "goodbye" },
  { group: "CUTE_KAWAII", label: "Cute", slug: "cute" },
  { group: "CUTE_KAWAII", label: "Kawaii", slug: "kawaii" },
  { group: "CUTE_KAWAII", label: "Adorable", slug: "adorable" },
  { group: "CUTE_KAWAII", label: "Sweet", slug: "sweet" },
  { group: "CUTE_KAWAII", label: "Baby", slug: "baby" },
  { group: "ANIMALS", label: "Cat", slug: "cat" },
  { group: "ANIMALS", label: "Dog", slug: "dog" },
  { group: "ANIMALS", label: "Bear", slug: "bear" },
  { group: "ANIMALS", label: "Bunny", slug: "bunny" },
  { group: "ANIMALS", label: "Bird", slug: "bird" },
  { group: "ANIMALS", label: "Fox", slug: "fox" },
  { group: "ANIMALS", label: "Wolf", slug: "wolf" },
  { group: "ANIMALS", label: "Mouse", slug: "mouse" },
  { group: "ANIMALS", label: "Pig", slug: "pig" },
  { group: "ANIMALS", label: "Other Animals", slug: "other-animals" },
  { group: "ACTIONS", label: "Shrug", slug: "shrug" },
  { group: "ACTIONS", label: "Facepalm", slug: "facepalm" },
  { group: "ACTIONS", label: "Fighting", slug: "fighting" },
  { group: "ACTIONS", label: "Dancing", slug: "dancing" },
  { group: "ACTIONS", label: "Sleeping", slug: "sleeping" },
  { group: "ACTIONS", label: "Running", slug: "running" },
  { group: "ACTIONS", label: "Waving", slug: "waving" },
  { group: "ACTIONS", label: "Thinking", slug: "thinking" },
  { group: "STYLE", label: "Classic", slug: "classic" },
  { group: "STYLE", label: "Minimal", slug: "minimal" },
  { group: "STYLE", label: "Decorative", slug: "decorative" },
  { group: "STYLE", label: "Aesthetic", slug: "aesthetic" },
  { group: "STYLE", label: "Funny", slug: "funny" },
  { group: "STYLE", label: "Extreme", slug: "extreme" },
  { group: "STYLE", label: "ASCII", slug: "ascii" },
  { group: "STYLE", label: "Japanese", slug: "japanese" },
  { group: "STYLE", label: "Western", slug: "western" },
  { group: "STYLE", label: "Unicode", slug: "unicode" },
];

const TAXONOMY_BY_SLUG = new Map(EMOJIQUICK_TAXONOMY.map((t) => [t.slug, t]));

/** Deterministic source-category → EmojiQuick taxonomy mapping. */
const SOURCE_CATEGORY_MAP: Record<string, readonly string[]> = {
  joy: ["happy", "cute"],
  happy: ["happy"],
  happiness: ["happy"],
  smile: ["happy"],
  laughing: ["laughing", "happy"],
  laugh: ["laughing"],
  lol: ["laughing", "funny"],
  funny: ["funny"],
  sad: ["sad", "crying"],
  cry: ["crying", "sad"],
  crying: ["crying"],
  tear: ["crying"],
  angry: ["angry"],
  rage: ["angry"],
  mad: ["angry"],
  love: ["love", "romantic", "cute"],
  heart: ["love", "romantic"],
  hearts: ["love"],
  romantic: ["romantic", "love"],
  romance: ["romantic"],
  kiss: ["kiss", "love"],
  hug: ["hug", "love"],
  cute: ["cute", "kawaii"],
  kawaii: ["kawaii", "cute"],
  adorable: ["adorable", "cute"],
  sweet: ["sweet", "cute"],
  shy: ["shy", "blushing"],
  blush: ["blushing", "shy"],
  blushing: ["blushing"],
  cat: ["cat", "cute"],
  neko: ["cat"],
  dog: ["dog"],
  bear: ["bear", "cute"],
  bunny: ["bunny", "cute"],
  rabbit: ["bunny"],
  bird: ["bird"],
  fox: ["fox"],
  wolf: ["wolf"],
  mouse: ["mouse"],
  pig: ["pig"],
  animal: ["other-animals"],
  animals: ["other-animals"],
  shrug: ["shrug"],
  facepalm: ["facepalm"],
  fight: ["fighting"],
  fighting: ["fighting"],
  dance: ["dancing"],
  dancing: ["dancing"],
  sleep: ["sleepy", "sleeping"],
  sleepy: ["sleepy"],
  tired: ["tired"],
  bored: ["bored"],
  wave: ["waving", "greeting"],
  greeting: ["greeting"],
  hello: ["greeting"],
  goodbye: ["goodbye"],
  bye: ["goodbye"],
  sorry: ["sorry"],
  thank: ["thank-you"],
  thanks: ["thank-you"],
  friendship: ["friendship"],
  friend: ["friendship"],
  friendhip: ["friendship"],
  flirty: ["flirty"],
  crush: ["crush", "love"],
  excited: ["excited"],
  surprise: ["surprised"],
  surprised: ["surprised"],
  scared: ["scared"],
  fear: ["scared"],
  confused: ["confused"],
  worried: ["worried"],
  embarrassed: ["embarrassed"],
  shocked: ["shocked"],
  disappointed: ["disappointed"],
  proud: ["proud"],
  thinking: ["thinking"],
  running: ["running"],
  sleeping: ["sleeping"],
  anime: ["japanese", "aesthetic"],
  japanese: ["japanese"],
  western: ["western"],
  ascii: ["ascii"],
  minimal: ["minimal"],
  decorative: ["decorative"],
  aesthetic: ["aesthetic"],
  classic: ["classic"],
  unicode: ["unicode"],
  extreme: ["extreme"],
  slug: [],
};

const CONTENT_PATTERNS: readonly { pattern: RegExp; slugs: readonly string[] }[] = [
  { pattern: /[♥♡❤💕💗💖]/u, slugs: ["love", "romantic", "cute"] },
  { pattern: /[TＴ][_｡]|[;；][-_]|[╥_T]/u, slugs: ["crying", "sad"] },
  { pattern: /[>^][oO0][<^]/u, slugs: ["happy", "laughing"] },
  { pattern: /[╯╰].*[┻━]/u, slugs: ["angry", "fighting"] },
  { pattern: /[｡◕‿◕｡]/u, slugs: ["cute", "kawaii", "happy"] },
  { pattern: /[ฅ|｡][•ω•]/u, slugs: ["cat", "cute"] },
  { pattern: /[Uu][._][Uu]/u, slugs: ["sad", "crying"] },
  { pattern: /[¯\\]_/u, slugs: ["shrug"] },
  { pattern: /z+[Zz]+/u, slugs: ["sleepy", "sleeping"] },
  { pattern: /[✧✿☆★]/u, slugs: ["decorative", "aesthetic"] },
];

function normalizeSourceCategory(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)[0] ?? "";
}

export function getTaxonomyBySlug(slug: string): TaxonomyCategory | undefined {
  return TAXONOMY_BY_SLUG.get(slug);
}

export interface CategoryAssignmentResult {
  readonly categories: readonly TaxonomyCategory[];
  readonly category_status: "ASSIGNED" | "REVIEW";
  readonly confidence: "high" | "medium" | "low";
}

export function assignCategories(
  content: string,
  sourceCategories: readonly string[],
): CategoryAssignmentResult {
  const slugSet = new Set<string>();

  for (const raw of sourceCategories) {
    const key = normalizeSourceCategory(raw);
    if (!key) continue;
    const mapped = SOURCE_CATEGORY_MAP[key];
    if (mapped) {
      for (const s of mapped) slugSet.add(s);
    } else {
      for (const t of EMOJIQUICK_TAXONOMY) {
        if (key.includes(t.slug) || t.slug.includes(key)) slugSet.add(t.slug);
      }
    }
  }

  for (const { pattern, slugs } of CONTENT_PATTERNS) {
    if (pattern.test(content)) {
      for (const s of slugs) slugSet.add(s);
    }
  }

  if (/^[\x00-\x7F]+$/.test(content) && /[()^_\-=]/.test(content)) {
    slugSet.add("ascii");
  }
  if (/[\u3000-\u303F\u3040-\u30FF\uFF00-\uFFEF]/.test(content)) {
    slugSet.add("japanese");
  }
  if (/[^\x00-\x7F]/.test(content)) {
    slugSet.add("unicode");
  }

  const categories = [...slugSet]
    .map((s) => TAXONOMY_BY_SLUG.get(s))
    .filter((t): t is TaxonomyCategory => Boolean(t))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  if (categories.length === 0) {
    return { categories: [], category_status: "REVIEW", confidence: "low" };
  }

  const confidence =
    sourceCategories.some((c) => SOURCE_CATEGORY_MAP[normalizeSourceCategory(c)]?.length) ? "high" : "medium";
  return {
    categories,
    category_status: confidence === "high" ? "ASSIGNED" : "REVIEW",
    confidence,
  };
}
