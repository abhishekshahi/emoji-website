import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAllBrowsableEmojis } from "./browsable-data";
import { getTestEnrichmentFile } from "./enrichment-test-helpers";
import { getAllEmojiSearchEnrichmentById } from "./search-enrichment";
import { searchEmojis } from "./search";

const enrichment = getTestEnrichmentFile();

describe("emoji enrichment", () => {
  it("loads enrichment for every published emoji slug", () => {
    const emojis = getAllBrowsableEmojis();
    let missing = 0;
    for (const emoji of emojis) {
      if (!enrichment.bySlug[emoji.slug]) {
        missing += 1;
      }
    }
    assert.equal(missing, 0);
  });

  it("loads compact search enrichment for every published emoji id", () => {
    const byId = getAllEmojiSearchEnrichmentById();
    const emojis = getAllBrowsableEmojis();
    assert.equal(Object.keys(byId).length, emojis.length);
  });

  it("finds fire through semantic enrichment terms", () => {
    const emojis = getAllBrowsableEmojis();
    const enrichment = getAllEmojiSearchEnrichmentById();
    const results = searchEmojis(emojis, "flame", 10, enrichment);
    assert.ok(results.some((result) => result.emoji.slug === "fire"));
  });

  it("finds developer-related emoji through enrichment", () => {
    const emojis = getAllBrowsableEmojis();
    const enrichment = getAllEmojiSearchEnrichmentById();
    const results = searchEmojis(emojis, "developer", 20, enrichment);
    assert.ok(results.length > 0);
  });
});
