import Link from "next/link";
import { EmojiGrid } from "@/components/emoji/emoji-grid";
import { HubExploreSections, HubContextNav, HubPopularSortNav, HubTrendingNav } from "@/components/hub/hub-nav-sections";
import { HubLayout } from "@/components/hub/hub-layout";
import {
  HUB_CONTEXT_LINKS,
  HUB_POPULAR_SORT_LINKS,
  HUB_TRENDING_PERIOD_LINKS,
} from "@/lib/hub/hub-navigation";
import {
  getContextDiscovery,
  getPopularDiscovery,
  getTrendingDiscovery,
} from "@/lib/discovery/engine";
import { getEmojiBySlug } from "@/lib/emoji/data";
import type { DiscoveryContext, DiscoveryPeriod, PopularSort } from "@/lib/discovery/types";

function resolveDiscoveryEmojis(slugs: readonly string[]) {
  return slugs
    .map((slug) => getEmojiBySlug(slug))
    .filter((emoji): emoji is NonNullable<typeof emoji> => Boolean(emoji));
}

interface DiscoveryHubPageProps {
  path: string;
  title: string;
  description: string;
  eyebrow: string;
  kind: "trending" | "popular" | "context" | "explore" | "explore-new" | "trending-hub" | "popular-hub";
  period?: DiscoveryPeriod;
  sort?: PopularSort;
  context?: DiscoveryContext;
  links?: readonly { href: string; label: string }[];
}

export function DiscoveryHubPage({
  path,
  title,
  description,
  eyebrow,
  kind,
  period,
  sort,
  context,
  links = [],
}: DiscoveryHubPageProps) {
  let label = title;
  let source = "baseline";
  let slugs: readonly string[] = [];

  if (kind === "trending" && period) {
    const data = getTrendingDiscovery(period);
    label = data.label;
    source = data.source;
    slugs = data.items.map((i) => i.slug);
  } else if (kind === "popular" && sort) {
    const data = getPopularDiscovery(sort);
    label = data.label;
    source = data.source;
    slugs = data.items.map((i) => i.slug);
  } else if (kind === "context" && context) {
    const data = getContextDiscovery(context);
    label = data.label;
    source = data.source;
    slugs = data.items.map((i) => i.slug);
  } else if (kind === "explore-new") {
    slugs = getTrendingDiscovery("month").items.map((i) => i.slug);
    label = "New & Noteworthy";
  } else if (kind === "trending-hub") {
    slugs = getTrendingDiscovery("today").items.map((i) => i.slug);
    label = getTrendingDiscovery("today").label;
  }

  const emojis = resolveDiscoveryEmojis(slugs);

  return (
    <HubLayout path={path} title={title} description={description} eyebrow={eyebrow} links={links}>
      {kind === "explore" ? (
        <HubExploreSections />
      ) : kind === "trending-hub" ? (
        <div className="space-y-6">
          <HubTrendingNav />
          <p className="text-sm text-muted">
            {label}
            {source === "baseline" ? " · editorial baseline (not live analytics)" : ""}
          </p>
          <EmojiGrid emojis={emojis} pageSize={24} emptyMessage="No emojis found for this view." />
        </div>
      ) : kind === "popular-hub" ? (
        <div className="space-y-6">
          <HubPopularSortNav />
          <EmojiGrid emojis={emojis} pageSize={24} emptyMessage="No emojis found for this view." />
        </div>
      ) : (
        <>
          <p className="text-sm text-muted">
            {label}
            {source === "baseline" ? " · editorial baseline (not live analytics)" : ""}
          </p>
          {kind === "context" ? (
            <div className="space-y-6">
              <p className="text-sm text-muted">
                Popular picks for {label.toLowerCase()} — explore related emoji identity pages below.
              </p>
              <EmojiGrid emojis={emojis} pageSize={24} emptyMessage="No emojis found for this view." />
              <HubContextNav />
            </div>
          ) : kind === "popular" ? (
            <div className="space-y-6">
              <HubPopularSortNav />
              <EmojiGrid emojis={emojis} pageSize={24} emptyMessage="No emojis found for this view." />
            </div>
          ) : kind === "trending" ? (
            <div className="space-y-6">
              <HubTrendingNav />
              <EmojiGrid emojis={emojis} pageSize={24} emptyMessage="No emojis found for this view." />
            </div>
          ) : (
            <EmojiGrid emojis={emojis} pageSize={24} emptyMessage="No emojis found for this view." />
          )}
        </>
      )}
    </HubLayout>
  );
}

export function getDefaultPopularSortLinks() {
  return HUB_POPULAR_SORT_LINKS;
}

export function getDefaultTrendingLinks() {
  return HUB_TRENDING_PERIOD_LINKS;
}

export function getDefaultContextLinks() {
  return HUB_CONTEXT_LINKS;
}
