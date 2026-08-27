import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildIntentPageTitle,
  CURATED_INTENT_SLUGS,
  isCuratedIntentSlug,
  isKaomojiDetailSlug,
  relatedIntentSlugs,
} from "@/lib/kaomoji/seo/intent-registry";
import { getMeaningPageContent, MEANING_PAGE_SLUGS } from "@/lib/kaomoji/seo/meaning-pages";
import { getIndexableSeoPages } from "@/lib/kaomoji/seo/sitemap-pages";
import { buildKaomojiCollectionJsonLd } from "@/lib/kaomoji/seo/structured-data";
import { getUseCasePageContent, USE_CASE_PAGE_SLUGS } from "@/lib/kaomoji/seo/use-case-pages";

describe("Step 11 — Kaomoji SEO & long-tail pages", () => {
  it("distinguishes detail slugs from intent slugs", () => {
    assert.equal(isKaomojiDetailSlug("kao-00013e7cc777f411"), true);
    assert.equal(isKaomojiDetailSlug("happy"), false);
    assert.equal(isCuratedIntentSlug("happy"), true);
    assert.equal(isCuratedIntentSlug("kao-00013e7cc777f411"), false);
  });

  it("builds unique intent page titles", () => {
    const t = buildIntentPageTitle("Happy");
    assert.match(t, /Happy Kaomoji/);
    assert.match(t, /Copy/);
  });

  it("curated intent list is bounded and non-empty", () => {
    assert.ok(CURATED_INTENT_SLUGS.length >= 10);
    assert.ok(CURATED_INTENT_SLUGS.length <= 25);
  });

  it("meaning pages map to intent slugs with content", () => {
    for (const slug of MEANING_PAGE_SLUGS) {
      const page = getMeaningPageContent(slug);
      assert.ok(page, slug);
      assert.ok(page!.intro.length > 40);
      assert.ok(page!.usage.length > 20);
    }
  });

  it("use-case pages have unique titles and intros", () => {
    const titles = new Set<string>();
    for (const slug of USE_CASE_PAGE_SLUGS) {
      const page = getUseCasePageContent(slug);
      assert.ok(page, slug);
      assert.ok(!titles.has(page!.title), `duplicate title ${page!.title}`);
      titles.add(page!.title);
    }
  });

  it("sitemap SEO pages exclude personal library", () => {
    const pages = getIndexableSeoPages();
    assert.ok(!pages.some((p) => p.path.includes("/my")));
    assert.ok(pages.some((p) => p.path === "/kaomoji/categories"));
    assert.ok(pages.some((p) => p.path === "/kaomoji/for/texting"));
  });

  it("collection JSON-LD uses canonical intent paths not query params", () => {
    const ld = buildKaomojiCollectionJsonLd("Happy", "happy", 100, "/kaomoji/happy");
    assert.equal(ld.url, "https://emojiquick.com/kaomoji/happy");
    assert.ok(!String(ld.url).includes("?"));
  });

  it("related intent slugs stay within curated set", () => {
    for (const slug of CURATED_INTENT_SLUGS) {
      for (const rel of relatedIntentSlugs(slug)) {
        assert.ok(isCuratedIntentSlug(rel), `${slug} -> ${rel}`);
      }
    }
  });

  it("does not register mass-generated intent slugs beyond curated list", () => {
    assert.ok(CURATED_INTENT_SLUGS.length <= 25);
    assert.ok(MEANING_PAGE_SLUGS.length <= 15);
    assert.ok(USE_CASE_PAGE_SLUGS.length <= 12);
  });
});
