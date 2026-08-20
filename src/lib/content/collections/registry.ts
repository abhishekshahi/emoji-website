import type { EmojiCollection } from "./types";

const COLLECTIONS = new Map<string, EmojiCollection>();

export function registerCollection(record: EmojiCollection): void {
  COLLECTIONS.set(record.slug, record);
}

export function getCollection(slug: string): EmojiCollection | null {
  return COLLECTIONS.get(slug) ?? null;
}

export function listPublishedCollections(): readonly EmojiCollection[] {
  return [...COLLECTIONS.values()].filter((c) => c.editorialStatus === "published");
}

function bootstrap(): void {
  if (COLLECTIONS.size > 0) return;
  const now = new Date().toISOString();
  const base = {
    language: "en",
    editorialStatus: "published" as const,
    provenance: {
      source: "editorial" as const,
      author: "EmojiQuick Editorial",
      lastUpdated: now,
      qualityStatus: "partial" as const,
    },
  };

  registerCollection({
    ...base,
    id: "col-love",
    slug: "love-emojis",
    title: "Best Love Emojis",
    description: "Curated hearts and affection symbols for messages, posts, and celebrations.",
    context: "Texting, social media, dating",
    emojiSlugs: ["red-heart", "sparkling-heart", "heart-with-arrow", "two-hearts", "kiss-mark"],
    emojiIds: ["unicode:2764", "unicode:1F496", "unicode:1F498", "unicode:1F495", "unicode:1F48B"],
    topicSlug: "love",
    relatedCombinationSlugs: ["love-sparkle"],
  });

  registerCollection({
    ...base,
    id: "col-birthday",
    slug: "birthday-emojis",
    title: "Birthday Emojis",
    description: "Party, cake, and celebration picks for birthdays and milestones.",
    context: "Birthday messages, cards, social posts",
    emojiSlugs: ["party-popper", "birthday-cake", "balloon", "wrapped-gift", "party-face"],
    emojiIds: ["unicode:1F389", "unicode:1F382", "unicode:1F388", "unicode:1F381", "unicode:1F973"],
    topicSlug: "celebration",
    relatedCombinationSlugs: ["party-celebration"],
  });

  registerCollection({
    ...base,
    id: "col-cute",
    slug: "cute-emojis",
    title: "Cute Emojis",
    description: "Soft, friendly faces and symbols for warm, playful messages.",
    emojiSlugs: ["smiling-face-with-hearts", "blush", "sparkles", "star-struck", "hugging-face"],
    emojiIds: ["unicode:1F970", "unicode:1F60A", "unicode:2728", "unicode:1F929", "unicode:1F917"],
    topicSlug: "faces",
  });

  registerCollection({
    ...base,
    id: "col-work",
    slug: "work-emojis",
    title: "Work Emojis",
    description: "Professional-friendly symbols for email, chat, and workplace updates.",
    context: "Email, Slack, Teams",
    emojiSlugs: ["briefcase", "laptop", "memo", "chart-increasing", "handshake"],
    emojiIds: ["unicode:1F4BC", "unicode:1F4BB", "unicode:1F4DD", "unicode:1F4C8", "unicode:1F91D"],
    topicSlug: "office",
  });

  registerCollection({
    ...base,
    id: "col-gaming",
    slug: "gaming-emojis",
    title: "Gaming Emojis",
    description: "Controllers, trophies, and hype symbols for gaming chat.",
    context: "Discord, Twitch, in-game chat",
    emojiSlugs: ["video-game", "joystick", "trophy", "fire", "skull"],
    emojiIds: ["unicode:1F3AE", "unicode:1F579", "unicode:1F3C6", "unicode:1F525", "unicode:1F480"],
    topicSlug: "gaming-themes",
    relatedCombinationSlugs: ["laugh-fire", "skull-laugh"],
  });

  registerCollection({
    ...base,
    id: "col-instagram",
    slug: "instagram-emojis",
    title: "Instagram Emojis",
    description: "Popular symbols for captions, stories, and social reactions.",
    context: "Instagram captions and comments",
    emojiSlugs: ["camera", "sparkles", "fire", "red-heart", "star-struck"],
    emojiIds: ["unicode:1F4F7", "unicode:2728", "unicode:1F525", "unicode:2764", "unicode:1F929"],
    topicSlug: "celebration",
  });

  registerCollection({
    ...base,
    id: "col-travel",
    slug: "travel-emojis",
    title: "Travel Emojis",
    description: "Planes, maps, and adventure symbols for travel posts and plans.",
    emojiSlugs: ["airplane", "world-map", "luggage", "beach-with-umbrella", "mountain"],
    emojiIds: ["unicode:2708", "unicode:1F5FA", "unicode:1F9F3", "unicode:1F3D6", "unicode:26F0"],
    topicSlug: "nature",
  });

  registerCollection({
    ...base,
    id: "col-celebration",
    slug: "celebration-emojis",
    title: "Celebration Emojis",
    description: "Confetti, trophies, and party symbols for wins and milestones.",
    emojiSlugs: ["party-popper", "confetti-ball", "trophy", "clapping-hands", "party-face"],
    emojiIds: ["unicode:1F389", "unicode:1F38A", "unicode:1F3C6", "unicode:1F44F", "unicode:1F973"],
    topicSlug: "celebration",
    relatedCombinationSlugs: ["party-celebration"],
  });

  registerCollection({
    ...base,
    id: "col-friendship",
    slug: "friendship-emojis",
    title: "Friendship Emojis",
    description: "Handshake, hugs, and warm symbols for friends and support.",
    emojiSlugs: ["handshake", "hugging-face", "people-holding-hands", "red-heart", "waving-hand"],
    emojiIds: ["unicode:1F91D", "unicode:1F917", "unicode:1F46B", "unicode:2764", "unicode:1F44B"],
    topicSlug: "love",
    relatedCombinationSlugs: ["pray-heart"],
  });

  registerCollection({
    ...base,
    id: "col-romantic",
    slug: "romantic-emojis",
    title: "Romantic Emojis",
    description: "Hearts, kisses, and affection for romantic messages.",
    emojiSlugs: ["red-heart", "heart-with-arrow", "kiss-mark", "smiling-face-with-heart-eyes", "two-hearts"],
    emojiIds: ["unicode:2764", "unicode:1F498", "unicode:1F48B", "unicode:1F60D", "unicode:1F495"],
    topicSlug: "love",
    relatedCombinationSlugs: ["love-sparkle", "love-heart"],
  });

  registerCollection({
    ...base,
    id: "col-funny",
    slug: "funny-emojis",
    title: "Funny Emojis",
    description: "Laughing faces and meme reactions for humor.",
    emojiSlugs: ["face-with-tears-of-joy", "rolling-on-the-floor-laughing", "zany-face", "skull", "face-with-tongue"],
    emojiIds: ["unicode:1F602", "unicode:1F923", "unicode:1F92A", "unicode:1F480", "unicode:1F61B"],
    topicSlug: "faces",
    relatedCombinationSlugs: ["laugh-fire", "skull-laugh", "laugh-cry"],
  });

  registerCollection({
    ...base,
    id: "col-sad",
    slug: "sad-emojis",
    title: "Sad Emojis",
    description: "Crying, pleading, and sympathetic reactions.",
    emojiSlugs: ["crying-face", "loudly-crying-face", "pleading-face", "disappointed-face", "broken-heart"],
    emojiIds: ["unicode:1F622", "unicode:1F62D", "unicode:1F97A", "unicode:1F61E", "unicode:1F494"],
    topicSlug: "faces",
  });

  registerCollection({
    ...base,
    id: "col-food",
    slug: "food-emojis",
    title: "Food Emojis",
    description: "Popular food symbols for cravings, invites, and posts.",
    emojiSlugs: ["pizza", "hamburger", "birthday-cake", "hot-beverage", "taco"],
    emojiIds: ["unicode:1F355", "unicode:1F354", "unicode:1F382", "unicode:2615", "unicode:1F32E"],
    topicSlug: "food",
    relatedCombinationSlugs: ["party-cake"],
  });

  registerCollection({
    ...base,
    id: "col-nature",
    slug: "nature-emojis",
    title: "Nature Emojis",
    description: "Sun, rainbows, plants, and outdoor symbols.",
    emojiSlugs: ["sun", "rainbow", "evergreen-tree", "mountain", "snowflake"],
    emojiIds: ["unicode:2600", "unicode:1F308", "unicode:1F332", "unicode:26F0", "unicode:2744"],
    topicSlug: "nature",
  });

  registerCollection({
    ...base,
    id: "col-animal",
    slug: "animal-emojis",
    title: "Animal Emojis",
    description: "Cute and popular animal symbols.",
    emojiSlugs: ["dog-face", "cat-face", "penguin", "lion", "butterfly"],
    emojiIds: ["unicode:1F436", "unicode:1F431", "unicode:1F427", "unicode:1F981", "unicode:1F98B"],
    topicSlug: "animals",
  });

  registerCollection({
    ...base,
    id: "col-congratulations",
    slug: "congratulations-emojis",
    title: "Congratulations Emojis",
    description: "Trophies, applause, and party symbols for wins and milestones.",
    context: "Graduation, promotions, achievements",
    emojiSlugs: ["trophy", "party-popper", "clapping-hands", "hundred-points", "raising-hands"],
    emojiIds: ["unicode:1F3C6", "unicode:1F389", "unicode:1F44F", "unicode:1F4AF", "unicode:1F64C"],
    topicSlug: "celebration",
    relatedCombinationSlugs: ["party-celebration", "fire-hundred"],
  });

  registerCollection({
    ...base,
    id: "col-tiktok",
    slug: "tiktok-emojis",
    title: "TikTok Emojis",
    description: "Trending symbols for short-form video captions and reactions.",
    context: "TikTok captions and comments",
    emojiSlugs: ["fire", "skull", "sparkles", "face-with-tears-of-joy", "hot-face", "musical-note"],
    emojiIds: ["unicode:1F525", "unicode:1F480", "unicode:2728", "unicode:1F602", "unicode:1F975", "unicode:1F3B5"],
    topicSlug: "celebration",
  });

  registerCollection({
    ...base,
    id: "col-whatsapp",
    slug: "whatsapp-emojis",
    title: "WhatsApp Emojis",
    description: "Popular symbols for quick replies and group chat.",
    context: "WhatsApp messages and status",
    emojiSlugs: ["thumbs-up", "folded-hands", "red-heart", "face-with-tears-of-joy", "party-popper", "birthday-cake"],
    emojiIds: ["unicode:1F44D", "unicode:1F64F", "unicode:2764", "unicode:1F602", "unicode:1F389", "unicode:1F382"],
    topicSlug: "love",
  });

  registerCollection({
    ...base,
    id: "col-apology",
    slug: "apology-emojis",
    title: "Apology Emojis",
    description: "Sincere sorry and repair symbols for difficult conversations.",
    context: "Apologies and making amends",
    emojiSlugs: ["pleading-face", "folded-hands", "crying-face", "broken-heart", "pensive-face"],
    emojiIds: ["unicode:1F97A", "unicode:1F64F", "unicode:1F622", "unicode:1F494", "unicode:1F614"],
    topicSlug: "faces",
  });

  registerCollection({
    ...base,
    id: "col-thanks",
    slug: "thank-you-emojis",
    title: "Thank You Emojis",
    description: "Gratitude and appreciation symbols.",
    context: "Thank-you notes and appreciation posts",
    emojiSlugs: ["folded-hands", "red-heart", "smiling-face", "raising-hands", "sparkling-heart"],
    emojiIds: ["unicode:1F64F", "unicode:2764", "unicode:1F642", "unicode:1F64C", "unicode:1F496"],
    topicSlug: "love",
    relatedCombinationSlugs: ["pray-heart"],
  });

  registerCollection({
    ...base,
    id: "col-school",
    slug: "school-emojis",
    title: "School Emojis",
    description: "Study, classroom, and graduation symbols.",
    context: "Homework, exams, graduation",
    emojiSlugs: ["books", "open-book", "graduation-cap", "memo", "pencil"],
    emojiIds: ["unicode:1F4DA", "unicode:1F4D6", "unicode:1F393", "unicode:1F4DD", "unicode:270F"],
    topicSlug: "office",
  });
}

bootstrap();

export const COLLECTION_SLUGS = listPublishedCollections().map((c) => c.slug);
