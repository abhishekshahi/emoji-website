import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyUrl, sitemapLocs } from "@/lib/kaomoji/collection/importers/fastemoji";
import { getPhase4ActiveSources } from "@/lib/kaomoji/collection/phase4-collector";
import { parseMesslettersHtml } from "@/lib/kaomoji/collection/importers/messletters";

describe("phase 4 acquisition", () => {
  it("targets six active sources", () => {
    assert.deepEqual(getPhase4ActiveSources(), [
      "emoticon-data",
      "kaomoji-tagged",
      "wikipedia",
      "messletters",
      "emoticonstext",
      "fastemoji",
    ]);
  });

  it("parses messletters without isLikelyEmoticon filter", () => {
    const html = `<li id="9999" title="test"><pre>abc</pre></li>`;
    const entries = parseMesslettersHtml(html, "https://example.com/", "test");
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.source_record_id, "9999");
  });

  it("classifies fastemoji urls", () => {
    const family = classifyUrl("https://www.fastemoji.com/category/funny");
    assert.ok(family === "CATEGORY" || family === "OTHER");
    const xml = `<urlset><loc>https://www.fastemoji.com/category/funny</loc></urlset>`;
    assert.equal(sitemapLocs(xml).length, 1);
  });

  it("preserves category-specific messletters source_record_id format", () => {
    const html = `<li id="4570" title="clap"><pre>(〃￣ ￣ ) 人 (￣ ￣〃 )</pre></li>`;
    const entries = parseMesslettersHtml(html, "https://www.messletters.com/en/emoticons/happy/", "happy");
    assert.equal(entries[0]!.source_category, "happy");
  });
});
