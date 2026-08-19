import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseEmoticonsTextHtml } from "@/lib/kaomoji/collection/importers/emoticonstext";
import {
  discoverMesslettersPages,
  parseMesslettersHtml,
} from "@/lib/kaomoji/collection/importers/messletters";
import { parseWikipediaExtendedWikitext } from "@/lib/kaomoji/collection/importers/wikipedia-extended";
import { KAOMOJI_SOURCE_REGISTRY } from "@/lib/kaomoji/sources/registry";

describe("phase 3 importers", () => {
  it("parses emoticonstext span.emoticon entries", () => {
    const html = `<span class="emoticon">( •_•)</span><span class="emoticon">٩(＾◡＾)۶</span>`;
    const entries = parseEmoticonsTextHtml(html, "https://www.emoticonstext.com/");
    assert.equal(entries.length, 2);
    assert.equal(entries[0]!.original_kaomoji, "( •_•)");
    assert.equal(entries[0]!.license_status, "REVIEW_REQUIRED");
  });

  it("parses messletters li/pre entries with stable ids", () => {
    const html = `<ul class="flex copy"><li id="4570" title="clap kaomoji"><pre>(〃￣ ￣ ) 人 (￣ ￣〃 )</pre></li></ul>`;
    const entries = parseMesslettersHtml(html, "https://www.messletters.com/en/emoticons/happy/", "happy");
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.source_record_id, "4570");
    assert.equal(entries[0]!.source_category, "happy");
  });

  it("discovers messletters category pages", () => {
    const html = `<a href="/en/emoticons/happy/">happy</a><a href="/en/emoticons/sad/">sad</a>`;
    const pages = discoverMesslettersPages(html);
    assert.deepEqual(pages, ["/en/emoticons/happy/", "/en/emoticons/sad/"]);
  });

  it("parses extended wikipedia wikitext", () => {
    const wiki = `* "(^_^)" — happy\n* "(-_-)" — bored`;
    const entries = parseWikipediaExtendedWikitext(wiki, "List_of_emoticons");
    assert.ok(entries.length >= 2);
    assert.equal(entries[0]!.license_status, "ATTRIBUTION_REQUIRED");
  });
});

describe("phase 3 registry", () => {
  it("registers all 10 sources for phase 3 discovery", () => {
    assert.equal(KAOMOJI_SOURCE_REGISTRY.length, 10);
  });
});
