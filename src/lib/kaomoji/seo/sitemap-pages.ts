import { CURATED_INTENT_SLUGS } from "./intent-registry";
import { MEANING_PAGE_SLUGS } from "./meaning-pages";
import { USE_CASE_PAGE_SLUGS } from "./use-case-pages";

export interface IndexableSeoPage {
  readonly path: string;
  readonly kind: "intent" | "meaning" | "use-case" | "index";
}

/** Indexable SEO surface — runtime pages still gate on minimum public record counts. */
export function getIndexableSeoPages(): IndexableSeoPage[] {
  const pages: IndexableSeoPage[] = [
    { path: "/kaomoji/categories", kind: "index" },
    { path: "/kaomoji/collections", kind: "index" },
  ];

  for (const slug of CURATED_INTENT_SLUGS) {
    pages.push({ path: `/kaomoji/${slug}`, kind: "intent" });
  }

  for (const slug of MEANING_PAGE_SLUGS) {
    pages.push({ path: `/kaomoji/meaning/${slug}`, kind: "meaning" });
  }

  for (const slug of USE_CASE_PAGE_SLUGS) {
    pages.push({ path: `/kaomoji/for/${slug}`, kind: "use-case" });
  }

  return pages;
}
