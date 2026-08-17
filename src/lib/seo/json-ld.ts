import { absoluteUrl } from "@/lib/seo/metadata";
import { BRAND_LOGO_UI, BRAND_OG_IMAGE } from "@/lib/site/brand";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site/config";

export interface BreadcrumbItem {
  name: string;
  path: string;
}

/** Site-wide Organization + WebSite JSON-LD with official logo (Phase 8.63). */
export function buildSiteOrganizationJsonLd() {
  const siteUrl = absoluteUrl("/");
  const logoUrl = absoluteUrl(BRAND_LOGO_UI);
  const ogImageUrl = absoluteUrl(BRAND_OG_IMAGE);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}#organization`,
        name: SITE_NAME,
        url: siteUrl,
        logo: {
          "@type": "ImageObject",
          url: logoUrl,
          contentUrl: logoUrl,
          name: `${SITE_NAME} logo`,
        },
        image: ogImageUrl,
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}#website`,
        name: SITE_NAME,
        url: siteUrl,
        description: SITE_DESCRIPTION,
        publisher: { "@id": `${siteUrl}#organization` },
        inLanguage: "en-US",
      },
    ],
  };
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function buildEmojiPageJsonLd({
  name,
  emoji,
  slug,
  description,
  artworkPath,
  categoryLabel,
  categoryId,
}: {
  name: string;
  emoji: string;
  slug: string;
  description: string;
  codePointString: string;
  artworkPath: string | null;
  categoryLabel: string;
  categoryId: string;
}) {
  const pageUrl = absoluteUrl(`/emoji/${slug}`);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": pageUrl,
        url: pageUrl,
        name: `${name} ${emoji}`,
        description,
        isPartOf: {
          "@type": "WebSite",
          name: SITE_NAME,
          url: absoluteUrl("/"),
        },
        ...(artworkPath
          ? {
              primaryImageOfPage: {
                "@type": "ImageObject",
                url: absoluteUrl(artworkPath),
                contentUrl: absoluteUrl(artworkPath),
                name: `${name} emoji artwork`,
              },
            }
          : {}),
      },
      buildBreadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: categoryLabel, path: `/category/${categoryId}` },
        { name: `${name} ${emoji}`, path: `/emoji/${slug}` },
      ]),
    ],
  };
}
