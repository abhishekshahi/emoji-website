import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { debounce } from "@/lib/kaomoji/ui/debounce";
import { KAOMOJI_FILTER_CATEGORIES, buildKaomojiSearchUrl, parseKaomojiSearchFilters } from "@/lib/kaomoji/ui/filters";
import { runPhase17Pipeline } from "@/lib/kaomoji/processing/phase17/pipeline";
import { getPhase17ManifestPath, getPhase17RootDir } from "@/lib/kaomoji/storage/paths";

describe("phase 17 ui ux", () => {
  const root = process.cwd();
  const m = () => JSON.parse(readFileSync(getPhase17ManifestPath(root), "utf8"));

  it("1 manifest exists", () => assert.ok(existsSync(getPhase17ManifestPath(root))));
  it("2 phase number", () => assert.equal(m().phase, 17));
  it("3 instant search true", () => assert.equal(m().instant_search, true));
  it("4 debounce 300ms", () => assert.equal(m().debounce_ms, 300));
  it("5 filter categories 6", () => assert.equal(m().filter_categories, 6));
  it("6 mobile first", () => assert.equal(m().mobile_first, true));
  it("7 no errors", () => assert.equal(m().errors.length, 0));
  it("8 ui version", () => assert.match(m().ui_version, /^17\./));
  it("9 accessibility checks >= 5", () => assert.ok(m().accessibility_checks.length >= 5));
  it("10 aria label check", () => assert.ok(m().accessibility_checks.some((c: string) => c.includes("aria"))));
  it("11 filter categories cute", () => assert.ok(KAOMOJI_FILTER_CATEGORIES.some((c) => c.slug === "cute")));
  it("12 filter categories happy", () => assert.ok(KAOMOJI_FILTER_CATEGORIES.some((c) => c.slug === "happy")));
  it("13 filter categories love", () => assert.ok(KAOMOJI_FILTER_CATEGORIES.some((c) => c.slug === "love")));
  it("14 filter categories cat", () => assert.ok(KAOMOJI_FILTER_CATEGORIES.some((c) => c.slug === "cat")));
  it("15 filter categories japanese", () => assert.ok(KAOMOJI_FILTER_CATEGORIES.some((c) => c.slug === "japanese")));
  it("16 filter categories ascii", () => assert.ok(KAOMOJI_FILTER_CATEGORIES.some((c) => c.slug === "ascii")));
  it("17 parse filters empty", () => assert.deepEqual(parseKaomojiSearchFilters(new URLSearchParams()), {}));
  it("18 parse category", () => assert.equal(parseKaomojiSearchFilters(new URLSearchParams("category=cute")).category, "cute"));
  it("19 parse locale", () => assert.equal(parseKaomojiSearchFilters(new URLSearchParams("locale=hi")).locale, "hi"));
  it("20 parse lang alias", () => assert.equal(parseKaomojiSearchFilters(new URLSearchParams("lang=ja")).locale, "ja"));
  it("21 build search url query", () => assert.match(buildKaomojiSearchUrl("cute"), /q=cute/));
  it("22 build search url category", () => assert.match(buildKaomojiSearchUrl("cute", { category: "cat" }), /category=cat/));
  it("23 build search url locale", () => assert.match(buildKaomojiSearchUrl("cute", { locale: "es" }), /locale=es/));
  it("24 debounce calls once", async () => {
    let n = 0;
    const fn = debounce(() => { n++; }, 50);
    fn(); fn(); fn();
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(n, 1);
    fn.cancel();
  });
  it("25 debounce cancel", async () => {
    let n = 0;
    const fn = debounce(() => { n++; }, 50);
    fn();
    fn.cancel();
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(n, 0);
  });
  it("26 ui checklist file", () => assert.ok(existsSync(join(getPhase17RootDir(root), "ui-checklist.json"))));
  it("27 checklist instant search", () => {
    const c = JSON.parse(readFileSync(join(getPhase17RootDir(root), "ui-checklist.json"), "utf8"));
    assert.equal(c.instant_search, true);
  });
  it("28 checklist quality hidden", () => {
    const c = JSON.parse(readFileSync(join(getPhase17RootDir(root), "ui-checklist.json"), "utf8"));
    assert.equal(c.quality_scores_hidden, true);
  });
  it("29 checklist filters count", () => {
    const c = JSON.parse(readFileSync(join(getPhase17RootDir(root), "ui-checklist.json"), "utf8"));
    assert.equal(c.filters.length, 6);
  });
  it("30 deterministic rerun", () => {
    const before = m().debounce_ms;
    assert.equal(runPhase17Pipeline(root).manifest.debounce_ms, before);
  });
  it("31 pipeline version", () => assert.match(m().pipeline_version, /^17\./));
  it("32 min touch target check", () => assert.ok(m().accessibility_checks.some((c: string) => c.includes("44px"))));
  it("33 keyboard check", () => assert.ok(m().accessibility_checks.some((c: string) => c.includes("keyboard"))));
  it("34 sr-only check", () => assert.ok(m().accessibility_checks.some((c: string) => c.includes("sr-only"))));
  it("35 focus visible check", () => assert.ok(m().accessibility_checks.some((c: string) => c.includes("focus"))));
  it("36 build url empty query", () => assert.equal(buildKaomojiSearchUrl(""), "/api/kaomoji/search"));
  it("37 parse trim category", () => assert.equal(parseKaomojiSearchFilters(new URLSearchParams("category=+cute+")).category, "cute"));
  it("38 filter labels non empty", () => assert.ok(KAOMOJI_FILTER_CATEGORIES.every((c) => c.label.length > 0)));
  it("39 filter slugs unique", () => {
    const slugs = KAOMOJI_FILTER_CATEGORIES.map((c) => c.slug);
    assert.equal(new Set(slugs).size, slugs.length);
  });
  it("40 debounce passes args", async () => {
    let last = "";
    const fn = debounce((s: string) => { last = s; }, 30);
    fn("hello");
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(last, "hello");
    fn.cancel();
  });
  it("41 accessibility count 6", () => assert.equal(m().accessibility_checks.length, 6));
  it("42 aria-live check", () => assert.ok(m().accessibility_checks.some((c: string) => c.includes("aria-live"))));
  it("43 mobile first checklist", () => {
    const c = JSON.parse(readFileSync(join(getPhase17RootDir(root), "ui-checklist.json"), "utf8"));
    assert.equal(c.mobile_first, true);
  });
  it("44 debounce ms checklist", () => {
    const c = JSON.parse(readFileSync(join(getPhase17RootDir(root), "ui-checklist.json"), "utf8"));
    assert.equal(c.debounce_ms, 300);
  });
  it("45 build url encodes query", () => assert.match(buildKaomojiSearchUrl("cute cat"), /q=cute/));
  it("46 parse locale trim", () => assert.equal(parseKaomojiSearchFilters(new URLSearchParams("locale=+es+")).locale, "es"));
  it("47 filter slug ascii", () => assert.equal(KAOMOJI_FILTER_CATEGORIES[5]!.slug, "ascii"));
  it("48 manifest warnings array", () => assert.ok(Array.isArray(m().warnings)));
  it("49 no quality filter exposed", () => {
    const c = JSON.parse(readFileSync(join(getPhase17RootDir(root), "ui-checklist.json"), "utf8"));
    assert.equal(c.quality_scores_hidden, true);
  });
  it("50 checklist accessibility length", () => {
    const c = JSON.parse(readFileSync(join(getPhase17RootDir(root), "ui-checklist.json"), "utf8"));
    assert.equal(c.accessibility.length, 6);
  });
  it("51 debounce has cancel", () => assert.equal(typeof debounce(() => {}, 10).cancel, "function"));
});
