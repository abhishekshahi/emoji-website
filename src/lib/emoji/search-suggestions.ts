/** Suggested queries for no-result recovery (8.62-D). */
export const SEARCH_SUGGESTIONS = [
  "fire",
  "heart",
  "smile",
  "thumbs up",
  "party",
  "star",
  "100",
  "skull",
  "eyes",
  "rocket",
] as const;

export const SEARCH_CATEGORY_HINTS = [
  { label: "Smileys", query: "happy" },
  { label: "Hearts", query: "heart" },
  { label: "Food", query: "pizza" },
  { label: "Animals", query: "dog" },
  { label: "Flags", query: "flag" },
] as const;
