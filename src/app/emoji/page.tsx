import type { Metadata } from "next";
import { BrowseEmojiGrid } from "@/components/emoji/browse-emoji-grid";
import { PageHeader } from "@/components/layout/page-header";
import { getManifest } from "@/lib/emoji/data";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Browse Emojis",
  description:
    "Browse the complete emoji collection with OpenMoji artwork, one-click copy, and favorites.",
  path: "/emoji",
});

export default function EmojiBrowsePage() {
  const manifest = getManifest();

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow="Browse"
        title="All Emojis"
        description={`Explore ${manifest.recordCount.toLocaleString()} emojis with pagination and instant copy.`}
      />
      <BrowseEmojiGrid />
    </div>
  );
}
