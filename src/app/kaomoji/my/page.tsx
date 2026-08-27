import type { Metadata } from "next";
import { KaomojiPersonalLibrary } from "@/components/kaomoji/kaomoji-personal-library";
import { PageHeader } from "@/components/layout/page-header";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "My Kaomoji Collections",
  description: "Your locally saved kaomoji favorites and personal collections. Stored in your browser only.",
  path: "/kaomoji/my",
  noIndex: true,
});

export default function KaomojiMyPage() {
  return (
    <div className="page-shell space-y-8 pb-12">
      <PageHeader
        eyebrow="Personal library"
        title="My Kaomoji"
        description="Favorites and custom collections saved locally in your browser."
      />
      <KaomojiPersonalLibrary />
    </div>
  );
}
