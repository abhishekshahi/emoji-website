import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzeText,
  charLiteral,
  cleanText,
  visualizeText,
} from "@/lib/tools/invisible-characters/analyze";
import {
  formatCodePoint,
  GENERATOR_CHARACTERS,
  GENERATOR_BY_HEX,
} from "@/lib/tools/invisible-characters/characters";
import {
  getInvisibleToolPage,
  INVISIBLE_TOOL_SLUGS,
  listInvisibleToolPages,
} from "@/lib/tools/invisible-characters/registry";
import { getIndexableInvisibleToolPages } from "@/lib/tools/invisible-characters/sitemap-pages";

describe("Step 14 — Invisible character tools", () => {
  it("generator characters match spec code points", () => {
    const hexes = GENERATOR_CHARACTERS.map((c) => c.hex);
    assert.deepEqual(hexes, ["200B", "200C", "200D", "2060", "FEFF"]);
  });

  it("analyzes A[ZWSP]B pattern", () => {
    const zwsp = charLiteral("200B");
    const text = `A${zwsp}B`;
    const result = analyzeText(text);
    assert.equal(result.unicodeCodePoints, 3);
    assert.equal(result.invisibleCount, 1);
    assert.equal(result.segments[1]!.codePointLabel, "U+200B");
    assert.equal(result.segments[1]!.name, "ZERO WIDTH SPACE");
  });

  it("visualizes invisible characters without altering meaning length", () => {
    const text = `X${charLiteral("200C")}Y`;
    const viz = visualizeText(text);
    assert.match(viz, /\[ZWNJ\]/);
    assert.ok(!viz.includes("\u200C"));
  });

  it("cleans only selected code points", () => {
    const text = `a${charLiteral("200B")}b${charLiteral("200D")}c`;
    const result = cleanText(text, new Set([0x200b]));
    assert.equal(result.removedCount, 1);
    assert.ok(result.cleaned.includes("\u200D"));
    assert.ok(!result.cleaned.includes("\u200B"));
  });

  it("detects bidi override with warnings", () => {
    const text = `hello${charLiteral("202E")}world${charLiteral("202C")}`;
    const result = analyzeText(text);
    assert.ok(result.bidiControlCount >= 2);
    assert.ok(result.warnings.length > 0);
  });

  it("bounds oversized input", () => {
    const big = "a".repeat(20_000);
    const result = analyzeText(big);
    assert.equal(result.utf16Units, 10_000);
  });

  it("tool pages are bounded with unique titles", () => {
    assert.ok(INVISIBLE_TOOL_SLUGS.length >= 3);
    assert.ok(INVISIBLE_TOOL_SLUGS.length <= 6);
    const titles = new Set<string>();
    for (const page of listInvisibleToolPages()) {
      assert.ok(!titles.has(page.title), page.title);
      titles.add(page.title);
      assert.ok(page.intro.length > 40);
    }
  });

  it("sitemap includes tool index and pages", () => {
    const pages = getIndexableInvisibleToolPages();
    assert.ok(pages.some((p) => p.path === "/tools/invisible-characters"));
    for (const slug of INVISIBLE_TOOL_SLUGS) {
      assert.ok(pages.some((p) => p.path === `/tools/invisible-characters/${slug}`));
    }
  });

  it("FEFF includes caution in registry", () => {
    const feff = GENERATOR_BY_HEX.get("FEFF");
    assert.ok(feff?.caution);
    assert.match(feff!.caution!, /BOM/i);
  });

  it("does not create per-code-point SEO slug explosion", () => {
    for (const slug of INVISIBLE_TOOL_SLUGS) {
      assert.ok(!slug.startsWith("u+"), slug);
      assert.ok(!slug.match(/^[0-9a-f]{4}$/), slug);
    }
    assert.ok(getInvisibleToolPage("generator"));
  });

  it("formatCodePoint renders U+ prefix", () => {
    assert.equal(formatCodePoint(0x200b), "U+200B");
  });
});
