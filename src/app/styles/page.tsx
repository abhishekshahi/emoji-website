import type { Metadata } from "next";
import { StyleHubPage } from "@/components/hub/style-hub-page";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Emoji Artwork Styles",
  description: "Compare Noto, Fluent, OpenMoji, and Twemoji artwork styles on EmojiQuick.",
  path: "/styles",
});

export default function StylesIndexPage() {
  return <StyleHubPage />;
}
