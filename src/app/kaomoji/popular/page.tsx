import type { Metadata } from "next";
import Link from "next/link";
import { KaomojiRankingSection } from "@/components/kaomoji/kaomoji-ranking-section";
import { rankingPageIntro } from "@/components/kaomoji/kaomoji-ranking-badge";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { getKaomojiMostCopiedRanking, getKaomojiPopularRanking } from "@/lib/kaomoji/cloudflare/d1-rankings";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Popular Kaomoji",
  description:
    "Discover popular kaomoji text faces. Rankings use real copy and activity signals when mature; otherwise editorial featured picks — never fabricated popularity counts.",
  path: "/kaomoji/popular",
});

export default async function KaomojiPopularPage() {
  const popular = await getKaomojiPopularRanking("30d", 24);
  const copied = await getKaomojiMostCopiedRanking("7d", 12);

  return (
    <div className="page-shell space-y-8 pb-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Popular Kaomoji",
          description: rankingPageIntro(popular),
          url: "https://emojiquick.com/kaomoji/popular",
        }}
      />
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Kaomoji", path: "/kaomoji" },
          { name: "Popular", path: "/kaomoji/popular" },
        ]}
      />
      <header className="space-y-3 max-w-3xl">
        <h1 className="text-3xl font-semibold">Popular Kaomoji</h1>
        <p className="text-muted">{rankingPageIntro(popular)}</p>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link href="/kaomoji/trending" className="chip">
            Trending
          </Link>
          <Link href="/kaomoji" className="chip">
            Kaomoji hub
          </Link>
        </nav>
      </header>

      <KaomojiRankingSection result={popular} headingId="kaomoji-popular-main" />
      {copied.items.length > 0 ? (
        <KaomojiRankingSection result={copied} headingId="kaomoji-popular-copied" />
      ) : null}
    </div>
  );
}
