import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import type { CanonicalEmojiRecord } from "@/lib/master/canonical/types";
import type { RawMetadataIndexRecord } from "@/lib/master/metadata/types";
import type {
  CanonicalKeywordEntry,
  CanonicalNameRecord,
  NameReconciliationReport,
} from "@/lib/master/reconciliation/types";
import { buildSemanticLayer } from "@/lib/master/semantic/build";
import type {
  CanonicalSemanticIndexEntry,
  SemanticSeoPolicyReport,
  SemanticSourceRecord,
} from "@/lib/master/semantic/types";

const masterDir = join(process.cwd(), "src", "data", "master");
const metadataDir = join(masterDir, "metadata");
const semanticDir = join(masterDir, "semantic");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function loadBuiltSemantic() {
  return buildSemanticLayer({
    canonicalRecords: readJson<CanonicalEmojiRecord[]>(join(masterDir, "canonical-emojis.json")),
    rawMetadataIndex: readJson<RawMetadataIndexRecord[]>(join(metadataDir, "raw-metadata-index.json")),
    canonicalNameRecords: readJson<CanonicalNameRecord[]>(join(metadataDir, "canonical-name-records.json")),
    canonicalKeywords: readJson<CanonicalKeywordEntry[]>(join(metadataDir, "canonical-keywords.json")),
    nameReconciliationReport: readJson<NameReconciliationReport>(join(metadataDir, "name-reconciliation-report.json")),
  });
}

function findSemantic(records: CanonicalSemanticIndexEntry[], canonicalId: string): CanonicalSemanticIndexEntry {
  const record = records.find((entry) => entry.canonicalId === canonicalId);
  assert.ok(record, `Missing semantic record for ${canonicalId}`);
  return record;
}

