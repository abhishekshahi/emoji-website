import type { RawMetadataIndexRecord } from "../metadata/types";
import type { SemanticTermClassification } from "./types";
import { isLikelyDefinition, normalizeForComparison, normalizeKeyword } from "../reconciliation/normalize";

export const SOURCE_AUTHORITY: Record<string, number> = {
  "unicode-emoji-data": 100,
  unicode: 95,
  cldr: 95,
  emojibase: 85,
  emojilib: 80,
  openmoji: 70,
  fluent: 65,
  emojinet: 50,
  "emoji-time": 40,
};

export const AMBIGUITY_THRESHOLD = 8;

const INAPPROPRIATE_SEO_PATTERNS = [/https?:\/\//i, /emojipedia/i, /www\./i, /u\+[0-9a-f]/i];
const CONTEXTUAL_TERMS = new Set([
  "snapstreak",
  "litaf",
  "af",
  "lit",
  "tool",
  "exemplar",
  "streak",
]);
const SPECIALIZED_TERMS = new Set([
  "babelnet",
  "regional indicator",
  "variation selector",
  "zwj",
  "fitzpatrick",
]);

export function sourceAuthority(source: string): number {
  return SOURCE_AUTHORITY[source] ?? 40;
}

export function isInappropriatePublicSeo(term: string): boolean {
  if (term.length > 40) {
    return true;
  }
  if (INAPPROPRIATE_SEO_PATTERNS.some((pattern) => pattern.test(term))) {
    return true;
  }
  if (isLikelyDefinition(term)) {
    return true;
  }
  return false;
}

export function classifySemanticTerm(input: {
  term: string;
  source: string;
  canonicalName: string;
  isDefinition: boolean;
  isSenseKeyword: boolean;
  isTag: boolean;
  isEmojiTime: boolean;
  isSourceSpecificIdentity: boolean;
  globalIdentityCount: number;
}): { classification: SemanticTermClassification; reason: string } {
  const normalized = normalizeKeyword(input.term);
  const canonicalNorm = normalizeForComparison(input.canonicalName);

  if (!normalized) {
    return { classification: "unresolved", reason: "empty-term" };
  }

  if (input.isDefinition) {
    return { classification: "source-specific-term", reason: "definition-is-informational-not-keyword" };
  }

  if (input.isEmojiTime) {
    return { classification: "source-specific-term", reason: "emoji-time-specialized-mapping" };
  }

  if (isInappropriatePublicSeo(normalized)) {
    return { classification: "inappropriate-public-seo", reason: "url-or-definition-like-content" };
  }

  if (input.globalIdentityCount >= AMBIGUITY_THRESHOLD) {
    return { classification: "potentially-confusing", reason: `ambiguous-across-${input.globalIdentityCount}-identities` };
  }

  if (input.isSourceSpecificIdentity && input.source !== "openmoji") {
    return { classification: "source-specific-term", reason: "source-specific-identity-term" };
  }

  if (normalizeForComparison(normalized) === canonicalNorm) {
    return { classification: "exact-canonical-meaning", reason: "matches-canonical-name" };
  }

  if (canonicalNorm.includes(normalizeForComparison(normalized)) || normalizeForComparison(normalized).includes(canonicalNorm)) {
    if (sourceAuthority(input.source) >= 80) {
      return { classification: "direct-synonym", reason: "high-authority-name-overlap" };
    }
    return { classification: "common-alternate-term", reason: "partial-name-overlap" };
  }

  if (CONTEXTUAL_TERMS.has(normalized)) {
    return { classification: "contextual-association", reason: "known-contextual-social-media-term" };
  }

  if (SPECIALIZED_TERMS.has(normalized)) {
    return { classification: "specialized-terminology", reason: "technical-unicode-or-ontology-term" };
  }

  if (input.isSenseKeyword) {
    return { classification: "related-concept", reason: "emojinet-sense-keyword" };
  }

  if (input.source === "emojinet") {
    return { classification: "related-concept", reason: "emojinet-semantic-association" };
  }

  if (sourceAuthority(input.source) >= 85) {
    return { classification: "direct-synonym", reason: "high-authority-keyword" };
  }

  if (sourceAuthority(input.source) >= 70) {
    return { classification: "common-alternate-term", reason: "medium-authority-descriptor" };
  }

  if (input.isTag) {
    return { classification: "contextual-association", reason: "openmoji-descriptive-tag" };
  }

  return { classification: "unresolved", reason: "insufficient-signal" };
}

export function isPublicSearchSafe(classification: SemanticTermClassification): boolean {
  return [
    "exact-canonical-meaning",
    "direct-synonym",
    "common-alternate-term",
  ].includes(classification);
}

export function isPublicSeoSafe(classification: SemanticTermClassification): boolean {
  return ["exact-canonical-meaning", "direct-synonym"].includes(classification);
}

export function extractSenseId(record: RawMetadataIndexRecord): string | null {
  if (record.recordType !== "semantic") {
    return null;
  }
  const parts = record.sourceId.split(":");
  return parts.length >= 3 ? parts.slice(2).join(":") : record.sourceId;
}

function toSemanticRecordType(
  recordType: RawMetadataIndexRecord["recordType"],
): import("./types").SemanticSourceRecord["recordType"] {
  switch (recordType) {
    case "semantic":
    case "metadata":
    case "standard-data":
    case "utility":
      return recordType;
    default:
      return "metadata";
  }
}

export function buildSemanticSourceRecord(record: RawMetadataIndexRecord): import("./types").SemanticSourceRecord {
  const metadata = record.rawMetadata;
  return {
    metadataRecordId: record.metadataRecordId,
    source: record.source,
    sourceVersion: record.sourceVersion,
    sourceId: record.sourceId,
    canonicalId: record.canonicalId,
    recordType: toSemanticRecordType(record.recordType),
    emoji: record.rawEmoji,
    name: record.fields.name ?? record.rawName,
    keywords: [...new Set([...record.fields.keywords, ...record.fields.tags])],
    definition: record.fields.definition ?? null,
    partOfSpeech: typeof metadata.partOfSpeech === "string" ? metadata.partOfSpeech : null,
    babelNetId: typeof metadata.babelNetId === "string" ? metadata.babelNetId : null,
    senseId: extractSenseId(record),
    category: typeof metadata.category === "string" ? metadata.category : record.fields.category,
    semanticRelationship: record.recordType === "semantic" ? "sense" : null,
    sourceURL: record.sourceURL,
    rawRecordRef: record.rawRecordRef,
    provenance: {
      source: record.source,
      sourceId: record.sourceId,
      sourceVersion: record.sourceVersion,
      rawRecordRef: record.rawRecordRef,
    },
  };
}
