export { SITE_NAME } from "@/lib/site/config";

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
export const MAX_RECENT_ITEMS = 20;
export const EMOJI_GRID_PAGE_SIZE = 60;

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
