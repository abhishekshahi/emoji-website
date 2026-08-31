import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KaomojiHubRankings } from "@/components/kaomoji/kaomoji-hub-rankings";
import { KaomojiSearchPanel } from "@/components/kaomoji/kaomoji-search-panel";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { PRIMARY_LANGUAGE, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/content/localization/types";
import { kaomojiListingHreflangAlternates } from "@/lib/kaomoji/localization/paths";
import { getKaomojiUiStrings } from "@/lib/kaomoji/localization/registry";
import { kaomojiDataExists } from "@/lib/kaomoji/product/loader";
import { createPageMetadata } from "@/lib/seo/metadata";

// The locale is carried in the shared root-level `[slug]` dynamic segment so it
// does not collide with the sibling `[slug]` content-platform route. URLs stay `/{locale}/kaomoji`.
interface PageProps {
  params: Promise<{ slug: string }>;
}

const LOCALIZED_LOCALES = SUPPORTED_LANGUAGES.filter((l) => l !== PRIMARY_LANGUAGE);

export function generateStaticParams() {
  return LOCALIZED_LOCALES.map((locale) => ({ slug: locale }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: locale } = await params;
  if (!LOCALIZED_LOCALES.includes(locale as SupportedLanguage)) return { title: "Kaomoji" };
  const lang = locale as SupportedLanguage;
  const ui = getKaomojiUiStrings(lang);
  return createPageMetadata({
    title: `Kaomoji — ${locale.toUpperCase()}`,
    description: ui.searchPlaceholder,
    path: `/${locale}/kaomoji`,
  });
}

export default async function LocalizedKaomojiHubPage({ params }: PageProps) {
  const { slug: locale } = await params;
  if (!LOCALIZED_LOCALES.includes(locale as SupportedLanguage)) notFound();
  if (!kaomojiDataExists()) notFound();

  const lang = locale as SupportedLanguage;
  const ui = getKaomojiUiStrings(lang);
  const alternates = kaomojiListingHreflangAlternates();

  return (
    <div className="page-shell space-y-8 pb-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: `Kaomoji (${locale})`,
          url: `https://emojiquick.com/${locale}/kaomoji`,
        }}
      />
      {alternates.map((alt) => (
        <link key={alt.hreflang} rel="alternate" hrefLang={alt.hreflang} href={alt.href} />
      ))}
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Kaomoji", path: `/${locale}/kaomoji` },
        ]}
      />
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold">Kaomoji</h1>
        <p className="text-muted">{ui.searchPlaceholder}</p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/kaomoji/search?locale=${locale}`} className="chip">
            Search
          </Link>
          <Link href="/kaomoji" className="chip">
            English hub
          </Link>
        </div>
      </header>
      <KaomojiSearchPanel initialLocale={lang} ui={ui} />
      <KaomojiHubRankings />
    </div>
  );
}
