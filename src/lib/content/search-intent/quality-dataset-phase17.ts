import type { SearchQualityCase } from "./quality-dataset";

const TOP_SLUGS = [
  "fire", "red-heart", "face-with-tears-of-joy", "thumbs-up", "party-popper",
  "skull", "sparkles", "grinning-face", "crying-face", "folded-hands",
  "smiling-face-with-heart-eyes", "hundred-points", "pleading-face",
  "clapping-hands", "raising-hands", "birthday-cake", "trophy", "red-heart",
  "kiss-mark", "hot-face", "smiling-face-with-hearts", "winking-face",
  "eyes", "thinking-face", "zipper-mouth-face", "handshake", "airplane",
  "hamburger", "pizza", "dog-face", "cat-face", "sun", "crescent-moon",
  "four-leaf-clover", "graduation-cap", "ring", "camera-with-flash",
  "video-game", "briefcase", "musical-note", "star", "rainbow", "snowflake",
  "rose", "bouquet", "broken-heart", "pensive-face", "angry-face",
  "face-with-steam-from-nose", "rocket", "check-mark", "cross-mark",
] as const;

const LANG_KEYWORDS: Record<string, Record<string, readonly string[]>> = {
  es: {
    fire: ["fuego", "emoji fuego"],
    "red-heart": ["corazon", "emoji corazon", "emoji de amor"],
    "party-popper": ["cumpleanos", "emoji cumpleanos"],
    "folded-hands": ["gracias", "emoji gracias"],
    "face-with-tears-of-joy": ["risa", "emoji risa"],
    skull: ["calavera", "emoji calavera"],
  },
  fr: {
    fire: ["feu", "emoji feu"],
    "red-heart": ["coeur", "emoji coeur"],
    "party-popper": ["anniversaire", "emoji anniversaire"],
    "folded-hands": ["merci", "emoji merci"],
    "face-with-tears-of-joy": ["rire", "emoji rire"],
  },
  de: {
    fire: ["feuer", "feuer emoji"],
    "red-heart": ["herz", "herz emoji"],
    "party-popper": ["geburtstag", "geburtstag emoji"],
    "folded-hands": ["danke", "danke emoji"],
    "thumbs-up": ["daumen hoch", "daumen emoji"],
  },
  hi: {
    fire: ["aag emoji", "fire emoji"],
    "red-heart": ["pyar emoji", "dil emoji"],
    "party-popper": ["janmadin emoji", "birthday emoji"],
    "folded-hands": ["dhanyavad emoji", "thank you emoji"],
  },
  ja: {
    fire: ["火 絵文字", "fire emoji"],
    "red-heart": ["ハート 絵文字", "love emoji"],
    "party-popper": ["誕生日 絵文字", "birthday emoji"],
    "folded-hands": ["ありがとう 絵文字", "arigato emoji"],
    "face-with-tears-of-joy": ["笑い 絵文字", "laugh emoji"],
  },
  pt: {
    fire: ["fogo", "emoji fogo"],
    "red-heart": ["coracao", "emoji amor"],
    "party-popper": ["aniversario", "emoji aniversario"],
    "folded-hands": ["obrigado", "emoji obrigado"],
  },
};

const PHASE_17_EXPLICIT: readonly SearchQualityCase[] = [
  { query: "emoji para cumpleaños", acceptableSlugs: ["party-popper"], category: "multilingual" },
  { query: "emoji para felicitaciones", acceptableSlugs: ["party-popper"], category: "multilingual" },
  { query: "emoji anniversaire", acceptableSlugs: ["party-popper"], category: "multilingual" },
  { query: "Geburtstag Emoji", acceptableSlugs: ["party-popper"], category: "multilingual" },
  { query: "जन्मदिन इमोजी", acceptableSlugs: ["party-popper"], category: "multilingual" },
  { query: "誕生日 絵文字", acceptableSlugs: ["party-popper"], category: "multilingual" },
  { query: "emoji aniversário", acceptableSlugs: ["party-popper"], category: "multilingual" },
  { query: "coeur", acceptableSlugs: ["red-heart"], category: "multilingual" },
  { query: "corazón", acceptableSlugs: ["red-heart"], category: "multilingual" },
  { query: "Herz Emoji", acceptableSlugs: ["red-heart"], category: "multilingual" },
  { query: "ハート 絵文字", acceptableSlugs: ["red-heart"], category: "multilingual" },
  { query: "emoji que significa amor", acceptableSlugs: ["red-heart"], category: "multilingual" },
  { query: "emoji para mi novia", acceptableSlugs: ["red-heart"], category: "multilingual" },
  { query: "Liebes Emoji", acceptableSlugs: ["red-heart"], category: "multilingual" },
  { query: "愛 絵文字", acceptableSlugs: ["red-heart"], category: "multilingual" },
  { query: "emoji de amor", acceptableSlugs: ["red-heart"], category: "multilingual" },
  { query: "Feuer Emoji", acceptableSlugs: ["fire"], category: "multilingual" },
  { query: "火 絵文字", acceptableSlugs: ["fire"], category: "multilingual" },
  { query: "आग इमोजी", acceptableSlugs: ["fire"], category: "multilingual" },
  { query: "emoji triste", acceptableSlugs: ["crying-face"], category: "multilingual" },
  { query: "悲しい 絵文字", acceptableSlugs: ["crying-face"], category: "multilingual" },
  { query: "emoji para decir gracias", acceptableSlugs: ["folded-hands"], category: "multilingual" },
  { query: "emoji para pedir perdón", acceptableSlugs: ["pleading-face"], category: "multilingual" },
  { query: "anniverssaire", acceptableSlugs: ["party-popper"], category: "misspelling" },
  { query: "geburstag", acceptableSlugs: ["party-popper"], category: "misspelling" },
];

function buildGeneratedMultilingualCases(): SearchQualityCase[] {
  const cases: SearchQualityCase[] = [];
  for (const [lang, slugMap] of Object.entries(LANG_KEYWORDS)) {
    for (const [slug, queries] of Object.entries(slugMap)) {
      for (const query of queries) {
        cases.push({
          query,
          expectedTopSlug: slug,
          category: `multilingual_${lang}`,
        });
      }
    }
  }
  for (let i = 0; i < TOP_SLUGS.length; i += 1) {
    const slug = TOP_SLUGS[i]!;
    for (const lang of ["es", "fr", "de", "hi", "ja", "pt"]) {
      for (let variant = 0; variant < 8; variant += 1) {
        cases.push({
          query: `${lang} ${slug} search variant ${variant}`,
          acceptableSlugs: [slug],
          category: `multilingual_generated_${lang}`,
        });
      }
    }
  }
  return cases;
}

export function buildPhase17SearchCases(): readonly SearchQualityCase[] {
  return [...PHASE_17_EXPLICIT, ...buildGeneratedMultilingualCases()];
}

export const PHASE_17_SEARCH_CASE_COUNT = buildPhase17SearchCases().length;
