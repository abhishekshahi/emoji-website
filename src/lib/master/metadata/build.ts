import type {
  CanonicalMetadataIndexEntry,
  CanonicalMetadataProviderRefs,
  MetadataAuditReport,
  MetadataCoverageEntry,
  MetadataKeywordIndexEntry,
  MetadataNameConflictEntry,
  MetadataProviderAvailability,
  MetadataRecordType,
  MetadataSourceIndexRecord,
  RawMetadataIndexRecord,
  ShortcodeSourceIndexEntry,
} from "./types";
import {
  buildMetadataRecordId,
  buildRawMetadataRef,
  buildSourceMetadataRef,
  canonicalSourceBucket,
  classifyNameConflict,
  extractMetadataFields,
  type RawMetadataInput,
} from "./extract";

export interface MetadataIdentityMapping {
  source: string;
  sourceId: string;
  canonicalIdentity: string;
}

export interface EmojibaseShortcodePacks {
  emojibase?: Record<string, string | string[]>;
  cldr?: Record<string, string | string[]>;
  github?: Record<string, string | string[]>;
  iamcal?: Record<string, string | string[]>;
}

export interface BuildMetadataDatabaseInput {
  rawMetadataRecords: RawMetadataInput[];
  unicodeEmojiDataRecords: RawMetadataInput[];
  metadataIdentityIndex: MetadataIdentityMapping[];
  rawToCanonicalIndex: Array<{ source: string; sourceId: string; canonicalIdentity: string }>;
  canonicalIds: string[];
  emojibaseShortcodes: EmojibaseShortcodePacks;
  providerLicenses: Record<string, { license: string; licenseURL: string; attribution: string | null; version: string }>;
}

export interface BuildMetadataDatabaseResult {
  rawMetadataIndex: RawMetadataIndexRecord[];
  metadataSourceIndex: MetadataSourceIndexRecord[];
  canonicalMetadataIndex: CanonicalMetadataIndexEntry[];
  metadataNameConflicts: MetadataNameConflictEntry[];
  metadataKeywordIndex: MetadataKeywordIndexEntry[];
  shortcodeSourceIndex: ShortcodeSourceIndexEntry[];
  metadataCoverageReport: MetadataCoverageEntry[];
  metadataProviderAvailability: MetadataProviderAvailability[];
  auditReport: MetadataAuditReport;
}

function emptyProviderRefs(): CanonicalMetadataProviderRefs {
  return {
    openmoji: [],
    cldr: [],
    emojibase: [],
    emojilib: [],
    emojinet: [],
    fluent: [],
    emojiTime: [],
    noto: [],
    twemoji: [],
    unicode: [],
  };
}

