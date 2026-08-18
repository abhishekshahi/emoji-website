import type { PublishedLocalizedPage } from "./published-pages";
import { scoreLocalizedPageQuality } from "./multilingual-coverage";

/** Minimum quality gate before sitemap/index inclusion (Part 19). */
export function isPublishableLocalizedPage(page: PublishedLocalizedPage): boolean {
  const { score, englishLeakage } = scoreLocalizedPageQuality(
    page.localizedTitle,
    page.localizedDescription,
  );
  return (
    page.localizedTitle.trim().length >= 2 &&
    page.localizedDescription.trim().length >= 8 &&
    score >= 55 &&
    !englishLeakage
  );
}

export function filterPublishableLocalizedPages(
  pages: readonly PublishedLocalizedPage[],
): readonly PublishedLocalizedPage[] {
  return pages.filter(isPublishableLocalizedPage);
}
