import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  partitionRelatedCandidates,
  SIMILAR_RELATIONSHIP_TYPES,
  D1_RELATIONSHIP_FETCH_LIMIT,
} from "@/lib/kaomoji/related/ranking";
import { relatedReasonLabel } from "@/lib/kaomoji/related/reasons";
import { sanitizeRelatedRequest, KAOMOJI_ID_RE } from "@/lib/kaomoji/related/sanitize";
import { resolveEditorialRelatedBundle } from "@/lib/kaomoji/related/resolve-editorial";
import {
  D1_GET_RELATED_KAOMOJI,
  D1_GET_SAME_CATEGORY_PEERS,
} from "@/lib/kaomoji/cloudflare/d1-queries";
import { evaluateBenchmark } from "@/lib/kaomoji/processing/phase14/benchmark-dataset";
import { searchKaomojiV2 } from "@/lib/kaomoji/processing/phase14/search-index-v2";
import { getPhase14SearchIndexPath } from "@/lib/kaomoji/storage/paths";
import type { RelatedKaomojiCandidate } from "@/lib/kaomoji/related/types";
import type { KaomojiEditorialRecord, KaomojiRelationship } from "@/lib/kaomoji/processing/phase9/types";

const searchIndexPath = getPhase14SearchIndexPath(process.cwd());
const hasSearchIndex = existsSync(searchIndexPath);
const idx = hasSearchIndex ? JSON.parse(readFileSync(searchIndexPath, "utf8")) : null;

function sampleCandidate(
  id: string,
  slug: string,
  content: string,
  type: string,
  score = 80,
): RelatedKaomojiCandidate {
  return {
    canonical_id: id,
    slug,
    content,
    normalized_content: content,
    accessible_name: content,
    editorial_name: null,
    quality_score: 70,
    relationship_type: type,
    confidence: "medium",
    score,
  };
}

describe("Step 7 — Related / similar kaomoji", () => {
  it("similar types include variant and similar_expression", () => {
    assert.ok(SIMILAR_RELATIONSHIP_TYPES.has("variant"));
    assert.ok(SIMILAR_RELATIONSHIP_TYPES.has("similar_expression"));
  });

  it("partition excludes self canonical id", () => {
    const source = "kao_00013e7cc777f411";
    const bundle = partitionRelatedCandidates(
      [
        sampleCandidate(source, "self-slug", "(◕‿◕)", "variant", 99),
        sampleCandidate("kao_007156df3de39a14", "peer-1", "(◕‿◕)ノ", "variant", 90),
      ],
      { sourceCanonicalId: source },
    );
    const ids = [...bundle.similar, ...bundle.related].map((h) => h.canonical_id);
    assert.ok(!ids.includes(source));
  });

  it("partition dedupes canonical id slug and normalized content", () => {
    const source = "kao_00013e7cc777f411";
    const bundle = partitionRelatedCandidates(
      [
        sampleCandidate("kao_a", "slug-a", "(◕‿◕)", "same_category"),
        sampleCandidate("kao_a", "slug-b", "(◕‿◕)", "same_category"),
        sampleCandidate("kao_b", "slug-a", "(◕ω◕)", "same_category"),
        sampleCandidate("kao_c", "slug-c", "(◕‿◕)", "alternative"),
      ],
      { sourceCanonicalId: source, relatedLimit: 12 },
    );
    const all = [...bundle.similar, ...bundle.related];
    assert.equal(all.length, 1);
    assert.equal(all[0]?.canonical_id, "kao_a");
  });

  it("variant relationships land in similar bucket", () => {
    const bundle = partitionRelatedCandidates(
      [
        sampleCandidate("kao_v1", "v1", "(◕‿◕)", "variant", 95),
        sampleCandidate("kao_c1", "c1", "(´･ω･`)", "same_category", 70),
      ],
      { sourceCanonicalId: "kao_src", similarLimit: 4, relatedLimit: 4 },
    );
    assert.equal(bundle.similar.length, 1);
    assert.equal(bundle.similar[0]?.relationship_type, "variant");
    assert.equal(bundle.related.length, 1);
  });

  it("reason labels are user-facing not scores", () => {
    assert.equal(relatedReasonLabel("variant"), "Similar expression");
    assert.equal(relatedReasonLabel("same_category", "Happy"), "Happy");
    assert.equal(relatedReasonLabel("opposite_emotion"), "Opposite emotion");
  });

  it("sanitize rejects invalid canonical id and slug", () => {
    const badId = sanitizeRelatedRequest("not-an-id", null, 8, 12);
    assert.equal(badId.rejected, true);
    const badSlug = sanitizeRelatedRequest(null, "../evil", 8, 12);
    assert.equal(badSlug.rejected, true);
    const ok = sanitizeRelatedRequest("kao_00013e7cc777f411", null, 8, 12);
    assert.equal(ok.rejected, false);
    assert.ok(KAOMOJI_ID_RE.test(ok.canonicalId!));
  });

  it("sanitize caps limits at 24", () => {
    const s = sanitizeRelatedRequest("kao_00013e7cc777f411", null, 99, 99);
    assert.equal(s.similarLimit, 24);
    assert.equal(s.relatedLimit, 24);
  });

  it("d1 related query is bounded and excludes self", () => {
    assert.match(D1_GET_RELATED_KAOMOJI, /LIMIT \?2/);
    assert.match(D1_GET_RELATED_KAOMOJI, /to_canonical_id != \?1/);
    assert.match(D1_GET_RELATED_KAOMOJI, /is_public = 1/);
    assert.ok(D1_RELATIONSHIP_FETCH_LIMIT <= 48);
  });

  it("d1 category fallback query is bounded", () => {
    assert.match(D1_GET_SAME_CATEGORY_PEERS, /LIMIT \?2/);
    assert.match(D1_GET_SAME_CATEGORY_PEERS, /is_public = 1/);
  });

  it("editorial bundle uses relationships without self", () => {
    const editorialPath = join(process.cwd(), "data/kaomoji/processed/phase-12/public-quality/editorial.json");
    const relPath = join(process.cwd(), "data/kaomoji/processed/phase-12/public-quality/relationships.json");
    if (!existsSync(editorialPath) || !existsSync(relPath)) return;
    const records = JSON.parse(readFileSync(editorialPath, "utf8")) as KaomojiEditorialRecord[];
    const rels = JSON.parse(readFileSync(relPath, "utf8")) as KaomojiRelationship[];
    const source = records.find((r) => r.canonical_id === "kao_00013e7cc777f411");
    assert.ok(source);
    const byId = new Map(records.map((r) => [r.canonical_id, r]));
    const bundle = resolveEditorialRelatedBundle(source!, rels, byId);
    const ids = [...bundle.similar, ...bundle.related].map((h) => h.canonical_id);
    assert.ok(ids.length >= 4);
    assert.ok(!ids.includes(source!.canonical_id));
    assert.equal(new Set(ids).size, ids.length);
  });

  it("search benchmark remains 122/122", () => {
    if (!hasSearchIndex || !idx) return;
    const bench = evaluateBenchmark((q, l) => searchKaomojiV2(idx, q, l).length);
    assert.equal(bench.pass, bench.total);
    assert.equal(bench.pass, 122);
  });
});
