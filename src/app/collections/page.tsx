import type { Metadata } from "next";
import Link from "next/link";
import { HubLayout } from "@/components/hub/hub-layout";
import { listPublishedCollections } from "@/lib/content/collections/registry";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Emoji Collections",
  description: "Curated emoji collections for love, birthday, work, gaming, and more on EmojiQuick.",
  path: "/collections",
});

export default function CollectionsIndexPage() {
  const collections = listPublishedCollections();

  return (
    <HubLayout
      path="/collections"
      title="Emoji Collections"
      description="Curated editorial collections — quality over quantity. Each collection links to real emoji pages."
      eyebrow="Collections"
      links={[
        { href: "/topics", label: "Topics" },
        { href: "/combinations", label: "Combinations" },
      ]}
    >
      <p className="text-sm text-muted">
        These are curated editorial collections. Rankings and popularity labels remain POPULAR / CURATED until live analytics reach threshold.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {collections.map((collection) => (
          <Link
            key={collection.slug}
            href={`/collections/${collection.slug}`}
            className="card-surface flex flex-col gap-2 p-6 transition hover:border-accent"
          >
            <span className="font-semibold">{collection.title}</span>
            <span className="text-sm text-muted">{collection.description}</span>
            <span className="text-xs text-muted">{collection.emojiSlugs.length} emojis</span>
          </Link>
        ))}
      </div>
    </HubLayout>
  );
}