describe("semantic master layer", () => {
  const built = loadBuiltSemantic();
  const persistedSource = readJson<SemanticSourceRecord[]>(join(semanticDir, "semantic-source-index.json"));
  const report = readJson<SemanticSeoPolicyReport>(join(semanticDir, "semantic-seo-policy-report.json"));
  const rawMetadata = readJson<RawMetadataIndexRecord[]>(join(metadataDir, "raw-metadata-index.json"));

  it("preserves all 15,183 EmojiNet semantic records in semantic-source-index", () => {
    assert.equal(built.semanticSourceIndex.length, 15183);
    assert.equal(persistedSource.length, 15183);
    assert.equal(report.preservation.emojinetSenses, 15183);
  });

  it("preserves all 17,572 definitions without turning them into SEO keywords", () => {
    assert.equal(built.semanticDefinitionsIndex.length, 17572);
    assert.equal(report.preservation.emojinetDefinitions, 17572);
    const fireDefs = built.semanticDefinitionsIndex.filter((entry) => entry.canonicalId === "unicode:1F525");
    assert.ok(fireDefs.length >= 1);
    const fireSemantic = findSemantic(built.canonicalSemanticIndex, "unicode:1F525");
    assert.ok(fireSemantic.safeSeoTerms.every((term) => !term.term.includes("http")));
  });

  it("keeps fire semantic terms with provenance and safe search separation", () => {
    const fire = findSemantic(built.canonicalSemanticIndex, "unicode:1F525");
    assert.ok(fire.sourceSemantics.length > 0);
    assert.ok(fire.safeSearchTerms.some((term) => term.normalizedTerm === "flame"));
    assert.ok(fire.sourceSemantics.every((term) => term.sourceRecord && term.sourceVersion));
  });

  it("preserves thumbs up, skin tone, ZWJ, and flag semantic data separately", () => {
    const thumbs = findSemantic(built.canonicalSemanticIndex, "unicode:1F44D");
    const skin = findSemantic(built.canonicalSemanticIndex, "unicode:1F44D-1F3FB");
    const technologist = findSemantic(built.canonicalSemanticIndex, "unicode:1F468-200D-1F4BB");
    const india = findSemantic(built.canonicalSemanticIndex, "unicode:1F1EE-1F1F3");
    assert.notEqual(thumbs.canonicalId, skin.canonicalId);
    assert.ok(thumbs.sourceSemantics.length > 0);
    assert.ok(skin.sourceSemantics.length > 0);
    assert.ok(technologist.sourceSemantics.length > 0);
    assert.ok(india.sourceSemantics.length > 0);
  });

  it("preserves EmojiNet multi-sense records without flattening", () => {
    const fireSenses = built.semanticSourceIndex.filter((entry) => entry.canonicalId === "unicode:1F525");
    assert.ok(fireSenses.length >= 2);
    assert.ok(fireSenses.every((entry) => entry.senseId));
    assert.ok(new Set(fireSenses.map((entry) => entry.senseId)).size >= 2);
  });

  it("preserves Emojilib keywords while classifying contextual terms", () => {
    const fire = findSemantic(built.canonicalSemanticIndex, "unicode:1F525");
    const snapstreak = fire.sourceSemantics.find((term) => term.normalizedTerm === "snapstreak");
    assert.ok(snapstreak);
    assert.equal(snapstreak.source, "emojilib");
    assert.equal(snapstreak.publicSeo, false);
  });

  it("preserves Emojibase tags as source semantics", () => {
    const fire = findSemantic(built.canonicalSemanticIndex, "unicode:1F525");
    assert.ok(fire.sourceSemantics.some((term) => term.source === "emojibase"));
  });

  it("marks ambiguous term hot as not publicly searchable when overly broad", () => {
    const hotTerm = built.semanticSearchTerms.find((entry) => entry.normalizedTerm === "hot");
    assert.ok(hotTerm);
    assert.equal(hotTerm.ambiguous, true);
    assert.equal(hotTerm.publicSearch, false);
    assert.ok(hotTerm.canonicalIds.length >= 8);
  });

  it("audits all 676 semantic-difference conflicts without auto-exposing aliases", () => {
    assert.equal(report.counts.semanticDifferenceConflicts, 676);
    const audited = built.canonicalSemanticIndex.filter((entry) => entry.semanticDifferenceAudit);
    assert.equal(audited.length, 676);
    assert.ok(audited.every((entry) => entry.semanticDifferenceAudit?.publicSearchStatus === "source-only"));
    assert.ok(audited.every((entry) => entry.semanticDifferenceAudit?.publicSeoStatus === "source-only"));
  });

  it("uses source-authoritative semantics for OpenMoji private-use", () => {
    const pua = findSemantic(built.canonicalSemanticIndex, "source:openmoji:E000");
    assert.equal(pua.identityType, "private-use");
    assert.ok(pua.sourceSemantics.length >= 0);
    assert.ok(pua.safeSeoTerms.every((term) => term.publicSeo));
  });

  it("does not modify raw metadata or production data", () => {
    assert.equal(rawMetadata.length, 42910);
    const sample = rawMetadata.find((entry) => entry.metadataRecordId === "emojinet:emojinet:1F525:sense:adjectives:bn:13770005a:0");
    const rebuilt = readJson<RawMetadataIndexRecord[]>(join(metadataDir, "raw-metadata-index.json")).find(
      (entry) => entry.metadataRecordId === "emojinet:emojinet:1F525:sense:adjectives:bn:13770005a:0",
    );
    assert.deepEqual(rebuilt?.rawMetadata, sample?.rawMetadata);
    assert.equal(emojis.length, 3944);
    assert.equal(extras.length, 542);
  });

  it("creates separate canonical-semantic-search and semantic-seo-index layers", () => {
    const fireSearch = findSemantic(
      readJson<CanonicalSemanticIndexEntry[]>(join(semanticDir, "canonical-semantic-search.json")),
      "unicode:1F525",
    );
    const fireSeo = findSemantic(
      readJson<CanonicalSemanticIndexEntry[]>(join(semanticDir, "semantic-seo-index.json")),
      "unicode:1F525",
    );
    assert.ok(fireSearch.safeSearchTerms.length > 0);
    assert.ok(fireSeo.safeSeoTerms.length > 0);
    assert.ok(fireSearch.safeSeoTerms.length === 0);
  });
});
