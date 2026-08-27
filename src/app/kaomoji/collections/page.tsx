import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { kaomojiDataExists, loadCollections } from "@/lib/kaomoji/product/loader";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Kaomoji Collections — Curated Editorial Lists",
  description:
    "EmojiQuick editorial kaomoji collections: cute, love, happy, anime, Discord, Instagram, and more. Copy curated text faces.",
  path: "/kaomoji/collections",
});

export default function KaomojiCollectionsIndexPage() {
  const collections = kaomojiDataExists() ? loadCollections() : [];

  return (
    <div className="page-shell space-y-8 pb-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Kaomoji Collections",
          url: "https://emojiquick.com/kaomoji/collections",
          description: "Curated EmojiQuick editorial kaomoji collections.",
        }}
      />
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Kaomoji", path: "/kaomoji" },
          { name: "Collections", path: "/kaomoji/collections" },
        ]}
      />
      <header className="space-y-3 max-w-3xl">
        <h1 className="text-3xl font-bold">Kaomoji collections</h1>
        <p className="text-muted">
          Editorial collections curated by EmojiQuick — distinct from your personal saved library. Each collection uses
          quality and taxonomy rules to surface copy-ready public kaomoji.
        </p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {collections.map((c) => (
          <li key={c.slug} className="rounded-xl border border-border p-4 space-y-2">
            <Link href={`/kaomoji/collections/${c.slug}/page/1`} className="text-lg font-semibold hover:underline">
              {c.title}
            </Link>
            <p className="text-sm text-muted">{c.description}</p>
            <p className="text-xs text-muted">{c.canonical_ids.length} kaomoji</p>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">
        Personal favorites live in{" "}
        <Link href="/kaomoji/my" className="underline">
          My Kaomoji
        </Link>{" "}
        (saved locally, not indexed).
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/kaomoji/categories" className="pill-link">
          Browse categories
        </Link>
        <Link href="/kaomoji" className="pill-link">
          Kaomoji hub
        </Link>
      </div>
    </div>
  );
}
