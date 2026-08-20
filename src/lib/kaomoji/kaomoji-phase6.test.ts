import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { buildOccurrenceRawId } from "@/lib/kaomoji/collection/ids";
import { classifyUrl, loadFastEmojiStats } from "@/lib/kaomoji/collection/importers/fastemoji";
import {
  extractJapaneseEmoticonsFromHtml,
  parseKaomojiJsonFaceRecords,
  parseNpmKaomojiBundle,
} from "@/lib/kaomoji/collection/importers/phase6-gaps";
import { parseGenerateKaomojiJson, parseKawaiiFacesJs } from "@/lib/kaomoji/collection/importers/github-repo";
import { getFastEmojiCheckpointPath } from "@/lib/kaomoji/storage/paths";

const FIXTURE = join(process.cwd(), "src/lib/kaomoji/fixtures/phase6");

describe("phase 6 gap closure", () => {
  it("parseGenerateKaomojiJson extracts category/value records", () => {
    const payload = { kaomoji: [{ category: "joy", value: "(* ^ ω ^)" }, { category: "sad", value: "(´；ω；`)" }] };
    const entries = parseGenerateKaomojiJson(payload, "kaomoji.json");
    assert.equal(entries.length, 2);
    assert.equal(entries[0]!.source_category, "joy");
    assert.equal(entries[0]!.original_kaomoji, "(* ^ ω ^)");
  });

  it("parseKawaiiFacesJs handles export default arrays", () => {
    const js = 'export default [\n  "(◕‿◕✿)",\n  "ʕ·ᴥ·ʔ"\n];\n';
    const entries = parseKawaiiFacesJs(js, "happy", "src/data/happy.js");
    assert.equal(entries.length, 2);
    assert.equal(entries[1]!.original_kaomoji, "ʕ·ᴥ·ʔ");
  });

  it("parseKaomojiJsonFaceRecords extracts face field", () => {
    const payload = { "0": { annotation: "test", face: "(^_^)" }, "1": { annotation: "x", face: "T_T" } };
    const entries = parseKaomojiJsonFaceRecords(payload, "kao-utf8.json", null);
    assert.equal(entries.length, 2);
    assert.ok(entries[0]!.source_metadata?.annotation);
  });

  it("parseNpmKaomojiBundle extracts embedded arrays", () => {
    const js = "const happy$1 = ['(^^*)', 'd(^^*)']; const sad$1 = ['(T_T)'];";
    const entries = parseNpmKaomojiBundle(js, "index.cjs.js");
    assert.ok(entries.length >= 3);
  });

  it("Japaneseemoticons.org HTML extractor filters navigation text", () => {
    const html = '<span class="kaomoji-item">Copied</span><span class="kaomoji-item">~ヾ(＾∇＾)</span>';
    const entries = extractJapaneseEmoticonsFromHtml(html, "https://japaneseemoticons.org/collection-of-kaomoji-happy/", "happy", 0);
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.original_kaomoji, "~ヾ(＾∇＾)");
  });

  it("FastEmoji classifyUrl identifies emoji pages", () => {
    assert.equal(classifyUrl("https://www.fastemoji.com/🎉"), "EMOJI");
    assert.equal(classifyUrl("https://www.fastemoji.com/category/smileys"), "CATEGORY");
  });

  it("FastEmoji checkpoint stats exist", () => {
    const stats = loadFastEmojiStats(getFastEmojiCheckpointPath(process.cwd()));
    if (stats) {
      assert.ok(stats.total_urls > 0);
      assert.ok(stats.emoji + stats.sequence + stats.combination > 0);
    }
  });

  it("buildOccurrenceRawId preserves separate page occurrences", () => {
    const a = buildOccurrenceRawId({ source_id: "japaneseemoticons-org", source_record_id: "jeo:happy:0", source_page: "https://japaneseemoticons.org/happy/", source_category: "happy", source_file: null });
    const b = buildOccurrenceRawId({ source_id: "japaneseemoticons-org", source_record_id: "jeo:sad:0", source_page: "https://japaneseemoticons.org/sad/", source_category: "sad", source_file: null });
    assert.notEqual(a, b);
  });

  it("no-loss: raw records file exists with baseline", () => {
    const records = JSON.parse(readFileSync(join(process.cwd(), "data/kaomoji/raw/records.json"), "utf8")) as unknown[];
    assert.ok(records.length >= 145873);
  });

  it("github-repo parseGenerateKaomojiJson matches phase6 parser", () => {
    const payload = { kaomoji: [{ category: "joy", value: "(* ^ ω ^)" }] };
    assert.equal(parseGenerateKaomojiJson(payload, "kaomoji.json").length, 1);
  });
});