function normalizeShortcodePackValue(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function countFields(fields: RawMetadataIndexRecord["fields"]): number {
  return Object.values(fields).filter((value) => {
    if (value === null || value === false) {
      return false;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === "object") {
      return Object.keys(value).length > 0;
    }
    return true;
  }).length;
}

export function buildMetadataDatabase(input: BuildMetadataDatabaseInput): BuildMetadataDatabaseResult {
  const identityByKey = new Map<string, string>();
  for (const mapping of input.metadataIdentityIndex) {
    identityByKey.set(`${mapping.source}:${mapping.sourceId}`, mapping.canonicalIdentity);
  }
  for (const mapping of input.rawToCanonicalIndex) {
    const key = `${mapping.source}:${mapping.sourceId}`;
    if (!identityByKey.has(key)) {
      identityByKey.set(key, mapping.canonicalIdentity);
    }
  }

  const allRecords: Array<RawMetadataInput & { rawRecordRef: string }> = [
    ...input.rawMetadataRecords.map((record) => ({
      ...record,
      rawRecordRef: buildRawMetadataRef(record.source, record.sourceId),
    })),
    ...input.unicodeEmojiDataRecords.map((record) => ({
      ...record,
      rawRecordRef: buildSourceMetadataRef(record.source, record.sourceId),
    })),
  ];

  const rawMetadataIndex: RawMetadataIndexRecord[] = allRecords.map((record) => {
    const metadataRecordId = buildMetadataRecordId(record.source, record.sourceId);
    const canonicalId =
      identityByKey.get(`${record.source}:${record.sourceId}`) ??
      `source:${record.source}:${record.sourceId}`;

    return {
      metadataRecordId,
      source: record.source,
      sourceVersion: record.sourceVersion,
      sourceId: record.sourceId,
      canonicalId,
      recordType: record.recordType,
      rawName: record.rawName,
      rawEmoji: record.rawEmoji,
      rawCodepoints: record.rawCodepoints,
      rawSequence: record.rawSequence,
      rawMetadata: record.rawMetadata,
      rawLicense: record.rawLicense,
      sourceURL: record.sourceURL,
      locale: "en",
      rawRecordRef: record.rawRecordRef,
      fields: extractMetadataFields(record),
    };
  });

  const metadataSourceIndex: MetadataSourceIndexRecord[] = rawMetadataIndex.map((record) => ({
    metadataRecordId: record.metadataRecordId,
    source: record.source,
    sourceId: record.sourceId,
    canonicalId: record.canonicalId,
    recordType: record.recordType,
  }));

  const canonicalMetadataMap = new Map<string, CanonicalMetadataIndexEntry>();
  for (const canonicalId of input.canonicalIds) {
    canonicalMetadataMap.set(canonicalId, {
      canonicalId,
      isUnicode: canonicalId.startsWith("unicode:"),
      metadataSourceCount: 0,
      sources: emptyProviderRefs(),
    });
  }

  for (const record of rawMetadataIndex) {
    const bucket = canonicalSourceBucket(record.source);
    if (!bucket) {
      continue;
    }

    if (!canonicalMetadataMap.has(record.canonicalId)) {
      canonicalMetadataMap.set(record.canonicalId, {
        canonicalId: record.canonicalId,
        isUnicode: record.canonicalId.startsWith("unicode:"),
        metadataSourceCount: 0,
        sources: emptyProviderRefs(),
      });
    }

    canonicalMetadataMap.get(record.canonicalId)!.sources[bucket].push(record.metadataRecordId);
  }

  const canonicalMetadataIndex = [...canonicalMetadataMap.values()]
    .map((entry) => {
      const buckets = Object.values(entry.sources).filter((refs) => refs.length > 0);
      for (const provider of Object.keys(entry.sources) as Array<keyof CanonicalMetadataProviderRefs>) {
        entry.sources[provider].sort();
      }
      return {
        ...entry,
        metadataSourceCount: buckets.length,
      };
    })
    .sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));

  const metadataKeywordIndex: MetadataKeywordIndexEntry[] = [];
  const metadataNameConflicts: MetadataNameConflictEntry[] = [];
  const shortcodeSourceIndex: ShortcodeSourceIndexEntry[] = [];

  for (const entry of canonicalMetadataIndex) {
    if (!entry.isUnicode) {
      continue;
    }

    const records = rawMetadataIndex.filter((record) => record.canonicalId === entry.canonicalId);
    const names: Record<string, string | null> = {};
    const keywords: Record<string, string[]> = {};

    for (const record of records) {
      const bucket = canonicalSourceBucket(record.source);
      if (!bucket) {
        continue;
      }

      const bucketKey = bucket === "emojiTime" ? "emojiTime" : bucket;
      if (record.fields.name || record.fields.label) {
        names[bucketKey] = record.fields.name ?? record.fields.label;
      }

      if (record.fields.keywords.length > 0 || record.fields.tags.length > 0) {
        keywords[bucketKey] = [...new Set([...record.fields.keywords, ...record.fields.tags])].sort();
      }
    }

    const nameValues = Object.values(names).filter((value): value is string => Boolean(value));
    if (nameValues.length > 1) {
      metadataNameConflicts.push({
        canonicalId: entry.canonicalId,
        classification: classifyNameConflict(names),
        names,
      });
    }

    if (Object.keys(keywords).length > 0) {
      metadataKeywordIndex.push({
        canonicalId: entry.canonicalId,
        keywords,
      });
    }

    const sequence = entry.canonicalId.startsWith("unicode:")
      ? entry.canonicalId.slice("unicode:".length)
      : null;
    if (sequence) {
      const hexKey = sequence.split("-")[0];
      const shortcodes: Record<string, string[]> = {};
      for (const pack of ["emojibase", "cldr", "github", "iamcal"] as const) {
        const packValue = input.emojibaseShortcodes[pack]?.[hexKey] ?? input.emojibaseShortcodes[pack]?.[sequence];
        const normalized = normalizeShortcodePackValue(packValue);
        if (normalized.length > 0) {
          shortcodes[pack] = normalized;
        }
      }

      const emojibaseRecord = records.find((record) => record.source === "emojibase");
      if (emojibaseRecord && emojibaseRecord.fields.shortcodes.length > 0) {
        shortcodes.emojibaseRecord = emojibaseRecord.fields.shortcodes;
      }

      const emojinetShortcodes = records
        .filter((record) => record.source === "emojinet")
        .flatMap((record) => record.fields.shortcodes);
      if (emojinetShortcodes.length > 0) {
        shortcodes.emojinet = [...new Set(emojinetShortcodes)];
      }

      if (Object.keys(shortcodes).length > 0) {
        shortcodeSourceIndex.push({
          canonicalId: entry.canonicalId,
          unicodeSequence: sequence,
          shortcodes,
        });
      }
    }
  }

  const metadataCoverageReport: MetadataCoverageEntry[] = canonicalMetadataIndex.map((entry) => ({
    canonicalId: entry.canonicalId,
    openmoji: entry.sources.openmoji.length > 0,
    unicode: entry.sources.unicode.length > 0,
    cldr: entry.sources.cldr.length > 0,
    emojibase: entry.sources.emojibase.length > 0,
    emojilib: entry.sources.emojilib.length > 0,
    emojinet: entry.sources.emojinet.length > 0,
    fluent: entry.sources.fluent.length > 0,
    emojiTime: entry.sources.emojiTime.length > 0,
    noto: entry.sources.noto.length > 0,
    twemoji: entry.sources.twemoji.length > 0,
    metadataSourceCount: entry.metadataSourceCount,
  }));

  const perSource: MetadataAuditReport["perSource"] = {};
  for (const record of rawMetadataIndex) {
    if (!perSource[record.source]) {
      perSource[record.source] = {
        recordCount: 0,
        canonicalMappings: 0,
        unmappedRecords: 0,
        nameRecords: 0,
        keywordRecords: 0,
        shortcodeRecords: 0,
        semanticRecords: 0,
        definitionRecords: 0,
        senseRecords: 0,
        aliasRecords: 0,
        fieldCount: 0,
      };
    }

    const stats = perSource[record.source];
    stats.recordCount += 1;
    stats.fieldCount += countFields(record.fields);
    if (record.canonicalId.startsWith("unicode:") || record.canonicalId.startsWith("source:")) {
      stats.canonicalMappings += 1;
    } else {
      stats.unmappedRecords += 1;
    }
    if (record.fields.name || record.fields.label) {
      stats.nameRecords += 1;
    }
    if (record.fields.keywords.length > 0 || record.fields.tags.length > 0) {
      stats.keywordRecords += 1;
    }
    if (record.fields.shortcodes.length > 0) {
      stats.shortcodeRecords += 1;
    }
    if (record.recordType === "semantic") {
      stats.semanticRecords += 1;
      stats.senseRecords += 1;
    }
    if (record.fields.definition) {
      stats.definitionRecords += 1;
    }
    if (record.fields.aliases.length > 0) {
      stats.aliasRecords += 1;
    }
  }

  const withMetadata = canonicalMetadataIndex.filter((entry) => entry.metadataSourceCount > 0);
  const withOne = withMetadata.filter((entry) => entry.metadataSourceCount === 1);
  const withTwoOrMore = withMetadata.filter((entry) => entry.metadataSourceCount >= 2);
  const withNoMetadata = canonicalMetadataIndex.filter((entry) => entry.metadataSourceCount === 0);

  const semanticRecords = rawMetadataIndex.filter((record) => record.recordType === "semantic").length;
  const definitions = rawMetadataIndex.filter((record) => record.fields.definition).length;
  const senses = rawMetadataIndex.filter((record) => record.recordType === "semantic").length;
  const aliases = rawMetadataIndex.filter((record) => record.fields.aliases.length > 0).length;

  const metadataProviderAvailability: MetadataProviderAvailability[] = [
    "openmoji",
    "unicode",
    "cldr",
    "emojibase",
    "emojilib",
    "emojinet",
    "fluent",
    "emojiTime",
    "noto",
    "twemoji",
  ].map((provider) => {
    const sourceKey =
      provider === "unicode"
        ? "unicode-emoji-data"
        : provider === "cldr"
          ? "unicode"
          : provider === "emojiTime"
            ? "emoji-time"
            : provider;
    const license = input.providerLicenses[sourceKey];
    return {
      provider: provider as MetadataProviderAvailability["provider"],
      metadataAvailable: provider !== "noto" && provider !== "twemoji",
      recordCount: perSource[sourceKey]?.recordCount ?? 0,
      license: license?.license ?? null,
      licenseURL: license?.licenseURL ?? null,
      attribution: license?.attribution ?? null,
      version: license?.version ?? null,
      locale: "en",
    };
  });

  const auditReport: MetadataAuditReport = {
    generatedAt: new Date().toISOString(),
    phase: "8.6",
    baselines: {
      rawMetadataManifest: input.rawMetadataRecords.length,
      rawSemanticRecords: input.rawMetadataRecords.filter((record) => record.recordType === "semantic").length,
      unicodeEmojiDataSourceRecords: input.unicodeEmojiDataRecords.length,
      totalMetadataMasterRecords: rawMetadataIndex.length,
    },
    perSource,
    counts: {
      uniqueMetadataRecords: rawMetadataIndex.length,
      canonicalIdentitiesWithMetadata: withMetadata.length,
      canonicalIdentitiesWithOneMetadataSource: withOne.length,
      canonicalIdentitiesWithTwoOrMoreMetadataSources: withTwoOrMore.length,
      canonicalIdentitiesWithNoMetadata: withNoMetadata.length,
      nameConflicts: metadataNameConflicts.length,
      keywordIndexEntries: metadataKeywordIndex.length,
      shortcodeIndexEntries: shortcodeSourceIndex.length,
      semanticRecords,
      definitions,
      senses,
      aliases,
    },
    constraints: {
      allSourceMetadataPreserved: true,
      noMetadataDeleted: true,
      noCanonicalIdentityModified: true,
      noArtworkModified: true,
      productionDataUnchanged: true,
    },
    note: "Metadata layer before canonical name/keyword/SEO resolution. Not final SEO counts.",
  };

  rawMetadataIndex.sort((left, right) => left.metadataRecordId.localeCompare(right.metadataRecordId));
  metadataSourceIndex.sort((left, right) => left.metadataRecordId.localeCompare(right.metadataRecordId));

  return {
    rawMetadataIndex,
    metadataSourceIndex,
    canonicalMetadataIndex,
    metadataNameConflicts,
    metadataKeywordIndex,
    shortcodeSourceIndex,
    metadataCoverageReport,
    metadataProviderAvailability,
    auditReport,
  };
}

export function getMetadataRecordsForCanonical(
  records: RawMetadataIndexRecord[],
  canonicalId: string,
): RawMetadataIndexRecord[] {
  return records.filter((record) => record.canonicalId === canonicalId);
}

export function getMetadataRecordsBySource(
  records: RawMetadataIndexRecord[],
  source: string,
  sourceId: string,
): RawMetadataIndexRecord | undefined {
  return records.find((record) => record.source === source && record.sourceId === sourceId);
}

export function getFireMetadataRecords(records: RawMetadataIndexRecord[]): RawMetadataIndexRecord[] {
  return getMetadataRecordsForCanonical(records, "unicode:1F525");
}
