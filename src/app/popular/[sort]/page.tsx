import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DiscoveryHubPage } from "@/components/hub/discovery-hub-page";
import { POPULAR_SORT_SLUGS } from "@/lib/hub/hub-routes";
import { HUB_POPULAR_SORT_LINKS } from "@/lib/hub/hub-navigation";
import { createPageMetadata } from "@/lib/seo/metadata";
import type { PopularSort } from "@/lib/discovery/types";
import { getPopularDiscovery } from "@/lib/discovery/engine";

interface PopularSortPageProps {
  params: Promise<{ sort: string }>;
}

export function generateStaticParams() {
  return POPULAR_SORT_SLUGS.map((sort) => ({ sort }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: PopularSortPageProps): Promise<Metadata> {
  const { sort } = await params;
  if (!POPULAR_SORT_SLUGS.includes(sort as PopularSort)) {
    return { title: "Popular not found" };
  }
  const data = getPopularDiscovery(sort as PopularSort);
  return createPageMetadata({
    title: `${data.label} — Popular Emojis`,
    description: `Browse ${data.label.toLowerCase()} emojis on EmojiQuick. Editorial baseline ranking.`,
    path: `/popular/${sort}`,
  });
}

export default async function PopularSortPage({ params }: PopularSortPageProps) {
  const { sort } = await params;
  if (!POPULAR_SORT_SLUGS.includes(sort as PopularSort)) {
    notFound();
  }
  const data = getPopularDiscovery(sort as PopularSort);
  return (
    <DiscoveryHubPage
      path={`/popular/${sort}`}
      title={`${data.label} Emojis`}
      description={`${data.label} emoji collection on EmojiQuick.`}
      eyebrow="Popular"
      kind="popular"
      sort={sort as PopularSort}
      links={[
        { href: "/popular", label: "Popular hub" },
        ...HUB_POPULAR_SORT_LINKS.filter((l) => l.href !== `/popular/${sort}`).map((l) => ({
          href: l.href,
          label: l.label,
        })),
        { href: "/trending", label: "Trending" },
        { href: "/explore", label: "Explore" },
      ]}
    />
  );
}
