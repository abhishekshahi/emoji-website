import type { Metadata } from "next";
import { FavoritesGrid } from "@/components/emoji/stored-emoji-grid";
import { PageHeader } from "@/components/layout/page-header";

import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Favorite Emojis",
  description: "View your saved favorite emojis stored locally in your browser.",
  path: "/favorites",
  noIndex: true,
});

export default function FavoritesPage() {
  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow="Favorites"
        title="Your Favorite Emojis"
        description="Saved locally in your browser. No account required."
      />
      <FavoritesGrid />
    </div>
  );
}
