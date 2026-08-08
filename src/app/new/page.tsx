import type { Metadata } from "next";
import { EmojiGrid } from "@/components/emoji/emoji-grid";
import { PageHeader } from "@/components/layout/page-header";
import { getNewEmojis } from "@/lib/emoji/data";

import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "New Emojis",
  description: "Discover the newest emojis from recent Unicode releases.",
  path: "/new",
});

export default function NewEmojisPage() {
  const emojis = getNewEmojis(48);

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow="New"
        title="Recently Added Emojis"
        description="The latest additions from recent Unicode emoji versions."
      />
      <EmojiGrid emojis={emojis} />
    </div>
  );
}
