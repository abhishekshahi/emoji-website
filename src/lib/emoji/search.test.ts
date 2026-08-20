import assert from "node:assert/strict";
import { describe, it } from "node:test";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import { searchEmojis } from "@/lib/emoji/search";
import type { BrowsableEmoji } from "@/lib/emoji/types";
import { isOpenMojiExtra } from "@/lib/emoji/types";

const searchableEmojis = [
  ...(emojis as BrowsableEmoji[]),
  ...(extras as BrowsableEmoji[]),
];

function topResultIds(query: string, limit = 5): string[] {
  return searchEmojis(searchableEmojis, query, limit).map((result) => result.emoji.id);
}

function topHexcode(query: string): string | undefined {
  return searchEmojis(searchableEmojis, query, 1)[0]?.emoji.hexcode;
}

describe("searchEmojis", () => {
  it("finds fire by emoji character", () => {
    assert.equal(topHexcode("🔥"), "1F525");
  });

  it('finds fire by name "fire"', () => {
    assert.equal(topHexcode("fire"), "1F525");
  });

  it('finds fire by keyword "flame"', () => {
    assert.equal(topHexcode("flame"), "1F525");
  });

  it('finds fire by keyword "hot"', () => {
    const results = searchEmojis(searchableEmojis, "hot", 20);
    assert.ok(results.some((result) => result.emoji.hexcode === "1F525"));
  });

  it("finds fire by shortcode :fire:", () => {
    assert.equal(topHexcode(":fire:"), "1F525");
  });

  it("finds fire by Unicode query U+1F525", () => {
    assert.equal(topHexcode("U+1F525"), "1F525");
  });

  it("finds fire by hex query 1F525", () => {
    assert.equal(topHexcode("1F525"), "1F525");
  });

  it("finds an OpenMoji extra by name", () => {
    const extra = (extras as BrowsableEmoji[]).find(isOpenMojiExtra);
    assert.ok(extra);

    const results = searchEmojis(searchableEmojis, extra.name, 5);
    assert.ok(results.some((result) => result.emoji.id === extra.id));
  });

  it("ranks standard emojis ahead of extras for shared queries", () => {
    const results = searchEmojis(searchableEmojis, "button", 10);
    const firstExtraIndex = results.findIndex((result) => result.emoji.isExtra);
    const firstStandardIndex = results.findIndex((result) => !result.emoji.isExtra);

    assert.ok(firstStandardIndex >= 0);
    assert.ok(results.length > 1);

    if (firstExtraIndex >= 0) {
      assert.ok(firstStandardIndex < firstExtraIndex);
    }
  });

  it("returns both standard and extra matches for shared queries when relevant", () => {
    const results = searchEmojis(searchableEmojis, "button", 120);
    const hasStandard = results.some((result) => !result.emoji.isExtra);
    const hasExtra = results.some((result) => result.emoji.isExtra);

    assert.equal(hasStandard, true);
    assert.equal(hasExtra, true);
  });

  it("keeps exact emoji matches at the top", () => {
    const fire = (emojis as BrowsableEmoji[]).find((emoji) => emoji.hexcode === "1F525");
    assert.ok(fire);

    const results = searchEmojis(searchableEmojis, fire.emoji, 3);
    assert.equal(results[0]?.emoji.hexcode, "1F525");
    assert.ok(results[0]?.score >= 900);
  });

  it("returns stable ids for fire-related queries", () => {
    assert.deepEqual(topResultIds("fire", 1), ["1F525"]);
    assert.deepEqual(topResultIds("flame", 1), ["1F525"]);
  });

  it("ranks exact canonical slug match highly (8.62-D)", () => {
    const results = searchEmojis(searchableEmojis, "red-heart", 5);
    assert.equal(results[0]?.emoji.slug, "red-heart");
    assert.ok(results[0]!.score >= 750);
  });
});
