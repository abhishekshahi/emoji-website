import type { MetadataFields, MetadataRecordType, NameConflictKind } from "./types";

export interface RawMetadataInput {
  source: string;
  sourceVersion: string;
  sourceId: string;
  rawName: string | null;
  rawEmoji: string | null;
  rawCodepoints: string[];
  rawSequence: string;
  rawMetadata: Record<string, unknown>;
  rawLicense: string;
  sourceURL: string;
  recordType: MetadataRecordType;
}

export const METADATA_SOURCE_BUCKET: Record<string, keyof import("./types").CanonicalMetadataProviderRefs> = {
  openmoji: "openmoji",
  "unicode-emoji-data": "unicode",
  unicode: "cldr",
  emojibase: "emojibase",
  emojilib: "emojilib",
  emojinet: "emojinet",
  fluent: "fluent",
  "emoji-time": "emojiTime",
  noto: "noto",
  twemoji: "twemoji",
};

export const PROVIDER_METADATA_AVAILABLE: Record<string, boolean> = {
  openmoji: true,
  "unicode-emoji-data": true,
  unicode: true,
  emojibase: true,
  emojilib: true,
  emojinet: true,
  fluent: true,
  "emoji-time": true,
  noto: false,
  twemoji: false,
};

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asVersion(value: unknown): string | null {
  if (typeof value === "number") {
    return String(value);
  }
  return asString(value);
}

export function buildMetadataRecordId(source: string, sourceId: string): string {
  return `${source}:${sourceId}`;
}

export function buildRawMetadataRef(source: string, sourceId: string): string {
  return `master/raw/raw-metadata-records.json#${source}:${sourceId}`;
}

export function buildSourceMetadataRef(source: string, sourceId: string): string {
  return `master/raw/raw-source-records.json#${source}:${sourceId}`;
}

