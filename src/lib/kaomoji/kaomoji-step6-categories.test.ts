import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CATEGORY_PAGE_SIZE,
  categoryTotalPages,
  nestedCategoryPath,
  parseCategoryPageParam,
  resolveNestedCategory,
  taxonomyGroupFromPath,
  TAXONOMY_GROUP_PATHS,
} from "@/lib/kaomoji/seo/category-routes";
import { TAXONOMY_GROUPS } from "@/lib/kaomoji/processing/phase9/taxonomy";

describe("kaomoji step6 nested categories", () => {
  it("maps all six taxonomy groups to production URL paths", () => {
    assert.equal(TAXONOMY_GROUPS.length, 6);
    assert.equal(TAXONOMY_GROUP_PATHS.length, 6);
    assert.equal(taxonomyGroupFromPath("emotions"), "EMOTION");
    assert.equal(taxonomyGroupFromPath("affection"), "LOVE_RELATIONSHIP");
    assert.equal(taxonomyGroupFromPath("cute-kawaii"), "CUTE_KAWAII");
    assert.equal(taxonomyGroupFromPath("animals"), "ANIMALS");
    assert.equal(taxonomyGroupFromPath("actions"), "ACTIONS");
    assert.equal(taxonomyGroupFromPath("style"), "STYLE");
    assert.equal(taxonomyGroupFromPath("nope"), undefined);
  });

  it("resolves nested category only when group matches", () => {
    assert.equal(resolveNestedCategory("emotions", "happy")?.slug, "happy");
    assert.equal(resolveNestedCategory("animals", "happy"), undefined);
    assert.equal(resolveNestedCategory("emotions", "not-a-cat"), undefined);
  });

  it("builds nested category paths with page", () => {
    assert.equal(nestedCategoryPath("happy", 1), "/kaomoji/categories/emotions/happy/page/1");
    assert.equal(nestedCategoryPath("cat", 2), "/kaomoji/categories/animals/cat/page/2");
    assert.equal(nestedCategoryPath("missing"), null);
  });

  it("parses page params safely (no 503-prone junk)", () => {
    assert.equal(parseCategoryPageParam("1"), 1);
    assert.equal(parseCategoryPageParam("12"), 12);
    assert.equal(parseCategoryPageParam("0"), null);
    assert.equal(parseCategoryPageParam("-1"), null);
    assert.equal(parseCategoryPageParam("abc"), null);
    assert.equal(parseCategoryPageParam("1.5"), null);
    assert.equal(parseCategoryPageParam(""), null);
  });

  it("computes total pages from item counts", () => {
    assert.equal(CATEGORY_PAGE_SIZE, 48);
    assert.equal(categoryTotalPages(0), 1);
    assert.equal(categoryTotalPages(48), 1);
    assert.equal(categoryTotalPages(49), 2);
    assert.equal(categoryTotalPages(112), 3);
  });
});
