import type { Metadata } from "next";
import Link from "next/link";
import { KaomojiSearchPanel } from "@/components/kaomoji/kaomoji-search-panel";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { getKaomojiUiStrings } from "@/lib/kaomoji/localization/registry";
import { parseKaomojiSearchLocale } from "@/lib/kaomoji/localization/search-terms";
import { createPageMetadata } from "@/lib/seo/metadata";

const PAGE_DESCRIPTION =
  "Search kaomoji in English, Hindi, Spanish, French, German, Portuguese, Italian, Japanese, Korean, Chinese, and Arabic using verified taxonomy mappings.";

export const metadata: Metadata = createPageMetadata({
  title: "Search Kaomoji",
  description: PAGE_DESCRIPTION,
  path: "/kaomoji/search",
});

interface PageProps {
  searchParams: Promise<{ q?: string; locale?: string; lang?: string }>;
}

export default async function KaomojiSearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialQuery = params.q?.trim() ?? "";
  const localeHint = parseKaomojiSearchLocale(params.locale ?? params.lang);
  const uiLocale = localeHint === "auto" ? "en" : localeHint;
  const ui = getKaomojiUiStrings(uiLocale);

  return (
    <div className="page-shell space-y-8 pb-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Search Kaomoji",
          description: PAGE_DESCRIPTION,
          url: "https://emojiquick.com/kaomoji/search",
        }}
      />
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Kaomoji", path: "/kaomoji" },
          { name: "Search", path: "/kaomoji/search" },
        ]}
      />
      <header className="space-y-3 max-w-3xl">
        <h1 className="text-3xl font-semibold">Search Kaomoji</h1>
        <p className="text-muted">
          Multilingual search uses verified term mappings to the English taxonomy. Auto-detects script where possible.
          English meanings on detail pages remain authoritative when localized text is unavailable.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/kaomoji" className="chip">
            Kaomoji hub
          </Link>
          <Link href="/kaomoji/popular" className="chip">
            Popular
          </Link>
          <Link href="/kaomoji/trending" className="chip">
            Trending
          </Link>
        </div>
      </header>
      <KaomojiSearchPanel initialQuery={initialQuery} initialLocale={localeHint} ui={ui} />
    </div>
  );
}
