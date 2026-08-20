export const QUICK_SEARCHES = [
  { label: "Love", query: "love", emoji: "\u2764\uFE0F" },
  { label: "Fire", query: "fire", emoji: "\u{1F525}" },
  { label: "Laugh", query: "laugh", emoji: "\u{1F602}" },
  { label: "Celebration", query: "party", emoji: "\u{1F389}" },
] as const;

export const MOOD_CHIPS = [
  { label: "Love", query: "love", emoji: "\u2764\uFE0F" },
  { label: "Funny", query: "funny", emoji: "\u{1F602}" },
  { label: "Energy", query: "fire", emoji: "\u{1F525}" },
  { label: "Cute", query: "cute", emoji: "\u{1F970}" },
  { label: "Cool", query: "cool", emoji: "\u{1F60E}" },
  { label: "Celebration", query: "party", emoji: "\u{1F389}" },
] as const;

export const VALUE_PROPS = [
  { emoji: "\u26A1", title: "Instant copy", description: "Tap any emoji to copy in one click." },
  { emoji: "\u{1F50E}", title: "Smart search", description: "Find emojis by name, keyword, meaning, or Unicode." },
  { emoji: "\u{1F3A8}", title: "Multiple styles", description: "Browse Noto, Fluent, OpenMoji, and Twemoji." },
  { emoji: "\u{1F4F1}", title: "Works everywhere", description: "Fast on mobile and desktop. No account required." },
] as const;