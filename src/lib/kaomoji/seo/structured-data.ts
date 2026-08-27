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

export function buildKaomojiCollectionJsonLd(label: string, slug: string, itemCount: number, path?: string) {
  const pagePath = path ?? `/kaomoji/${slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${label} Kaomoji`,
    url: `${SITE_ORIGIN}${pagePath}`,
    description: `Browse ${itemCount.toLocaleString()} ${label.toLowerCase()} kaomoji on EmojiQuick.`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: itemCount,
      itemListOrder: "https://schema.org/ItemListOrderDescending",
    },
  };
}

export function buildKaomojiIntentBreadcrumbJsonLd(label: string, slug: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_ORIGIN },
      { "@type": "ListItem", position: 2, name: "Kaomoji", item: `${SITE_ORIGIN}/kaomoji` },
      { "@type": "ListItem", position: 3, name: `${label} Kaomoji`, item: `${SITE_ORIGIN}/kaomoji/${slug}` },
    ],
  };
}

export function buildKaomojiDefinedTermJsonLd(name: string, description: string, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name,
    description,
    url: `${SITE_ORIGIN}${path}`,
    inDefinedTermSet: { "@type": "DefinedTermSet", name: "Kaomoji Meanings", url: `${SITE_ORIGIN}/kaomoji/categories` },
  };
}

export function buildKaomojiHreflangLinkTags(slug: string) {
  return kaomojiHreflangAlternates(slug).map((alt) => ({
    rel: "alternate" as const,
    hrefLang: alt.hreflang,
    href: alt.href,
  }));
}

export function buildKaomojiEventBreadcrumbJsonLd(eventLabel: string, slug: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_ORIGIN },
      { "@type": "ListItem", position: 2, name: "Kaomoji", item: `${SITE_ORIGIN}/kaomoji` },
      { "@type": "ListItem", position: 3, name: "Events", item: `${SITE_ORIGIN}/kaomoji/events` },
      { "@type": "ListItem", position: 4, name: eventLabel, item: `${SITE_ORIGIN}/kaomoji/events/${slug}` },
    ],
  };
}

export function buildKaomojiEventCollectionJsonLd(name: string, slug: string, itemCount: number, description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    url: `${SITE_ORIGIN}/kaomoji/events/${slug}`,
    description,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: itemCount,
      itemListOrder: "https://schema.org/ItemListOrderDescending",
    },
  };
}
