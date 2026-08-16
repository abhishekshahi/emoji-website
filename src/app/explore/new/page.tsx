import type { Metadata } from "next";
import { DiscoveryHubPage } from "@/components/hub/discovery-hub-page";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "New Emojis",
  description: "Recently added emoji identities on EmojiQuick.",
  path: "/explore/new",
});

export default function ExploreNewPage() {
  return (
    <DiscoveryHubPage
      path="/explore/new"
      title="New Emojis"
      description="Browse recently added emoji identities in the EmojiQuick catalog."
      eyebrow="Explore"
      kind="explore-new"
      links={[
        { href: "/explore", label: "Explore hub" },
        { href: "/trending", label: "Trending" },
        { href: "/new", label: "New page" },
        { href: "/popular", label: "Popular" },
      ]}
    />
  );
}
