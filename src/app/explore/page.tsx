import type { Metadata } from "next";
import { DiscoveryHubPage } from "@/components/hub/discovery-hub-page";
import { HUB_TOPIC_LINKS } from "@/lib/hub/hub-navigation";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Explore Emojis",
  description: "Explore emoji collections, topics, contexts, and styles on EmojiQuick.",
  path: "/explore",
});

export default function ExploreIndexPage() {
  return (
    <DiscoveryHubPage
      path="/explore"
      title="Explore Emojis"
      description="Discover emoji collections by topic, context, style, and popularity."
      eyebrow="Explore"
      kind="explore"
      links={[
        { href: "/explore/new", label: "New emojis" },
        { href: "/trending", label: "Trending" },
        { href: "/popular", label: "Popular" },
        { href: "/styles", label: "Artwork styles" },
        ...HUB_TOPIC_LINKS.slice(0, 4).map((t) => ({ href: t.href, label: t.label })),
      ]}
    />
  );
}