export function extractMetadataFields(record: RawMetadataInput): MetadataFields {
  const metadata = record.rawMetadata;
  const base: MetadataFields = {
    name: record.rawName,
    shortName: null,
    label: null,
    aliases: [],
    shortcodes: [],
    keywords: [],
    tags: [],
    description: null,
    definition: null,
    category: null,
    group: null,
    subgroup: null,
    emojiVersion: null,
    unicodeVersion: null,
    gender: null,
    skinTone: null,
    variants: [],
    annotations: [],
    semanticConcepts: [],
    relatedTerms: [],
    sourceSpecificIds: { sourceId: record.sourceId },
    locale: "en",
    metadataAvailable: PROVIDER_METADATA_AVAILABLE[record.source] ?? true,
  };

  if (record.source === "openmoji") {
    return {
      ...base,
      label: asString(metadata.annotation) ?? record.rawName,
      name: asString(metadata.annotation) ?? record.rawName,
      tags: asStringArray(metadata.tags).concat(asStringArray(metadata.openmoji_tags)),
      keywords: asStringArray(metadata.openmoji_tags),
      group: asString(metadata.group),
      subgroup: asString(metadata.subgroups),
      emojiVersion: asVersion(metadata.unicode),
      annotations: asStringArray(metadata.annotation),
      sourceSpecificIds: {
        ...base.sourceSpecificIds,
        hexcode: asString(metadata.hexcode) ?? "",
        openmoji_author: asString(metadata.openmoji_author) ?? "",
      },
    };
  }

  if (record.source === "unicode") {
    return {
      ...base,
      label: asString(metadata.label) ?? record.rawName,
      name: asString(metadata.label) ?? record.rawName,
      keywords: asStringArray(metadata.tags),
      tags: asStringArray(metadata.tags),
      group: asString(metadata.group),
      subgroup: asString(metadata.subgroup),
      emojiVersion: asVersion(metadata.version),
      annotations: asStringArray(metadata.tags),
    };
  }

  if (record.source === "unicode-emoji-data") {
    return {
      ...base,
      name: record.rawName,
      label: record.rawName,
      description: asString(metadata.comment),
      emojiVersion: asString(metadata.status),
      unicodeVersion: asString(metadata.fileName),
      annotations: asStringArray(metadata.comment),
      sourceSpecificIds: {
        ...base.sourceSpecificIds,
        hexcode: asString(metadata.hexcode) ?? "",
        status: asString(metadata.status) ?? "",
        fileName: asString(metadata.fileName) ?? "",
      },
    };
  }

  if (record.source === "emojibase") {
    return {
      ...base,
      label: asString(metadata.label) ?? record.rawName,
      name: asString(metadata.label) ?? record.rawName,
      keywords: asStringArray(metadata.tags),
      tags: asStringArray(metadata.tags),
      shortcodes: asStringArray(metadata.shortcodes),
      group: asString(metadata.group),
      subgroup: asString(metadata.subgroup),
      emojiVersion: asVersion(metadata.version),
      gender: asString(metadata.gender),
      skinTone: asString(metadata.skinTone) ?? (metadata.tone != null ? String(metadata.tone) : null),
      sourceSpecificIds: {
        ...base.sourceSpecificIds,
        hexcode: asString(metadata.hexcode) ?? "",
      },
    };
  }

  if (record.source === "emojilib") {
    return {
      ...base,
      name: record.rawName,
      keywords: asStringArray(metadata.keywords),
      tags: asStringArray(metadata.keywords),
    };
  }

  if (record.source === "emojinet") {
    const isSemantic = record.recordType === "semantic";
    return {
      ...base,
      name: asString(metadata.name) ?? record.rawName,
      shortcodes: asString(metadata.shortcode) ? [String(metadata.shortcode)] : [],
      keywords: asStringArray(metadata.keywords),
      definition: asString(metadata.definition),
      description: isSemantic ? asStringArray(metadata.definitions).join(" ") : asString(metadata.definition),
      category: asString(metadata.category),
      annotations: asStringArray(metadata.keywords),
      semanticConcepts: asStringArray(metadata.babelNetId),
      relatedTerms: asStringArray(metadata.partOfSpeech),
      sourceSpecificIds: {
        ...base.sourceSpecificIds,
        babelNetId: asString(metadata.babelNetId) ?? "",
        partOfSpeech: asString(metadata.partOfSpeech) ?? "",
        unicode: asString(metadata.unicode) ?? "",
      },
    };
  }

  if (record.source === "fluent") {
    return {
      ...base,
      name: asString(metadata.cldr) ?? record.rawName,
      label: asString(metadata.cldr) ?? record.rawName,
      shortName: asString(metadata.tts),
      keywords: asStringArray(metadata.keywords),
      tags: asStringArray(metadata.keywords),
      group: asString(metadata.group),
      emojiVersion: asVersion(metadata.fromVersion),
      annotations: asStringArray(metadata.mappedToEmoticons),
      sourceSpecificIds: {
        ...base.sourceSpecificIds,
        unicode: asString(metadata.unicode) ?? "",
        glyph: asString(metadata.glyph) ?? "",
      },
    };
  }

  if (record.source === "emoji-time") {
    return {
      ...base,
      name: record.rawName,
      description: `clock mapping ${metadata.hour}:${metadata.halfHour ? "30" : "00"}`,
      sourceSpecificIds: {
        ...base.sourceSpecificIds,
        hour: String(metadata.hour ?? ""),
        halfHour: String(metadata.halfHour ?? ""),
        hexcode: asString(metadata.hexcode) ?? "",
      },
    };
  }

  return base;
}

export function normalizeName(value: string | null): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function classifyNameConflict(names: Record<string, string | null>): NameConflictKind {
  const values = Object.values(names).filter((value): value is string => Boolean(value && value.trim()));
  if (values.length <= 1) {
    return "exact-match";
  }

  const normalized = values.map(normalizeName);
  if (new Set(normalized).size === 1) {
    return "exact-match";
  }

  const lower = values.map((value) => value.toLowerCase());
  if (new Set(lower).size === 1) {
    return "case-difference";
  }

  const alnum = values.map((value) => value.toLowerCase().replace(/[^a-z0-9]+/g, ""));
  if (new Set(alnum).size === 1) {
    return "punctuation-difference";
  }

  const tokens = values.map((value) => new Set(normalizeName(value).split(" ")));
  const shared = [...tokens[0]].filter((token) => tokens.every((set) => set.has(token)));
  if (shared.length > 0) {
    return "wording-difference";
  }

  return "substantive-conflict";
}

export function canonicalSourceBucket(source: string): keyof import("./types").CanonicalMetadataProviderRefs | null {
  return METADATA_SOURCE_BUCKET[source] ?? null;
}
