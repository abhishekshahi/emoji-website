import assert from "node:assert/strict";
import { describe, it } from "node:test";
import emojis from "@/data/emojis.json";
import {
  buildArtworkIntelSummary,
  compactArtworkForRecord,
  expandArtworkFromRecord,
} from "./artwork-intelligence";
import { getBrowsableEmojiBySlug } from "./browsable-data";
import { getTestEnrichmentFile } from "./enrichment-test-helpers";
import { buildArtworkPanelView, buildVariantGroups } from "./emoji-page-model";
import { buildRelatedEmojiGroups } from "./related-emojis-core";
import {
  classifyVariantKind,
  findVariantBaseSlug,
  getVariantBaseKey,
} from "./variant-intelligence";
import type { BrowsableEmoji } from "./types";

const enrichment = getTestEnrichmentFile();
const allEmojis = emojis as BrowsableEmoji[];

describe("artwork intelligence", () => {
  it("marks OpenMoji as publicly served when public assets exist", () => {
    const summary = buildArtworkIntelSummary({
      openmoji: ["openmoji:openmoji-artwork:1F525"],
      noto: [],
      twemoji: [],
      fluent: [],
      openmojiPubliclyAvailable: true,
    });
    const openmoji = summary.providers.find((provider) => provider.provider === "openmoji");
    assert.equal(openmoji?.publiclyServed, true);
    assert.equal(openmoji?.status, "available");
  });

  it("keeps Noto indexed but not publicly served", () => {
    const summary = buildArtworkIntelSummary({
      openmoji: [],
      noto: ["noto:noto-artwork:1F525:emoji_u1f525.svg", "noto:noto-artwork:1F525:emoji_u1f525.png"],
      twemoji: [],
      fluent: [],
      openmojiPubliclyAvailable: false,
    });
    const noto = summary.providers.find((provider) => provider.provider === "noto");
    assert.equal(noto?.indexed, true);
    assert.equal(noto?.publiclyServed, false);
    assert.deepEqual(noto?.formats, ["svg", "png"]);
  });

  it("round-trips compact artwork metadata", () => {
    const summary = buildArtworkIntelSummary({
      openmoji: ["openmoji:openmoji-artwork:1F525"],
      noto: ["noto:noto-artwork:1F525:emoji_u1f525.svg"],
      twemoji: ["twemoji:twemoji-artwork:1F525:1f525.svg"],
      fluent: ["fluent:fluent-artwork:fire_color.svg:fire_color.svg"],
      openmojiPubliclyAvailable: true,
    });
    const compact = compactArtworkForRecord(summary);
    const expanded = expandArtworkFromRecord(compact);
    assert.equal(expanded.primaryProvider, "openmoji");
    assert.ok(expanded.providers.some((provider) => provider.provider === "fluent" && !provider.publiclyServed));
  });

  it("builds artwork panel with only OpenMoji publicly served for fire", () => {
    const panel = buildArtworkPanelView(enrichment.bySlug.fire);
    const served = panel.providers.filter((provider) => provider.publiclyServed);
    assert.equal(served.length, 1);
    assert.equal(served[0]?.id, "openmoji");
  });
});

describe("variant intelligence", () => {
  it("classifies skin tone variants for waving hand", () => {
    const base = getBrowsableEmojiBySlug("waving-hand");
    const tone = getBrowsableEmojiBySlug("waving-hand-light-skin-tone");
    assert.ok(base && tone);
    assert.equal(classifyVariantKind(base, tone), "skin-tone");
    assert.equal(getVariantBaseKey(base), getVariantBaseKey(tone));
  });

  it("classifies gender variants for technologist", () => {
    const neutral = getBrowsableEmojiBySlug("technologist");
    const man = getBrowsableEmojiBySlug("man-technologist");
    const woman = getBrowsableEmojiBySlug("woman-technologist");
    assert.ok(neutral && man && woman);
    assert.equal(classifyVariantKind(neutral, man), "gender");
    assert.equal(classifyVariantKind(neutral, woman), "gender");
    assert.equal(getVariantBaseKey(neutral), getVariantBaseKey(man));
  });

  it("finds a stable base slug within a variant group", () => {
    const tone = getBrowsableEmojiBySlug("waving-hand-light-skin-tone");
    assert.ok(tone);
    const group = allEmojis.filter((emoji) => getVariantBaseKey(emoji) === getVariantBaseKey(tone));
    const baseSlug = findVariantBaseSlug(tone, group);
    assert.equal(baseSlug, "waving-hand");
  });

  it("builds grouped variant UI only for resolvable slugs", () => {
    const record = enrichment.bySlug["waving-hand"];
    const groups = buildVariantGroups(record, getBrowsableEmojiBySlug);
    const skinToneGroup = groups.find((group) => group.kind === "skin-tone");
    assert.ok(skinToneGroup);
    assert.ok(skinToneGroup.variants.length >= 4);
  });

  it("does not include duplicate variant slugs in enrichment", () => {
    let duplicates = 0;
    for (const record of Object.values(enrichment.bySlug)) {
      const slugs = record.variants.map((variant) => variant.slug);
      if (new Set(slugs).size !== slugs.length) duplicates += 1;
    }
    assert.equal(duplicates, 0);
  });
});

describe("related emoji ranking", () => {
  it("excludes variant slugs from related groups", () => {
    const emoji = getBrowsableEmojiBySlug("waving-hand");
    assert.ok(emoji);
    const groups = buildRelatedEmojiGroups(
      emoji,
      enrichment.bySlug["waving-hand"],
      [],
      getBrowsableEmojiBySlug,
    );
    const slugs = groups.flatMap((group) => group.emojis.map((entry) => entry.slug));
    const variantSlugs = enrichment.bySlug["waving-hand"].variants.map((variant) => variant.slug);
    for (const slug of variantSlugs) {
      assert.ok(!slugs.includes(slug));
    }
  });

  it("limits related groups to meaningful sizes", () => {
    const emoji = getBrowsableEmojiBySlug("fire");
    assert.ok(emoji);
    const groups = buildRelatedEmojiGroups(
      emoji,
      enrichment.bySlug.fire,
      allEmojis.filter((entry) => entry.category === emoji.category).slice(0, 20),
      getBrowsableEmojiBySlug,
    );
    for (const group of groups) {
      assert.ok(group.emojis.length >= 2);
      assert.ok(group.emojis.length <= 10);
    }
  });
});

describe("enrichment artwork coverage", () => {
  it("covers all published emojis with compact artwork metadata", () => {
    assert.equal(Object.keys(enrichment.bySlug).length, 4486);
    for (const emoji of allEmojis.slice(0, 50)) {
      const record = enrichment.bySlug[emoji.slug];
      assert.ok(record?.artwork);
      assert.ok(record.artwork.primary);
    }
  });

  it("reports zero invalid variant links", () => {
    const slugSet = new Set(allEmojis.map((emoji) => emoji.slug));
    let invalid = 0;
    for (const record of Object.values(enrichment.bySlug)) {
      for (const variant of record.variants) {
        if (!slugSet.has(variant.slug)) invalid += 1;
      }
    }
    assert.equal(invalid, 0);
  });
});
