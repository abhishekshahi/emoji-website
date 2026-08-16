import type { Metadata } from "next";
import Link from "next/link";
import { CategoryGrid } from "@/components/category/category-grid";
import { CategoryNav } from "@/components/category/category-nav";
import { DiscoverySection } from "@/components/discovery/discovery-section";
import { EmojiGrid } from "@/components/emoji/emoji-grid";
import { RecentlyUsedSection } from "@/components/home/recently-used-section";
import { SearchBar } from "@/components/search/search-bar";
import {
  getManifest,
  getNewEmojis,
} from "@/lib/emoji/data";
import { MASTER_IDENTITY_COUNT } from "@/lib/master/r2/catalog";
import { createPageMetadata } from "@/lib/seo/metadata";
import { SITE_DESCRIPTION } from "@/lib/site/config";

export const metadata: Metadata = createPageMetadata({
  title: "Find the Perfect Emoji",
  description: SITE_DESCRIPTION,
  path: "/",
});

export default function HomePage() {
  const newEmojis = getNewEmojis(12);
  const manifest = getManifest();

  return (
    <div className="page-shell space-y-14">
      <section className="card-surface overflow-hidden px-6 py-10 sm:px-10 sm:py-14">
        <div className="mx-auto max-w-3xl space-y-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent-strong">
            Unicode Emoji {manifest.emojiVersion}
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Find the Perfect Emoji
          </h1>
          <p className="text-lg text-muted">
            Search, copy, and discover emojis with meanings, Unicode details, keywords, variants, and OpenMoji artwork.
          </p>
          <div className="pt-2">
            <SearchBar size="hero" />
          </div>
        </div>
      </section>

      <RecentlyUsedSection />

      <DiscoverySection />

      <section className="space-y-4">
        <div>
          <h2 className="section-title">Categories</h2>
          <p className="section-subtitle">Browse by the official Unicode groups.</p>
        </div>
        <CategoryNav />
        <CategoryGrid />
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="section-title">OpenMoji Extras</h2>
            <p className="section-subtitle">
              Additional OpenMoji symbols beyond the standard Unicode emoji set.
            </p>
          </div>
          <Link href="/extras" className="pill-link">
            Browse extras
          </Link>
        </div>
        <div className="card-surface flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-semibold">Community-designed symbols</p>
            <p className="mt-1 text-sm text-muted">
              Brands, healthcare, climate, queer symbols, and more — licensed under CC BY-SA 4.0.
            </p>
          </div>
          <Link
            href="/extras"
            className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-on-accent transition hover:bg-accent-strong"
          >
            Explore OpenMoji Extras
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="section-title">Recently Added</h2>
            <p className="section-subtitle">Fresh emojis from the latest Unicode releases.</p>
          </div>
          <Link href="/new" className="pill-link">
            View all
          </Link>
        </div>
        <EmojiGrid emojis={newEmojis} pageSize={12} />
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="section-title">Browse All Emojis</h2>
            <p className="section-subtitle">
              Explore all {MASTER_IDENTITY_COUNT.toLocaleString()} emojis in the collection.
            </p>
          </div>
          <Link href="/emoji" className="pill-link">
            Open browser
          </Link>
        </div>
        <div className="card-surface flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-semibold">Ready to explore?</p>
            <p className="mt-1 text-sm text-muted">
              Jump into the full emoji browser with fast search and one-click copy.
            </p>
          </div>
          <Link
            href="/emoji"
            className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-on-accent transition hover:bg-accent-strong"
          >
            Browse all emojis
          </Link>
        </div>
      </section>
    </div>
  );
}
