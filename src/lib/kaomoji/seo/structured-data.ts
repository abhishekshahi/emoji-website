import type { KaomojiEditorialRecord } from "../processing/phase9/types";
import { kaomojiHreflangAlternates } from "../localization/paths";

const SITE_ORIGIN = "https://emojiquick.com";

export function buildKaomojiWebPageJsonLd(record: KaomojiEditorialRecord) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: record.seo_title,
    description: record.seo_description,
    url: `${SITE_ORIGIN}/kaomoji/${record.slug}`,
    inLanguage: "en",
    isPartOf: { "@type": "WebSite", name: "EmojiQuick", url: SITE_ORIGIN },
  };
}

export function buildKaomojiBreadcrumbJsonLd(record: KaomojiEditorialRecord) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_ORIGIN },
      { "@type": "ListItem", position: 2, name: "Kaomoji", item: `${SITE_ORIGIN}/kaomoji` },
      { "@type": "ListItem", position: 3, name: record.editorial_name ?? record.accessible_name, item: `${SITE_ORIGIN}/kaomoji/${record.slug}` },
    ],
  };
}

export function buildKaomojiCollectionJsonLd(label: string, slug: string, itemCount: number) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${label} Kaomoji`,
    url: `${SITE_ORIGIN}/kaomoji?category=${slug}`,
    description: `Browse ${itemCount.toLocaleString()} ${label.toLowerCase()} kaomoji on EmojiQuick.`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: itemCount,
      itemListOrder: "https://schema.org/ItemListOrderDescending",
    },
  };
}

export function buildKaomojiHreflangLinkTags(slug: string) {
  return kaomojiHreflangAlternates(slug).map((alt) => ({
    rel: "alternate" as const,
    hrefLang: alt.hreflang,
    href: alt.href,
  }));
}
