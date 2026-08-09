import type { RawMetadataIndexRecord } from "../metadata/types";
import type { CanonicalEmojiRecord } from "../canonical/types";
import type {
  AliasType,
  CanonicalAlias,
  CanonicalNameRecord,
  NameConflictCategory,
  SourceNameEntry,
} from "./types";
import {
  isLikelyDefinition,
  isRegionalPair,
  normalizeForComparison,
  normalizeWhitespace,
  singularizeToken,
  tokenizeWords,
} from "./normalize";

export const UNICODE_NAME_PRIORITY: Array<{ source: string; label: string }> = [
  { source: "unicode-emoji-data", label: "unicode" },
  { source: "unicode", label: "cldr" },
  { source: "openmoji", label: "openmoji" },
  { source: "emojibase", label: "emojibase" },
  { source: "emojilib", label: "emojilib" },
  { source: "fluent", label: "fluent" },
  { source: "emojinet", label: "emojinet" },
  { source: "emoji-time", label: "emojiTime" },
];

const SOURCE_BUCKET_LABEL: Record<string, string> = {
  "unicode-emoji-data": "unicode",
  unicode: "cldr",
  openmoji: "openmoji",
  emojibase: "emojibase",
  emojilib: "emojilib",
  emojinet: "emojinet",
  fluent: "fluent",
  "emoji-time": "emojiTime",
};

export function sourceBucketLabel(source: string): string {
  return SOURCE_BUCKET_LABEL[source] ?? source;
}

