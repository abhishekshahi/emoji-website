import { getContextDiscovery, getPopularDiscovery, getTrendingDiscovery } from "@/lib/discovery/engine";
import {
  CONTEXT_SLUGS,
  INFO_PAGE_SLUGS,
  POPULAR_SORT_SLUGS,
  STYLE_SLUGS,
  TRENDING_PERIOD_SLUGS,
  TOPIC_SLUGS,
} from "@/lib/hub/hub-routes";
import { STYLE_PAGES } from "@/lib/hub/style-data";
import { TOPIC_DEFINITIONS } from "@/lib/hub/topic-data";

export interface HubNavLink {
  readonly href: string;
  readonly label: string;
  readonly description?: string;
}

export const HUB_POPULAR_SORT_LINKS: readonly HubNavLink[] = POPULAR_SORT_SLUGS.map((sort) => {
  const data = getPopularDiscovery(sort);
  return { href: `/popular/${sort}`, label: data.label };
});

export const HUB_TRENDING_PERIOD_LINKS: readonly HubNavLink[] = TRENDING_PERIOD_SLUGS.map((period) => {
  const data = getTrendingDiscovery(period);
  return { href: `/trending/${period}`, label: data.label };
});

export const HUB_CONTEXT_LINKS: readonly HubNavLink[] = CONTEXT_SLUGS.map((context) => {
  const data = getContextDiscovery(context);
  return { href: `/context/${context}`, label: data.label };
});

export const HUB_TOPIC_LINKS: readonly HubNavLink[] = TOPIC_SLUGS.map((topic) => ({
  href: `/topics/${topic}`,
  label: TOPIC_DEFINITIONS[topic].title,
  description: TOPIC_DEFINITIONS[topic].emoji,
}));

export const HUB_STYLE_LINKS: readonly HubNavLink[] = STYLE_SLUGS.map((slug) => ({
  href: `/styles/${slug}`,
  label: STYLE_PAGES[slug].title,
}));

const INFO_LABELS: Record<string, string> = {
  about: "About",
  "emoji-guide": "Emoji Guide",
  "emoji-search-guide": "Search Guide",
  "emoji-copy-guide": "Copy Guide",
  "emoji-artwork": "Artwork",
  "emoji-styles": "Emoji Styles",
  "emoji-unicode": "Unicode",
  "emoji-categories": "Categories",
  "emoji-license": "License",
  privacy: "Privacy",
};

export const HUB_GUIDE_LINKS: readonly HubNavLink[] = INFO_PAGE_SLUGS.map((slug) => ({
  href: `/${slug}`,
  label: INFO_LABELS[slug] ?? slug,
}));

export const HUB_TOOLS_LINKS: readonly HubNavLink[] = [
  { href: "/tools/invisible-characters", label: "Invisible characters" },
  { href: "/tools/invisible-characters/generator", label: "Character generator" },
  { href: "/tools/invisible-characters/inspector", label: "Unicode inspector" },
  { href: "/tools/invisible-characters/cleaner", label: "Remove invisible chars" },
];

export const HUB_EXPLORE_LINKS: readonly HubNavLink[] = [
  { href: "/explore", label: "Explore hub" },
  { href: "/explore/new", label: "New emojis" },
  { href: "/trending", label: "Trending" },
  { href: "/styles", label: "Artwork styles" },
  { href: "/popular", label: "Popular" },
];