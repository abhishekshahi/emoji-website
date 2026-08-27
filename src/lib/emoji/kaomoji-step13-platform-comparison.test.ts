import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPlatformPagePath,
  getPlatformPageGuide,
  isPlatformPageSlug,
  listPlatformPageGuides,
  OPEN_SOURCE_SAMPLE_SLUGS,
  PLATFORM_PAGE_SLUGS,
} from "@/lib/emoji/platforms/registry";
import { getIndexablePlatformPages } from "@/lib/emoji/platforms/sitemap-pages";
import { getProviderLabel } from "@/lib/emoji/platforms/resolve-provider-artwork";

describe("Step 13 — Platform emoji / kaomoji comparison", () => {
  it("platform page slugs are bounded and stable", () => {
    assert.ok(PLATFORM_PAGE_SLUGS.length >= 6);
    assert.ok(PLATFORM_PAGE_SLUGS.length <= 12);
    const slugs = new Set(PLATFORM_PAGE_SLUGS);
    assert.equal(slugs.size, PLATFORM_PAGE_SLUGS.length);
  });

  it("platform guides have unique titles and honest artwork flags", () => {
    const titles = new Set<string>();
    for (const guide of listPlatformPageGuides()) {
      assert.ok(guide.intro.length > 40, guide.slug);
      assert.ok(guide.renderingNotes.length > 30, guide.slug);
      assert.ok(!titles.has(guide.title), guide.title);
      titles.add(guide.title);
      if (guide.kind === "vendor" && !guide.artworkProxy) {
        assert.equal(guide.hasVerifiedArtwork, false, `${guide.slug} must not claim verified vendor artwork`);
      }
    }
  });

  it("vendor pages with artwork proxy map to open-source providers only", () => {
    const allowed = new Set(["noto", "fluent", "twemoji", "openmoji"]);
    for (const guide of listPlatformPageGuides()) {
      if (guide.artworkProxy) {
        assert.ok(allowed.has(guide.artworkProxy), guide.slug);
      }
    }
  });

  it("does not register mass platform-pair comparison slugs", () => {
    for (const slug of PLATFORM_PAGE_SLUGS) {
      if (slug === "emoji-vs-kaomoji") continue;
      assert.ok(!slug.includes("-vs-"), slug);
      assert.ok(!slug.includes("apple-vs"), slug);
    }
  });

  it("builds stable platform paths", () => {
    for (const slug of PLATFORM_PAGE_SLUGS) {
      assert.equal(buildPlatformPagePath(slug), `/emoji/platforms/${slug}`);
    }
  });

  it("sitemap includes platform index and guide pages", () => {
    const pages = getIndexablePlatformPages();
    assert.ok(pages.some((p) => p.path === "/emoji/platforms"));
    assert.ok(pages.some((p) => p.path === "/emoji/platforms/emoji-vs-kaomoji"));
    assert.ok(pages.some((p) => p.path === "/emoji/platforms/open-source-styles"));
    for (const slug of PLATFORM_PAGE_SLUGS) {
      assert.ok(pages.some((p) => p.path === `/emoji/platforms/${slug}`));
    }
  });

  it("emoji-vs-kaomoji guide explains distinction without artwork claims", () => {
    const guide = getPlatformPageGuide("emoji-vs-kaomoji");
    assert.ok(guide);
    assert.equal(guide!.hasVerifiedArtwork, false);
    assert.match(guide!.intro.toLowerCase(), /kaomoji/);
    assert.match(guide!.intro.toLowerCase(), /unicode/);
  });

  it("open-source sample slugs are finite", () => {
    assert.ok(OPEN_SOURCE_SAMPLE_SLUGS.length >= 4);
    assert.ok(OPEN_SOURCE_SAMPLE_SLUGS.length <= 8);
  });

  it("provider labels identify open-source provenance", () => {
    assert.match(getProviderLabel("noto"), /Noto/);
    assert.match(getProviderLabel("fluent"), /Fluent/);
    assert.ok(!getProviderLabel("noto").toLowerCase().includes("apple"));
  });

  it("related slugs resolve within registry", () => {
    for (const guide of listPlatformPageGuides()) {
      for (const rel of guide.relatedSlugs) {
        assert.ok(isPlatformPageSlug(rel), `${guide.slug} -> ${rel}`);
      }
    }
  });
});
