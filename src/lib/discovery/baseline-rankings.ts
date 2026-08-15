import { POPULAR_EMOJI_SLUGS } from "@/lib/emoji/constants";
import type { DiscoveryContext, DiscoveryPeriod, PopularSort } from "./types";

const TRENDING_TODAY: readonly string[] = [
  "fire", "skull", "sparkles", "face-with-tears-of-joy", "red-heart", "thumbs-up",
  "crying-face", "party-popper", "folded-hands", "rocket", "eyes", "skull-and-crossbones",
];

const TRENDING_WEEK: readonly string[] = [
  "grinning-face", "face-with-tears-of-joy", "red-heart", "fire", "thumbs-up",
  "smiling-face-with-heart-eyes", "sparkles", "folded-hands", "party-popper", "crying-face",
  "clapping-hands", "rocket", "skull", "eyes", "100",
];

const TRENDING_MONTH: readonly string[] = [
  ...POPULAR_EMOJI_SLUGS, "smiling-face", "winking-face", "thinking-face",
  "face-with-rolling-eyes", "hot-face", "pleading-face",
];

const POPULAR_BY_SORT: Record<PopularSort, readonly string[]> = {
  copied: ["face-with-tears-of-joy", "red-heart", "thumbs-up", "folded-hands", "fire", "sparkles", "grinning-face", "crying-face", "party-popper", "clapping-hands", "rocket", "smiling-face-with-heart-eyes"],
  searched: ["fire", "heart", "skull", "crying-face", "100", "eyes", "poop", "star", "check-mark", "cross-mark", "sparkles", "thumbs-up"],
  saved: ["red-heart", "sparkling-heart", "two-hearts", "revolving-hearts", "heart-with-arrow", "smiling-face-with-heart-eyes", "kissing-face", "hugging-face", "folded-hands", "party-popper", "birthday-cake", "gift"],
  viewed: ["grinning-face", "face-with-tears-of-joy", "red-heart", "fire", "thumbs-up", "winking-face", "thinking-face", "smiling-face-with-sunglasses", "hot-face", "skull", "eyes", "100"],
};

const CONTEXT_SLUGS: Record<DiscoveryContext, readonly string[]> = {
  instagram: ["sparkles", "fire", "red-heart", "camera-with-flash", "sun", "rainbow", "star", "party-popper", "clapping-hands", "sparkling-heart", "sunrise", "palms-up-together"],
  discord: ["skull", "fire", "thumbs-up", "thumbs-down", "eyes", "100", "thinking-face", "face-with-rolling-eyes", "robot", "video-game", "headphone", "microphone"],
  tiktok: ["fire", "skull", "sparkles", "face-with-tears-of-joy", "eyes", "hot-face", "zany-face", "party-popper", "musical-note", "dancer", "clapping-hands", "100"],
  whatsapp: ["thumbs-up", "folded-hands", "red-heart", "face-with-tears-of-joy", "grinning-face", "crying-face", "party-popper", "birthday-cake", "clapping-hands", "hugging-face", "kissing-face", "sparkles"],
  x: ["fire", "skull", "eyes", "100", "thumbs-up", "thumbs-down", "face-with-tears-of-joy", "thinking-face", "megaphone", "chart-increasing", "check-mark", "cross-mark"],
  gaming: ["video-game", "joystick", "game-die", "trophy", "medal", "fire", "skull", "crossed-swords", "bow-and-arrow", "bomb", "rocket", "robot"],
  work: ["briefcase", "laptop", "calendar", "chart-increasing", "check-mark-button", "memo", "telephone-receiver", "handshake", "thumbs-up", "thinking-face", "hot-beverage", "clock-three-oclock"],
};

export function getBaselineTrendingSlugs(period: DiscoveryPeriod): readonly string[] {
  switch (period) {
    case "today": return TRENDING_TODAY;
    case "week": return TRENDING_WEEK;
    case "month": return TRENDING_MONTH;
  }
}

export function getBaselinePopularSlugs(sort: PopularSort): readonly string[] {
  return POPULAR_BY_SORT[sort];
}

export function getBaselineContextSlugs(context: DiscoveryContext): readonly string[] {
  return CONTEXT_SLUGS[context];
}

export const VALID_DISCOVERY_PERIODS: readonly DiscoveryPeriod[] = ["today", "week", "month"];
export const VALID_POPULAR_SORTS: readonly PopularSort[] = ["copied", "searched", "saved", "viewed"];
export const VALID_DISCOVERY_CONTEXTS: readonly DiscoveryContext[] = ["instagram", "discord", "tiktok", "whatsapp", "x", "gaming", "work"];
export const DISCOVERY_PAYLOAD_LIMIT = 24 as const;
