import { CURATED_INTENT_SLUGS } from "./intent-registry";
import { MEANING_PAGE_SLUGS } from "./meaning-pages";
import { USE_CASE_PAGE_SLUGS } from "./use-case-pages";
import { EVENT_PAGE_SLUGS } from "../events/registry";

export interface IndexableSeoPage {
  readonly path: string;
  readonly kind: "intent" | "meaning" | "use-case" | "index" | "event";
}

/** Indexable SEO surface — runtime pages still gate on minimum public record counts. */
export function getIndexableSeoPages(): IndexableSeoPage[] {
  const pages: IndexableSeoPage[] = [
    { path: "/kaomoji/categories", kind: "index" },
    { path: "/kaomoji/collections", kind: "index" },
    { path: "/kaomoji/events", kind: "index" },
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

  for (const slug of EVENT_PAGE_SLUGS) {
    pages.push({ path: `/kaomoji/events/${slug}`, kind: "event" });
  }

  return pages;
}
