import type { Metadata } from "next";
import { EmojiGrid } from "@/components/emoji/emoji-grid";
import { HubPopularSortNav } from "@/components/hub/hub-nav-sections";
import { PageHeader } from "@/components/layout/page-header";
import { getPopularEmojis } from "@/lib/emoji/data";

import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Popular Emojis",
  description: "Browse the most popular emojis with one-click copy and OpenMoji artwork.",
  path: "/popular",
});

export default function PopularPage() {
  const emojis = getPopularEmojis();

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow="Popular"
        title="Popular Emojis"
        description="A curated set of the emojis people use most often."
      />
      <HubPopularSortNav />
      <EmojiGrid emojis={emojis} />
    </div>
  );
}
