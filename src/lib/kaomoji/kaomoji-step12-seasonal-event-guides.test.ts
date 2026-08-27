import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { usThanksgivingDate } from "@/lib/kaomoji/events/dates";
import {
  buildEventPagePath,
  EVENT_PAGE_SLUGS,
  getEventGuide,
  getEventTimingDisplay,
  getNearTermEvents,
  isEventPageSlug,
  listEventGuides,
} from "@/lib/kaomoji/events/registry";
import { isCuratedIntentSlug } from "@/lib/kaomoji/seo/intent-registry";
import { getIndexableSeoPages } from "@/lib/kaomoji/seo/sitemap-pages";
import { buildKaomojiEventCollectionJsonLd } from "@/lib/kaomoji/seo/structured-data";

describe("Step 12 — Kaomoji seasonal & event guides", () => {
  it("event slug registry is bounded and stable", () => {
    assert.ok(EVENT_PAGE_SLUGS.length >= 10);
    assert.ok(EVENT_PAGE_SLUGS.length <= 15);
    const slugs = new Set(EVENT_PAGE_SLUGS);
    assert.equal(slugs.size, EVENT_PAGE_SLUGS.length);
    for (const slug of EVENT_PAGE_SLUGS) {
      assert.match(slug, /^[a-z0-9-]+$/);
      assert.ok(!slug.includes("202"), `${slug} must not be year-stamped`);
    }
  });

  it("event guides have unique titles and required content", () => {
    const titles = new Set<string>();
    for (const guide of listEventGuides()) {
      assert.ok(guide.intro.length > 40, guide.slug);
      assert.ok(guide.usage.length > 30, guide.slug);
      assert.ok(guide.context.length > 20, guide.slug);
      assert.ok(!titles.has(guide.title), `duplicate title ${guide.title}`);
      titles.add(guide.title);
    }
  });

  it("intent slugs on event pages stay within curated set", () => {
    for (const guide of listEventGuides()) {
      for (const intent of guide.intentSlugs) {
        assert.ok(isCuratedIntentSlug(intent), `${guide.slug} -> ${intent}`);
      }
    }
  });

  it("related event slugs resolve within registry", () => {
    for (const guide of listEventGuides()) {
      for (const rel of guide.relatedEventSlugs) {
        assert.ok(isEventPageSlug(rel), `${guide.slug} -> ${rel}`);
      }
    }
  });

  it("builds stable event paths without year suffix", () => {
    for (const slug of EVENT_PAGE_SLUGS) {
      const path = buildEventPagePath(slug);
      assert.equal(path, `/kaomoji/events/${slug}`);
    }
  });

  it("thanksgiving date calculation for 2026", () => {
    const d = usThanksgivingDate(2026);
    assert.equal(d.getUTCMonth(), 10);
    assert.equal(d.getUTCDay(), 4);
    assert.equal(d.getUTCDate(), 26);
  });

  it("timing display avoids hardcoded stale years in URLs", () => {
    const guide = getEventGuide("christmas");
    assert.ok(guide);
    const timing = getEventTimingDisplay(guide!, new Date("2026-08-27T00:00:00Z"));
    assert.ok(timing);
    assert.match(timing!.detail, /December 25/);
    assert.match(timing!.detail, /2026/);
  });

  it("sitemap includes events index and event pages", () => {
    const pages = getIndexableSeoPages();
    assert.ok(pages.some((p) => p.path === "/kaomoji/events"));
    for (const slug of EVENT_PAGE_SLUGS) {
      assert.ok(pages.some((p) => p.path === `/kaomoji/events/${slug}`));
    }
    assert.ok(!pages.some((p) => p.path.includes("/my")));
  });

  it("event JSON-LD uses canonical event paths", () => {
    const ld = buildKaomojiEventCollectionJsonLd("Christmas kaomoji", "christmas", 12, "Festive faces");
    assert.equal(ld.url, "https://emojiquick.com/kaomoji/events/christmas");
  });

  it("near-term events returns only seasonal guides", () => {
    const near = getNearTermEvents(new Date("2026-12-01T00:00:00Z"), 4);
    assert.ok(near.length > 0);
    assert.ok(near.every((g) => g.kind === "seasonal"));
  });
});
