import type { Metadata } from "next";
import Link from "next/link";
import { CategoryGrid } from "@/components/category/category-grid";
import { CategoryNav } from "@/components/category/category-nav";
import { DiscoverySection } from "@/components/discovery/discovery-section";
import { EmojiGrid } from "@/components/emoji/emoji-grid";
import { RecentlyUsedSection } from "@/components/home/recently-used-section";
import { SearchBar } from "@/components/search/search-bar";
import { SectionHeader } from "@/components/ui/section-header";
import { ChipLink } from "@/components/ui/chip";
import { getManifest, getNewEmojis } from "@/lib/emoji/data";
import { createPageMetadata } from "@/lib/seo/metadata";
import { SITE_DESCRIPTION } from "@/lib/site/config";
import { MOOD_CHIPS, QUICK_SEARCHES } from "@/lib/ui/discovery-chips";

export const metadata: Metadata = createPageMetadata({
  title: "Find the Perfect Emoji",
  description: SITE_DESCRIPTION,
  path: "/",
});

export default function HomePage() {
  const newEmojis = getNewEmojis(12);
  const manifest = getManifest();

  return (
    <div className="page-shell home-page space-y-12">
      {/* HERO — search + immediate discovery chips */}
      <section className="hero-section">
        <div className="hero-section__glow" aria-hidden="true" />
        <div className="hero-section__inner mx-auto max-w-3xl space-y-5 text-center">
          <p className="section-header__eyebrow">
            Unicode Emoji {manifest.emojiVersion}
          </p>
          <h1 className="text-display">Find the perfect emoji</h1>
          <p className="text-lead mx-auto max-w-xl">
            Search by name, keyword, or Unicode. Copy instantly — no account
            needed.
          </p>
          <SearchBar size="hero" />
          <div className="space-y-2 pt-1">
            <div className="flex flex-wrap justify-center gap-2">
              <span className="w-full text-xs font-semibold uppercase tracking-wide text-muted sm:w-auto">
                Popular:
              </span>
              {QUICK_SEARCHES.map((item) => (
                <ChipLink
                  key={item.query}
                  href={`/search?q=${encodeURIComponent(item.query)}`}
                >
                  <span aria-hidden="true">{item.emoji}</span>
                  {item.label}
                </ChipLink>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <span className="w-full text-xs font-semibold uppercase tracking-wide text-muted sm:w-auto">
                Moods:
              </span>
              {MOOD_CHIPS.map((mood) => (
                <ChipLink
                  key={mood.query}
                  href={`/search?q=${encodeURIComponent(mood.query)}`}
                  variant="outline"
                >
                  <span aria-hidden="true">{mood.emoji}</span>
                  {mood.label}
                </ChipLink>
              ))}
            </div>
          </div>
        </div>
      </section>

      <RecentlyUsedSection />

      {/* TRENDING / POPULAR / CONTEXT */}
      <DiscoverySection />

      {/* CATEGORIES + artwork styles + extras — contextual exploration */}
      <section className="space-y-4">
        <SectionHeader
          title="Browse emojis"
          description="Official Unicode groups, artwork styles, and community extras."
          action={{ href: "/emoji", label: "Open browser" }}
        />
        <CategoryNav />
        <CategoryGrid />
        <div className="flex flex-wrap gap-2 pt-2">
          <span className="w-full text-xs font-semibold uppercase tracking-wide text-muted">
            Artwork styles
          </span>
          {[
            { href: "/styles/noto", label: "Noto" },
            { href: "/styles/fluent", label: "Fluent" },
            { href: "/styles/openmoji", label: "OpenMoji" },
            { href: "/styles/twemoji", label: "Twemoji" },
          ].map((style) => (
            <ChipLink key={style.href} href={style.href} variant="outline">
              {style.label}
            </ChipLink>
          ))}
          <ChipLink href="/extras" variant="outline">
            OpenMoji Extras
          </ChipLink>
        </div>
      </section>

      {/* RECENTLY ADDED */}
      <section className="space-y-4">
        <SectionHeader
          title="Recently added"
          description="Fresh emojis from the latest Unicode releases."
          action={{ href: "/new", label: "View all" }}
        />
        <EmojiGrid emojis={newEmojis} pageSize={12} />
      </section>
    </div>
  );
}
