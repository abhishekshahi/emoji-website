import type { MetadataRoute } from "next";
import { BRAND_PWA_ICONS } from "@/lib/site/brand";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1B63D8",
    icons: BRAND_PWA_ICONS.map((icon) => ({
      src: icon.src,
      sizes: icon.sizes,
      type: icon.type,
      purpose: icon.purpose,
    })),
  };
}