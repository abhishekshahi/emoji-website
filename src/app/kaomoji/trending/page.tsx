import type { Metadata } from "next";
import Link from "next/link";
import { KaomojiRankingSection } from "@/components/kaomoji/kaomoji-ranking-section";
import { rankingPageIntro } from "@/components/kaomoji/kaomoji-ranking-badge";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { getKaomojiRisingRanking, getKaomojiTrendingRanking } from "@/lib/kaomoji/cloudflare/d1-rankings";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Trending Kaomoji",
  description:
    "See trending and rising kaomoji text faces based on recent real activity — never fabricated popularity counts.",
  path: "/kaomoji/trending",
});

export default async function KaomojiTrendingPage() {
  const trending = await getKaomojiTrendingRanking(24);
  const rising = await getKaomojiRisingRanking(12);

  return (
    <div className="page-shell space-y-8 pb-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Trending Kaomoji",
          description: rankingPageIntro(trending),
          url: "https://emojiquick.com/kaomoji/trending",
        }}
      />
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Kaomoji", path: "/kaomoji" },
          { name: "Trending", path: "/kaomoji/trending" },
        ]}
      />
      <header className="space-y-3 max-w-3xl">
        <h1 className="text-3xl font-semibold">Trending Kaomoji</h1>
        <p className="text-muted">{rankingPageIntro(trending)}</p>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link href="/kaomoji/popular" className="chip">
            Popular
          </Link>
          <Link href="/kaomoji" className="chip">
            Kaomoji hub
          </Link>
        </nav>
      </header>

      <KaomojiRankingSection result={trending} headingId="kaomoji-trending-main" />
      {rising.items.length > 0 && rising.status === "LIVE" ? (
        <KaomojiRankingSection result={rising} headingId="kaomoji-trending-rising" />
      ) : null}
    </div>
  );
}
