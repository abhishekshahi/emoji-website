import { PLATFORM_PAGE_SLUGS } from "./registry";

export interface IndexablePlatformPage {
  readonly path: string;
  readonly kind: "index" | "platform" | "guide";
}

export function getIndexablePlatformPages(): IndexablePlatformPage[] {
  const pages: IndexablePlatformPage[] = [{ path: "/emoji/platforms", kind: "index" }];
  for (const slug of PLATFORM_PAGE_SLUGS) {
    pages.push({
      path: `/emoji/platforms/${slug}`,
      kind: slug === "emoji-vs-kaomoji" ? "guide" : "platform",
    });
  }
  return pages;
}
