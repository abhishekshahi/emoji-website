import type { Metadata } from "next";
import Link from "next/link";
import { HubTopicsNav } from "@/components/hub/hub-nav-sections";
import { HubLayout } from "@/components/hub/hub-layout";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Emoji Topics",
  description: "Browse emoji topic collections on EmojiQuick.",
  path: "/topics",
});

export default function TopicsIndexPage() {
  return (
    <HubLayout path="/topics" title="Emoji Topics" description="Curated topic collections." eyebrow="Topics">
      <HubTopicsNav />
      <p className="text-sm text-muted">
        <Link href="/explore" className="text-accent-strong underline">Explore hub →</Link>
      </p>
    </HubLayout>
  );
}
