import type { EmojiCombination } from "./types";

const COMBINATIONS = new Map<string, EmojiCombination>();

export function registerCombination(record: EmojiCombination): void {
  COMBINATIONS.set(record.slug, record);
}

export function getCombination(slug: string): EmojiCombination | null {
  return COMBINATIONS.get(slug) ?? null;
}

export function listPublishedCombinations(): readonly EmojiCombination[] {
  return [...COMBINATIONS.values()].filter((c) => c.quality === "published");
}

function bootstrap(): void {
  if (COMBINATIONS.size > 0) return;
  const now = new Date().toISOString();
  const base = {
    language: "en",
    source: "curated" as const,
    quality: "published" as const,
    provenance: {
      source: "editorial" as const,
      author: "EmojiQuick Editorial",
      lastUpdated: now,
      qualityStatus: "partial" as const,
    },
  };

  registerCombination({
    ...base,
    id: "combo-laugh-fire",
    slug: "laugh-fire",
    sequence: "😂🔥",
    emojiIds: ["unicode:1F602", "unicode:1F525"],
    title: "Laugh + Fire",
    meaning: "Something is hilariously good or 'too funny.'",
    usage: "React when a joke or moment is both funny and impressive.",
    contexts: ["social media", "texting"],
  });

  registerCombination({
    ...base,
    id: "combo-love-sparkle",
    slug: "love-sparkle",
    sequence: "❤️✨",
    emojiIds: ["unicode:2764", "unicode:2728"],
    title: "Love + Sparkles",
    meaning: "Affection with extra emphasis or magic.",
    usage: "Compliments, celebrations, or romantic messages with flair.",
    contexts: ["social media", "dating"],
  });

  registerCombination({
    ...base,
    id: "combo-party",
    slug: "party-celebration",
    sequence: "🥳🎉",
    emojiIds: ["unicode:1F973", "unicode:1F389"],
    title: "Party Celebration",
    meaning: "Birthday, milestone, or general celebration.",
    usage: "Congratulate someone or mark a festive occasion.",
    contexts: ["birthday", "celebration"],
  });

  registerCombination({
    ...base,
    id: "combo-skull-laugh",
    slug: "skull-laugh",
    sequence: "💀😂",
    emojiIds: ["unicode:1F480", "unicode:1F602"],
    title: "Skull + Laugh",
    meaning: "Dark humor or 'I'm dead' from laughing.",
    usage: "Internet humor reactions — use with audience awareness.",
    contexts: ["social media", "memes"],
  });

  registerCombination({
    ...base,
    id: "combo-pray-heart",
    slug: "pray-heart",
    sequence: "🙏❤️",
    emojiIds: ["unicode:1F64F", "unicode:2764"],
    title: "Pray + Heart",
    meaning: "Grateful love, support, or heartfelt thanks.",
    usage: "Thank someone with warmth and sincerity.",
    contexts: ["support", "gratitude"],
  });

  registerCombination({
    ...base,
    id: "combo-party-cake",
    slug: "party-cake",
    sequence: "🎉🎂",
    emojiIds: ["unicode:1F389", "unicode:1F382"],
    title: "Party + Cake",
    meaning: "Birthday celebration classic.",
    usage: "Birthday wishes and party invites.",
    contexts: ["birthday", "celebration"],
  });

  registerCombination({
    ...base,
    id: "combo-fire-hundred",
    slug: "fire-hundred",
    sequence: "🔥💯",
    emojiIds: ["unicode:1F525", "unicode:1F4AF"],
    title: "Fire + 100",
    meaning: "Maximum hype — something is absolutely on point.",
    usage: "Compliments, achievements, viral moments.",
    contexts: ["social media", "gaming"],
  });

  registerCombination({
    ...base,
    id: "combo-laugh-cry",
    slug: "laugh-cry",
    sequence: "😂😭",
    emojiIds: ["unicode:1F602", "unicode:1F62D"],
    title: "Laugh + Cry",
    meaning: "Laughing so hard you cry, or mixed emotions.",
    usage: "Extreme reactions to funny or emotional content.",
    contexts: ["memes", "social media"],
  });

  registerCombination({
    ...base,
    id: "combo-love-heart",
    slug: "love-heart",
    sequence: "😍❤️",
    emojiIds: ["unicode:1F60D", "unicode:2764"],
    title: "Love Eyes + Heart",
    meaning: "Strong romantic affection or admiration.",
    usage: "Romantic messages and crushes.",
    contexts: ["dating", "romance"],
  });

  registerCombination({
    ...base,
    id: "combo-congrats",
    slug: "congrats-trophy",
    sequence: "🎉🏆",
    emojiIds: ["unicode:1F389", "unicode:1F3C6"],
    title: "Party + Trophy",
    meaning: "Congratulations on a win or milestone.",
    usage: "Celebrate promotions, sports wins, or achievements.",
    contexts: ["congratulations", "celebration"],
  });

  registerCombination({
    ...base,
    id: "combo-friendship",
    slug: "friendship-wave",
    sequence: "👋🤝",
    emojiIds: ["unicode:1F44B", "unicode:1F91D"],
    title: "Wave + Handshake",
    meaning: "Friendly hello or solid friendship.",
    usage: "Greeting friends or marking a bond.",
    contexts: ["friendship", "greetings"],
  });

  registerCombination({
    ...base,
    id: "combo-travel",
    slug: "travel-adventure",
    sequence: "✈️🧳",
    emojiIds: ["unicode:2708", "unicode:1F9F3"],
    title: "Plane + Luggage",
    meaning: "Trip planning or vacation departure.",
    usage: "Travel posts, airport check-ins, holiday plans.",
    contexts: ["travel", "vacation"],
  });

  registerCombination({
    ...base,
    id: "combo-thanks",
    slug: "thanks-heart",
    sequence: "🙏💕",
    emojiIds: ["unicode:1F64F", "unicode:1F496"],
    title: "Thanks + Sparkling Heart",
    meaning: "Warm gratitude with extra appreciation.",
    usage: "Thank someone with heartfelt sincerity.",
    contexts: ["gratitude", "support"],
  });

  registerCombination({
    ...base,
    id: "combo-crown-fire",
    slug: "crown-fire",
    sequence: "👑🔥",
    emojiIds: ["unicode:1F451", "unicode:1F525"],
    title: "Crown + Fire",
    meaning: "Royal-level hype — someone or something is iconic.",
    usage: "Compliment standout style, talent, or a viral moment.",
    contexts: ["social media", "compliments"],
  });

  registerCombination({
    ...base,
    id: "combo-sorry-plead",
    slug: "sorry-plead",
    sequence: "🥺🙏",
    emojiIds: ["unicode:1F97A", "unicode:1F64F"],
    title: "Pleading + Pray",
    meaning: "Sincere apology or gentle please.",
    usage: "Soften an apology or ask for understanding.",
    contexts: ["apology", "gratitude"],
  });
}

bootstrap();

export const COMBINATION_SLUGS = listPublishedCombinations().map((c) => c.slug);
