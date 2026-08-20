import type { Metadata } from "next";
import { BrowseEmojiGrid } from "@/components/emoji/browse-emoji-grid";
import { PageHeader } from "@/components/layout/page-header";
import { createPageMetadata } from "@/lib/seo/metadata";
import { MASTER_IDENTITY_COUNT } from "@/lib/master/r2/catalog";

export const metadata: Metadata = createPageMetadata({
  title: "Browse Emojis",
  description:
    "Browse the complete emoji collection with OpenMoji artwork, one-click copy, and favorites.",
  path: "/emoji",
});

export default function EmojiBrowsePage() {
  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow="Browse"
        title="All Emojis"
        description={`Explore ${MASTER_IDENTITY_COUNT.toLocaleString()} emojis with pagination and instant copy.`}
      />
      <BrowseEmojiGrid />
    </div>
  );
}
