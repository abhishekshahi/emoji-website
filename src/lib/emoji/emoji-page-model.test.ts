import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getAllBrowsableEmojis,
  getBrowsableEmojiBySlug,
  getRelatedBrowsableEmojis,
} from "./browsable-data";
import { getTestEnrichmentFile } from "./enrichment-test-helpers";
import {
  buildArtworkPanelView,
  buildEmojiPageDescription,
  buildMeaningView,
  buildNamesView,
  buildTechnicalView,
  buildVariantGroups,
} from "./emoji-page-model";
import { buildRelatedEmojiGroups } from "./related-emojis-core";

const enrichment = getTestEnrichmentFile();

describe("emoji page model", () => {
  it("builds a meaning view for fire with a summary", () => {
    const emoji = getBrowsableEmojiBySlug("fire");
    assert.ok(emoji);
    const record = enrichment.bySlug.fire;
    const meaning = buildMeaningView(emoji!, record);
    assert.ok(meaning.summary || meaning.definitions.length > 0);
  });

  it("filters baseline keywords out of discoverable search terms", () => {
    const emoji = getBrowsableEmojiBySlug("fire");
    assert.ok(emoji);
    const names = buildNamesView(emoji!, enrichment.bySlug.fire);
    assert.ok(!names.searchTerms.some((term) => term.toLowerCase() === "fire"));
  });

  it("builds variant groups only for resolvable slugs", () => {
    const emoji = getBrowsableEmojiBySlug("thumbs-up");
    assert.ok(emoji);
    const record = enrichment.bySlug["thumbs-up"];
    const groups = buildVariantGroups(record, getBrowsableEmojiBySlug);
    for (const group of groups) {
      assert.ok(group.variants.length > 0);
      for (const variant of group.variants) {
        assert.equal(variant.emoji.slug, variant.slug);
      }
    }
  });

  it("keeps OpenMoji as the only publicly served artwork provider", () => {
    const panel = buildArtworkPanelView(enrichment.bySlug.fire);
    const served = panel.providers.filter((provider) => provider.publiclyServed);
    assert.equal(served.length, 1);
    assert.equal(served[0]?.id, "openmoji");
  });

  it("builds a natural page description from enrichment", () => {
    const emoji = getBrowsableEmojiBySlug("fire");
    assert.ok(emoji);
    const description = buildEmojiPageDescription(emoji!, enrichment.bySlug.fire);
    assert.match(description, /Copy fire/i);
    assert.match(description, /Unicode/);
  });

  it("builds technical details for standard emoji", () => {
    const emoji = getBrowsableEmojiBySlug("fire");
    assert.ok(emoji);
    const technical = buildTechnicalView(emoji!, enrichment.bySlug.fire);
    assert.equal(technical.hexcode, "1F525");
    assert.equal(technical.codePointString, "U+1F525");
  });
});

describe("related emoji groups", () => {
  it("returns grouped related emojis for fire without duplicates", () => {
    const emoji = getBrowsableEmojiBySlug("fire");
    assert.ok(emoji);
    const groups = buildRelatedEmojiGroups(
      emoji!,
      enrichment.bySlug.fire,
      getRelatedBrowsableEmojis(emoji!),
      getBrowsableEmojiBySlug,
    );
    const slugs = groups.flatMap((group) => group.emojis.map((entry) => entry.slug));
    assert.equal(new Set(slugs).size, slugs.length);
    assert.ok(slugs.every((slug) => slug !== "fire"));
  });
});

describe("enrichment data quality", () => {
  it("does not reference missing emoji slugs in related or variant links", () => {
    const emojis = getAllBrowsableEmojis();
    const slugSet = new Set(emojis.map((emoji) => emoji.slug));
    let broken = 0;

    for (const emoji of emojis) {
      const record = enrichment.bySlug[emoji.slug];
      if (!record) continue;
      for (const link of [...record.related, ...record.variants]) {
        if (!slugSet.has(link.slug)) {
          broken += 1;
        }
      }
    }

    assert.equal(broken, 0);
  });
});
