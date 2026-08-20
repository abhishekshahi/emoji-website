import type { DiscoveryContext, DiscoveryPeriod, PopularSort } from "@/lib/discovery/types";

export const STYLE_SLUGS = [
  "noto",
  "fluent",
  "openmoji",
  "twemoji",
  "default",
  "premium",
  "artistic",
  "classic",
  "comparison",
] as const;

export type StyleSlug = (typeof STYLE_SLUGS)[number];

export const TOPIC_SLUGS = [
  "hearts",
  "faces",
  "hands",
  "people",
  "animals",
  "food",
  "drink",
  "nature",
  "vehicles",
  "celebration",
  "technology",
  "sport",
  "weather",
  "music",
  "office",
  "love",
  "gestures",
  "plants",
  "marine",
  "gaming-themes",
] as const;

export type TopicSlug = (typeof TOPIC_SLUGS)[number];

export const POPULAR_SORT_SLUGS: readonly PopularSort[] = [
  "copied",
  "searched",
  "saved",
  "viewed",
];

export const TRENDING_PERIOD_SLUGS: readonly DiscoveryPeriod[] = [
  "today",
  "week",
  "month",
];

export const CONTEXT_SLUGS: readonly DiscoveryContext[] = [
  "instagram",
  "discord",
  "tiktok",
  "whatsapp",
  "x",
  "gaming",
  "work",
];

export const INFO_PAGE_SLUGS = [
  "about",
  "emoji-guide",
  "emoji-search-guide",
  "emoji-copy-guide",
  "emoji-artwork",
  "emoji-styles",
  "emoji-unicode",
  "emoji-categories",
  "emoji-license",
  "privacy",
] as const;

export type InfoPageSlug = (typeof INFO_PAGE_SLUGS)[number];

/** Exactly 57 new public static pages (Phase 8.62-B). */
export function getHubPagePaths(): string[] {
  return [
    "/styles",
    ...STYLE_SLUGS.map((s) => `/styles/${s}`),
    ...TOPIC_SLUGS.map((t) => `/topics/${t}`),
    ...POPULAR_SORT_SLUGS.map((s) => `/popular/${s}`),
    "/trending",
    ...TRENDING_PERIOD_SLUGS.map((p) => `/trending/${p}`),
    "/explore",
    "/explore/new",
    ...CONTEXT_SLUGS.map((c) => `/context/${c}`),
    ...INFO_PAGE_SLUGS.map((p) => `/${p}`),
  ];
}

export const HUB_PAGE_COUNT = 57 as const;
