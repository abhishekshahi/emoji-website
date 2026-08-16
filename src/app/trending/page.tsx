import type { Metadata } from "next";
import Link from "next/link";
import { DiscoveryHubPage } from "@/components/hub/discovery-hub-page";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Trending Emojis",
  description: "Trending emoji collections on EmojiQuick — today, this week, and this month.",
  path: "/trending",
});

export default function TrendingIndexPage() {
  return (
    <DiscoveryHubPage
      path="/trending"
      title="Trending Emojis"
      description="Browse trending emoji collections by time period. Rankings use an editorial baseline."
      eyebrow="Trending"
      kind="trending-hub"
      links={[
        { href: "/trending/today", label: "Today" },
        { href: "/trending/week", label: "This week" },
        { href: "/trending/month", label: "This month" },
        { href: "/explore", label: "Explore" },
        { href: "/popular", label: "Popular" },
      ]}
    />
  );
}
