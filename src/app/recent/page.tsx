import type { Metadata } from "next";
import { ClearRecentButton } from "@/components/emoji/clear-recent-button";
import { RecentGrid } from "@/components/emoji/stored-emoji-grid";
import { PageHeader } from "@/components/layout/page-header";

import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Recent Emojis",
  description: "Recently copied and viewed emojis stored locally in your browser.",
  path: "/recent",
  noIndex: true,
});

export default function RecentPage() {
  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow="Recent"
        title="Recently Used Emojis"
        description="Emojis you copied or opened recently on this device."
      />
      <div className="flex justify-end">
        <ClearRecentButton />
      </div>
      <RecentGrid />
    </div>
  );
}
