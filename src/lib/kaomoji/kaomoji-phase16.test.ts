import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { assessKaomojiIndexability, countIndexableKaomoji, isKaomojiIndexable } from "@/lib/kaomoji/seo/indexability";
import { buildKaomojiPagePath, buildKaomojiPageTitle, buildKaomojiOpenGraph } from "@/lib/kaomoji/seo/metadata";
import { buildKaomojiWebPageJsonLd, buildKaomojiBreadcrumbJsonLd, buildKaomojiCollectionJsonLd } from "@/lib/kaomoji/seo/structured-data";
import { runPhase16Pipeline } from "@/lib/kaomoji/processing/phase16/pipeline";
import type { KaomojiEditorialRecord } from "@/lib/kaomoji/processing/phase9/types";
import { getPhase12PublicQualityDir, getPhase16ManifestPath, getPhase16RootDir } from "@/lib/kaomoji/storage/paths";

describe("phase 16 seo content", () => {
  const root = process.cwd();
  const m = () => JSON.parse(readFileSync(getPhase16ManifestPath(root), "utf8"));
  const editorial = () => JSON.parse(readFileSync(join(getPhase12PublicQualityDir(root), "editorial.json"), "utf8")) as KaomojiEditorialRecord[];
  const sample = () => editorial().find((r) => r.is_public)!;

  it("1 manifest exists", () => assert.ok(existsSync(getPhase16ManifestPath(root))));
  it("2 phase number", () => assert.equal(m().phase, 16));
  it("3 indexable rate >= 99pct", () => assert.ok(m().indexable_rate >= 0.99));
  it("4 total public 51338", () => assert.equal(m().total_public, 51338));
  it("5 sitemap slugs match indexable", () => assert.equal(m().sitemap_slugs, m().indexable_count));
  it("6 collection pages >= 5", () => assert.ok(m().collection_pages >= 5));
  it("7 structured data types", () => assert.ok(m().structured_data_types.includes("WebPage")));
  it("8 no errors", () => assert.equal(m().errors.length, 0));
  it("9 seo version", () => assert.match(m().seo_version, /^16\./));
  it("10 indexable slugs file", () => assert.ok(existsSync(join(getPhase16RootDir(root), "indexable-slugs.json"))));
  it("11 public record indexable", () => assert.ok(isKaomojiIndexable(sample())));
  it("12 not public not indexable", () => {
    const blocked = { ...sample(), is_public: false } as KaomojiEditorialRecord;
    assert.ok(!isKaomojiIndexable(blocked));
  });
  it("13 missing slug not indexable", () => {
    const blocked = { ...sample(), slug: "" } as KaomojiEditorialRecord;
    assert.ok(!isKaomojiIndexable(blocked));
  });
  it("14 assess reason public", () => assert.equal(assessKaomojiIndexability(sample()).reason, "public_quality_gate"));
  it("15 count indexable", () => assert.equal(countIndexableKaomoji(editorial()), m().indexable_count));
  it("16 page title", () => assert.equal(buildKaomojiPageTitle(sample()), sample().seo_title));
  it("17 page path en", () => assert.equal(buildKaomojiPagePath(sample()), `/kaomoji/${sample().slug}`));
  it("18 page path hi", () => assert.equal(buildKaomojiPagePath(sample(), "hi"), `/hi/kaomoji/${sample().slug}`));
  it("19 open graph title", () => assert.ok(buildKaomojiOpenGraph(sample()).title.length > 0));
  it("20 webPage jsonld type", () => assert.equal(buildKaomojiWebPageJsonLd(sample())["@type"], "WebPage"));
  it("21 webPage url", () => assert.match(String(buildKaomojiWebPageJsonLd(sample()).url), /\/kaomoji\//));
  it("22 breadcrumb 3 items", () => assert.equal(buildKaomojiBreadcrumbJsonLd(sample()).itemListElement.length, 3));
  it("23 collection jsonld", () => assert.equal(buildKaomojiCollectionJsonLd("Cute", "cute", 100)["@type"], "CollectionPage"));
  it("24 collection itemList", () => assert.equal(buildKaomojiCollectionJsonLd("Cute", "cute", 100).mainEntity.numberOfItems, 100));
  it("25 deterministic rerun", () => {
    const before = m().indexable_count;
    assert.equal(runPhase16Pipeline(root).manifest.indexable_count, before);
  });
  it("26 pipeline version", () => assert.match(m().pipeline_version, /^16\./));
  it("27 structured catalog file", () => assert.ok(existsSync(join(getPhase16RootDir(root), "structured-data-catalog.json"))));
  it("28 collection pages file", () => assert.ok(existsSync(join(getPhase16RootDir(root), "collection-pages.json"))));
  it("29 cute collection count", () => {
    const pages = JSON.parse(readFileSync(join(getPhase16RootDir(root), "collection-pages.json"), "utf8")) as { slug: string; count: number }[];
    assert.ok(pages.some((p) => p.slug === "cute" && p.count >= 10));
  });
  it("30 happy collection", () => {
    const pages = JSON.parse(readFileSync(join(getPhase16RootDir(root), "collection-pages.json"), "utf8")) as { slug: string }[];
    assert.ok(pages.some((p) => p.slug === "happy"));
  });
  it("31 love collection", () => {
    const pages = JSON.parse(readFileSync(join(getPhase16RootDir(root), "collection-pages.json"), "utf8")) as { slug: string }[];
    assert.ok(pages.some((p) => p.slug === "love"));
  });
  it("32 cat collection", () => {
    const pages = JSON.parse(readFileSync(join(getPhase16RootDir(root), "collection-pages.json"), "utf8")) as { slug: string }[];
    assert.ok(pages.some((p) => p.slug === "cat"));
  });
  it("33 japanese collection", () => {
    const pages = JSON.parse(readFileSync(join(getPhase16RootDir(root), "collection-pages.json"), "utf8")) as { slug: string }[];
    assert.ok(pages.some((p) => p.slug === "japanese"));
  });
  it("34 ascii collection", () => {
    const pages = JSON.parse(readFileSync(join(getPhase16RootDir(root), "collection-pages.json"), "utf8")) as { slug: string }[];
    assert.ok(pages.some((p) => p.slug === "ascii"));
  });
  it("35 indexable slugs count", () => {
    const slugs = JSON.parse(readFileSync(join(getPhase16RootDir(root), "indexable-slugs.json"), "utf8")) as string[];
    assert.equal(slugs.length, m().indexable_count);
  });
  it("36 slug strings non empty", () => {
    const slugs = JSON.parse(readFileSync(join(getPhase16RootDir(root), "indexable-slugs.json"), "utf8")) as string[];
    assert.ok(slugs.every((s) => s.length > 0));
  });
  it("37 not permitted license", () => {
    const blocked = { ...sample(), license_status: "NOT_PERMITTED" as const } as KaomojiEditorialRecord;
    assert.ok(!isKaomojiIndexable(blocked));
  });
  it("38 missing seo title", () => {
    const blocked = { ...sample(), seo_title: "" } as KaomojiEditorialRecord;
    assert.ok(!isKaomojiIndexable(blocked));
  });
  it("39 missing content", () => {
    const blocked = { ...sample(), canonical_content: "" } as KaomojiEditorialRecord;
    assert.ok(!isKaomojiIndexable(blocked));
  });
  it("40 breadcrumb home", () => assert.equal(buildKaomojiBreadcrumbJsonLd(sample()).itemListElement[0]!.name, "Home"));
  it("41 breadcrumb kaomoji", () => assert.equal(buildKaomojiBreadcrumbJsonLd(sample()).itemListElement[1]!.name, "Kaomoji"));
  it("42 open graph path", () => assert.match(buildKaomojiOpenGraph(sample()).path, /^\/kaomoji\//));
  it("43 open graph site", () => assert.equal(buildKaomojiOpenGraph(sample()).siteName, "EmojiQuick"));
  it("44 webPage inLanguage", () => assert.equal(buildKaomojiWebPageJsonLd(sample()).inLanguage, "en"));
  it("45 collection url uses intent path", () => assert.match(String(buildKaomojiCollectionJsonLd("Cute", "cute", 1, "/kaomoji/cute").url), /\/kaomoji\/cute$/));
  it("46 indexable equals public filter", () => {
    const pub = editorial().filter((r) => r.is_public);
    assert.equal(countIndexableKaomoji(pub), pub.length);
  });
  it("47 hreflang in catalog", () => {
    const cat = JSON.parse(readFileSync(join(getPhase16RootDir(root), "structured-data-catalog.json"), "utf8"));
    assert.equal(cat.hreflang, true);
  });
  it("48 itemList type in catalog", () => {
    const cat = JSON.parse(readFileSync(join(getPhase16RootDir(root), "structured-data-catalog.json"), "utf8"));
    assert.ok(cat.types.includes("ItemList"));
  });
  it("49 breadcrumb type in catalog", () => {
    const cat = JSON.parse(readFileSync(join(getPhase16RootDir(root), "structured-data-catalog.json"), "utf8"));
    assert.ok(cat.types.includes("BreadcrumbList"));
  });
  it("50 indexable count 51338", () => assert.equal(m().indexable_count, 51338));
  it("51 kawaii collection optional", () => {
    const pages = JSON.parse(readFileSync(join(getPhase16RootDir(root), "collection-pages.json"), "utf8")) as { slug: string }[];
    assert.ok(pages.some((p) => p.slug === "kawaii") || m().collection_pages >= 5);
  });
  it("52 webPage isPartOf", () => assert.equal(buildKaomojiWebPageJsonLd(sample()).isPartOf["@type"], "WebSite"));
});
