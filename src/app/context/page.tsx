import type { Metadata } from "next";
import { HubContextNav } from "@/components/hub/hub-nav-sections";
import { HubLayout } from "@/components/hub/hub-layout";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Emoji Context Collections",
  description: "Emoji picks for Instagram, Discord, TikTok, and more on EmojiQuick.",
  path: "/context",
});

export default function ContextIndexPage() {
  return (
    <HubLayout path="/context" title="Emoji Context" description="Curated emoji picks for apps and situations." eyebrow="Context">
      <HubContextNav />
    </HubLayout>
  );
}