export function extractUnicodeEmojiDataName(record: RawMetadataIndexRecord): string | null {
  const status = typeof record.rawMetadata.status === "string" ? record.rawMetadata.status : "";
  const semicolon = status.indexOf(";");
  if (semicolon >= 0) {
    const extracted = normalizeWhitespace(status.slice(semicolon + 1));
    if (extracted && !/^fully-qualified$/i.test(extracted)) {
      return extracted;
    }
  }

  const candidates = [record.rawName, record.fields.name, record.fields.label];
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const parsed = parseEmojiTestComment(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function parseEmojiTestComment(value: string): string | null {
  const normalized = normalizeWhitespace(value);
  const flagMatch = normalized.match(/^(?:\p{Extended_Pictographic}|\p{Regional_Indicator})+\s+E[\d.]+\s+flag:\s*(.+)$/u);
  if (flagMatch) {
    return `flag: ${flagMatch[1]}`;
  }

  const namedMatch = normalized.match(/^(?:\p{Extended_Pictographic}|\p{Regional_Indicator})+\s+E[\d.]+\s+(.+)$/u);
  if (namedMatch) {
    return normalizeWhitespace(namedMatch[1]);
  }

  const parenOnly = normalized.match(/^E[\d.]+\s+\[[^\]]+\]\s+\((.+)\)$/u);
  if (parenOnly) {
    return null;
  }

  return null;
}

export function extractRecordName(record: RawMetadataIndexRecord): string | null {
  if (record.source === "unicode-emoji-data") {
    return extractUnicodeEmojiDataName(record) ?? normalizeWhitespace(record.fields.label ?? record.rawName ?? "");
  }

  if (record.recordType === "semantic") {
    return normalizeWhitespace(record.fields.name ?? record.rawName ?? "") || null;
  }

  const value =
    record.fields.label ??
    record.fields.name ??
    record.rawName ??
    null;

  return value ? normalizeWhitespace(value) : null;
}

export function collectSourceNames(records: RawMetadataIndexRecord[]): SourceNameEntry[] {
  const bySource = new Map<string, SourceNameEntry>();

  for (const record of records) {
    if (record.recordType === "semantic") {
      continue;
    }

    const value = extractRecordName(record);
    if (!value || isLikelyDefinition(value)) {
      continue;
    }

    const source = sourceBucketLabel(record.source);
    const existing = bySource.get(source);
    if (!existing || record.recordType === "metadata" || record.recordType === "standard-data") {
      bySource.set(source, {
        source,
        sourceId: record.sourceId,
        value,
        metadataRecordId: record.metadataRecordId,
      });
    }
  }

  return [...bySource.values()].sort((left, right) => left.source.localeCompare(right.source));
}

export function classifyNameRelationship(left: string, right: string): NameConflictCategory {
  const a = normalizeWhitespace(left);
  const b = normalizeWhitespace(right);
  if (!a || !b) {
    return "source-specific-naming";
  }

  const normA = normalizeForComparison(a);
  const normB = normalizeForComparison(b);
  if (normA === normB) {
    return "exact-equivalent";
  }

  if (a.toLowerCase() === b.toLowerCase()) {
    return "capitalization-difference";
  }

  const punctA = a.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const punctB = b.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (punctA === punctB) {
    return "punctuation-difference";
  }

  const tokensA = tokenizeWords(a);
  const tokensB = tokenizeWords(b);
  const singularA = tokensA.map(singularizeToken).join(" ");
  const singularB = tokensB.map(singularizeToken).join(" ");
  if (singularA === singularB) {
    return "singular-plural-difference";
  }

  if (isRegionalPair(a, b)) {
    return "regional-terminology";
  }

  const shared = tokensA.filter((token) => tokensB.includes(token));
  if (shared.length > 0 && shared.length >= Math.min(tokensA.length, tokensB.length) - 1) {
    return "wording-difference";
  }

  if (shared.length > 0) {
    return "synonym";
  }

  if (/^E\d+\.\d+/i.test(a) || /^E\d+\.\d+/i.test(b) || /\(.*\)/.test(a) || /\(.*\)/.test(b)) {
    return "source-specific-naming";
  }

  return "semantic-difference";
}

export function classifyConflictGroup(names: Record<string, string>): NameConflictCategory {
  const values = Object.values(names).filter(Boolean);
  if (values.length <= 1) {
    return "exact-equivalent";
  }

  let category: NameConflictCategory = "exact-equivalent";
  for (let index = 0; index < values.length; index += 1) {
    for (let inner = index + 1; inner < values.length; inner += 1) {
      const relation = classifyNameRelationship(values[index], values[inner]);
      category = mergeConflictCategories(category, relation);
    }
  }

  return category;
}

function mergeConflictCategories(
  current: NameConflictCategory,
  next: NameConflictCategory,
): NameConflictCategory {
  const priority: NameConflictCategory[] = [
    "exact-equivalent",
    "capitalization-difference",
    "punctuation-difference",
    "singular-plural-difference",
    "wording-difference",
    "regional-terminology",
    "synonym",
    "source-specific-naming",
    "semantic-difference",
  ];

  return priority.indexOf(next) > priority.indexOf(current) ? next : current;
}

export function selectCanonicalName(
  canonical: CanonicalEmojiRecord,
  sourceNames: SourceNameEntry[],
): { canonicalName: string; nameSource: string; nameSelectionRule: string } {
  if (!canonical.isUnicode) {
    return selectSourceSpecificName(canonical, sourceNames);
  }

  for (const priority of UNICODE_NAME_PRIORITY) {
    const match = sourceNames.find((entry) => entry.source === priority.label);
    if (match?.value) {
      return {
        canonicalName: match.value,
        nameSource: match.source,
        nameSelectionRule: `unicode-priority:${priority.label}`,
      };
    }
  }

  const fallback = deriveNameFromCanonicalId(canonical.canonicalId);
  return {
    canonicalName: fallback,
    nameSource: "derived",
    nameSelectionRule: "unicode-fallback:canonical-id",
  };
}

function selectSourceSpecificName(
  canonical: CanonicalEmojiRecord,
  sourceNames: SourceNameEntry[],
): { canonicalName: string; nameSource: string; nameSelectionRule: string } {
  const preferredSources = canonical.metadataSources.length > 0 ? canonical.metadataSources : [canonical.canonicalId.split(":")[1]];

  for (const source of preferredSources) {
    const label = sourceBucketLabel(source);
    const match = sourceNames.find((entry) => entry.source === label || entry.source === source);
    if (match?.value) {
      return {
        canonicalName: match.value,
        nameSource: match.source,
        nameSelectionRule: `source-specific-priority:${match.source}`,
      };
    }
  }

  if (sourceNames[0]?.value) {
    return {
      canonicalName: sourceNames[0].value,
      nameSource: sourceNames[0].source,
      nameSelectionRule: "source-specific-fallback:first-available",
    };
  }

  return {
    canonicalName: deriveNameFromCanonicalId(canonical.canonicalId),
    nameSource: "derived",
    nameSelectionRule: "source-specific-fallback:canonical-id",
  };
}

function deriveNameFromCanonicalId(canonicalId: string): string {
  if (canonicalId.startsWith("unicode:")) {
    return canonicalId.slice("unicode:".length).toLowerCase();
  }

  const tail = canonicalId.split(":").slice(2).join(":") || canonicalId;
  return normalizeWhitespace(tail.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
}

function aliasTypeForCategory(category: NameConflictCategory): AliasType {
  switch (category) {
    case "regional-terminology":
      return "regional";
    case "synonym":
      return "synonym";
    case "semantic-difference":
      return "semantic-label";
    case "source-specific-naming":
      return "source-specific";
    default:
      return "alternate-wording";
  }
}

export function buildAliases(
  canonicalId: string,
  canonicalName: string,
  sourceNames: SourceNameEntry[],
): CanonicalAlias[] {
  const aliases: CanonicalAlias[] = [];
  const seen = new Set<string>();

  for (const entry of sourceNames) {
    const relation = classifyNameRelationship(canonicalName, entry.value);
    if (relation === "exact-equivalent") {
      continue;
    }
    if (isLikelyDefinition(entry.value)) {
      continue;
    }

    const key = normalizeForComparison(entry.value);
    if (!key || key === normalizeForComparison(canonicalName) || seen.has(key)) {
      continue;
    }

    seen.add(key);
    aliases.push({
      value: entry.value,
      source: entry.source,
      type: relation === "source-specific-naming" ? "source-specific" : aliasTypeForCategory(relation),
      canonicalId,
      metadataRecordId: entry.metadataRecordId,
    });
  }

  return aliases.sort((left, right) => left.value.localeCompare(right.value));
}

export function buildCanonicalNameRecord(
  canonical: CanonicalEmojiRecord,
  records: RawMetadataIndexRecord[],
): CanonicalNameRecord {
  const sourceNames = collectSourceNames(records);
  const selected = selectCanonicalName(canonical, sourceNames);
  const namesBySource = Object.fromEntries(sourceNames.map((entry) => [entry.source, entry.value]));
  const conflictCategory =
    Object.keys(namesBySource).length > 1 ? classifyConflictGroup(namesBySource) : null;

  return {
    canonicalId: canonical.canonicalId,
    isUnicode: canonical.isUnicode,
    identityType: canonical.identityType,
    canonicalName: selected.canonicalName,
    nameSource: selected.nameSource,
    nameSelectionRule: selected.nameSelectionRule,
    sourceNames,
    aliases: buildAliases(canonical.canonicalId, selected.canonicalName, sourceNames),
    conflictCategory,
  };
}
