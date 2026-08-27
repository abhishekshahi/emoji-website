import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/seo/metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/emoji/", "/category/", "/kaomoji/", "/popular", "/new", "/search", "/licenses", "/extras"],
        disallow: ["/favorites", "/recent", "/kaomoji/my", "/api/*", "/catalog/", "/developers/"],
      },
    ],
    sitemap: canonicalUrl("/sitemap.xml"),
  };
}
