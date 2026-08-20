export { SITE_NAME } from "@/lib/site/config";

export const RELATED_CATEGORIES: Record<string, readonly string[]> = {
  "smileys-emotion": ["people-body", "symbols", "animals-nature"],
  "people-body": ["smileys-emotion", "activities", "symbols"],
  "animals-nature": ["food-drink", "travel-places", "smileys-emotion"],
  "food-drink": ["animals-nature", "objects", "activities"],
  "travel-places": ["activities", "flags", "objects"],
  activities: ["people-body", "travel-places", "objects"],
  objects: ["symbols", "activities", "food-drink"],
  symbols: ["smileys-emotion", "objects", "flags"],
  flags: ["travel-places", "symbols"],
};

export const CATEGORY_LABELS: Record<string, string> = {
  "smileys-emotion": "Smileys & Emotion",
  "people-body": "People & Body",
  "animals-nature": "Animals & Nature",
  "food-drink": "Food & Drink",
  "travel-places": "Travel & Places",
  activities: "Activities",
  objects: "Objects",
  symbols: "Symbols",
  flags: "Flags",
};

export const CATEGORY_EMOJIS: Record<string, string> = {
  "smileys-emotion": "😀",
  "people-body": "👋",
  "animals-nature": "🐶",
  "food-drink": "🍕",
  "travel-places": "✈️",
  activities: "⚽",
  objects: "💡",
  symbols: "❤️",
  flags: "🏳️",
};

export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "smileys-emotion":
    "Explore faces, moods, and emotional symbols from the Unicode Smileys & Emotion group.",
  "people-body":
    "Browse people, gestures, professions, and body-related emojis from Unicode.",
  "animals-nature":
    "Discover animals, plants, weather, and nature emojis from the Unicode catalog.",
  "food-drink":
    "Find food, drinks, cooking, and meal emojis from the Unicode Food & Drink group.",
  "travel-places":
    "Browse travel, places, landmarks, and transport emojis from Unicode.",
  activities:
    "Explore sports, hobbies, games, and event emojis from the Unicode Activities group.",
  objects:
    "Find everyday objects, tools, technology, and household emojis from Unicode.",
  symbols:
    "Browse hearts, signs, shapes, and symbolic emojis from the Unicode Symbols group.",
  flags:
    "Explore country flags, regional indicators, and flag emojis from Unicode.",
};

export const POPULAR_EMOJI_SLUGS = [
  "grinning-face",
  "face-with-tears-of-joy",
  "red-heart",
  "fire",
  "thumbs-up",
  "folded-hands",
  "party-popper",
  "sparkles",
  "crying-face",
  "smiling-face-with-heart-eyes",
  "clapping-hands",
  "rocket",
] as const;

export const FAVORITES_STORAGE_KEY = "emoji-favorites";
export const RECENT_STORAGE_KEY = "emoji-recent";
export const MAX_RECENT_ITEMS = 15;
export const RECENT_DISPLAY_COUNT = 15;
export const EMOJI_GRID_PAGE_SIZE = 72;

export const EMOJI_VERSION_ORDER = [
  "17.0",
  "16.0",
  "15.1",
  "15.0",
  "14.0",
  "13.1",
  "13.0",
  "12.1",
  "12.0",
  "11.0",
  "5.0",
  "4.0",
  "3.0",
  "2.0",
  "1.0",
  "0.6",
] as const;
