import type { MetadataRoute } from "next";
import { getAllCategorySlugs, getManifest } from "@/lib/emoji/data";
import { getOpenMojiExtrasManifest } from "@/lib/emoji/extras-data";
import { getActiveEmojiSitemapSlugs } from "@/lib/master/integration/seo-canary/active-migration";
import { getIndexableEmojiPageSlugs } from "@/lib/master/public/identity-slug-map";
import { getHubPagePaths } from "@/lib/hub/hub-routes";
import { listPosts } from "@/lib/content/editorial/registry";
import { listPublishedCombinations } from "@/lib/content/combinations/registry";
import { listPublishedCollections } from "@/lib/content/collections/registry";
import { listPublishedLocalizedPages } from "@/lib/content/localization/published-pages";
import { filterPublishableLocalizedPages } from "@/lib/content/localization/publication";
import { localizedEmojiPath, type SupportedLanguage } from "@/lib/content/localization/types";
import { canonicalUrl } from "@/lib/seo/metadata";
import { getAllPublicSlugs, getIndexableSlugs, kaomojiDataExists, loadCollections } from "@/lib/kaomoji/product/loader";
import { getIndexableSeoPages } from "@/lib/kaomoji/seo/sitemap-pages";
import { getIndexablePlatformPages } from "@/lib/emoji/platforms/sitemap-pages";

export default function sitemap(): MetadataRoute.Sitemap {
  const manifest = getManifest();
  const extrasManifest = getOpenMojiExtrasManifest();
  const generatedAt = new Date(
    Math.max(
      new Date(manifest.generatedAt).getTime(),
      new Date(extrasManifest.generatedAt).getTime(),
    ),
  );

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: canonicalUrl("/"),
      lastModified: generatedAt,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: canonicalUrl("/emoji"),
      lastModified: generatedAt,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: canonicalUrl("/emoji/platforms"),
      lastModified: generatedAt,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: canonicalUrl("/extras"),
      lastModified: generatedAt,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: canonicalUrl("/popular"),
      lastModified: generatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: canonicalUrl("/new"),
      lastModified: generatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: canonicalUrl("/search"),
      lastModified: generatedAt,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: canonicalUrl("/licenses"),
      lastModified: generatedAt,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const categoryPages: MetadataRoute.Sitemap = getAllCategorySlugs().map(
    (category) => ({
      url: canonicalUrl(`/category/${category}`),
      lastModified: generatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }),
  );

  const emojiPages: MetadataRoute.Sitemap = getActiveEmojiSitemapSlugs(getIndexableEmojiPageSlugs()).map(
    (slug) => ({
      url: canonicalUrl(`/emoji/${slug}`),
      lastModified: generatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }),
  );

  const hubPages: MetadataRoute.Sitemap = getHubPagePaths().map((path) => ({
    url: canonicalUrl(path),
    lastModified: generatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.75,
  }));

  const contentPages: MetadataRoute.Sitemap = [
    ...listPosts().map((post) => ({
      url: canonicalUrl(`/blog/${post.slug}`),
      lastModified: new Date(post.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...listPublishedCombinations().map((combo) => ({
      url: canonicalUrl(`/combinations/${combo.slug}`),
      lastModified: new Date(combo.provenance.lastUpdated),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    {
      url: canonicalUrl("/combinations/generator"),
      lastModified: generatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.55,
    },
    ...listPublishedCollections().map((collection) => ({
      url: canonicalUrl(`/collections/${collection.slug}`),
      lastModified: new Date(collection.provenance.lastUpdated),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...filterPublishableLocalizedPages(listPublishedLocalizedPages()).map((page) => ({
      url: canonicalUrl(localizedEmojiPath(page.language as SupportedLanguage, page.slug)),
      lastModified: generatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.55,
    })),
  ];

  const kaomojiPages: MetadataRoute.Sitemap = kaomojiDataExists()
    ? [
        {
          url: canonicalUrl("/kaomoji"),
          lastModified: generatedAt,
          changeFrequency: "weekly" as const,
          priority: 0.85,
        },
        {
          url: canonicalUrl("/kaomoji/popular"),
          lastModified: generatedAt,
          changeFrequency: "weekly" as const,
          priority: 0.8,
        },
        {
          url: canonicalUrl("/kaomoji/trending"),
          lastModified: generatedAt,
          changeFrequency: "weekly" as const,
          priority: 0.8,
        },
        {
          url: canonicalUrl("/kaomoji/search"),
          lastModified: generatedAt,
          changeFrequency: "weekly" as const,
          priority: 0.82,
        },
        {
          url: canonicalUrl("/kaomoji/categories"),
          lastModified: generatedAt,
          changeFrequency: "weekly" as const,
          priority: 0.8,
        },
        {
          url: canonicalUrl("/kaomoji/collections"),
          lastModified: generatedAt,
          changeFrequency: "weekly" as const,
          priority: 0.8,
        },
        ...getIndexablePlatformPages()
          .filter((p) => p.kind !== "index")
          .map((p) => ({
            url: canonicalUrl(p.path),
            lastModified: generatedAt,
            changeFrequency: "monthly" as const,
            priority: p.kind === "guide" ? 0.72 : 0.7,
          })),
        ...getIndexableSeoPages()
          .filter((p) => p.kind !== "index")
          .map((p) => ({
            url: canonicalUrl(p.path),
            lastModified: generatedAt,
            changeFrequency: "weekly" as const,
            priority: p.kind === "intent" ? 0.78 : p.kind === "meaning" ? 0.72 : p.kind === "event" ? 0.76 : 0.74,
          })),
        ...(["hi", "es", "fr", "de", "pt", "it", "ja", "ko", "zh", "ar"] as const).map((locale) => ({
          url: canonicalUrl(`/${locale}/kaomoji`),
          lastModified: generatedAt,
          changeFrequency: "weekly" as const,
          priority: 0.78,
        })),
        ...loadCollections().map((c) => ({
          url: canonicalUrl(`/kaomoji/collections/${c.slug}/page/1`),
          lastModified: generatedAt,
          changeFrequency: "weekly" as const,
          priority: 0.7,
        })),
        ...getIndexableSlugs(1000).map((slug) => ({
          url: canonicalUrl(`/kaomoji/${slug}`),
          lastModified: generatedAt,
          changeFrequency: "monthly" as const,
          priority: 0.65,
        })),
      ]
    : [];

  return [...staticPages, ...hubPages, ...contentPages, ...categoryPages, ...emojiPages, ...kaomojiPages];
}
