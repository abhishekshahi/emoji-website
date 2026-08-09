import { getMasterReader } from "./master-reader";
import type { CanonicalMetadataProviderRefs } from "@/lib/master/metadata/types";
import type { MasterMetadataLookup, MasterMetadataSourceEntry, ProvenanceValue } from "./types";

const METADATA_SOURCE_KEYS = [
  "unicode",
  "cldr",
  "openmoji",
  "emojibase",
  "emojilib",
  "emojinet",
  "fluent",
] as const satisfies ReadonlyArray<keyof CanonicalMetadataProviderRefs>;

function provenance<T>(value: T, source: string, canonicalId: string): ProvenanceValue<T> {
  return Object.freeze({ value, source, canonicalId });
}

function toSourceMetadataEntry(
  sourceLabel: string,
  record: {
    source: string;
    sourceId: string;
    metadataRecordId: string;
    fields: {
      name: string | null;
      keywords: string[];
      aliases: string[];
      shortcodes: string[];
    };
    rawRecordRef: string;
  },
): MasterMetadataSourceEntry {
  return Object.freeze({
    source: sourceLabel,
    sourceId: record.sourceId,
    metadataRecordId: record.metadataRecordId,
    name: record.fields.name,
    keywords: Object.freeze([...record.fields.keywords]),
    aliases: Object.freeze([...record.fields.aliases]),
    shortcodes: Object.freeze([...record.fields.shortcodes]),
    rawRecordRef: record.rawRecordRef,
  });
}

export function getMetadata(canonicalId: string, rootDir?: string): MasterMetadataLookup | null {
  const reader = getMasterReader(rootDir);
  const identity = reader.canonicalRecords.get(canonicalId);
  if (!identity) {
    return null;
  }

  const nameRecord = reader.nameRecords.get(canonicalId);
  const metadataIndex = reader.canonicalMetadataIndex.get(canonicalId);

  const sourceNames: ProvenanceValue<string>[] = (nameRecord?.sourceNames ?? []).map((entry) =>
    provenance(entry.value, entry.source, canonicalId),
  );

  const aliases: ProvenanceValue<string>[] = (nameRecord?.aliases ?? []).map((alias) =>
    provenance(alias.value, alias.source, canonicalId),
  );

  const keywords: ProvenanceValue<string>[] = [];
  const shortcodes: ProvenanceValue<string>[] = [];
  const searchEntry = reader.searchIndex.get(canonicalId);

  if (searchEntry) {
    for (const keyword of searchEntry.keywords) {
      keywords.push(provenance(keyword, "canonical-keywords", canonicalId));
    }
    for (const shortcode of searchEntry.shortcodes) {
      shortcodes.push(provenance(shortcode, "canonical-shortcodes", canonicalId));
    }
  }

  const sourceMetadata: MasterMetadataSourceEntry[] = [];
  if (metadataIndex) {
    for (const sourceKey of METADATA_SOURCE_KEYS) {
      for (const metadataRecordId of metadataIndex.sources[sourceKey]) {
        const record = reader.metadataById.get(metadataRecordId);
        if (!record || record.recordType === "semantic") {
          continue;
        }
        sourceMetadata.push(toSourceMetadataEntry(sourceKey, record));
      }
    }
  }

  return Object.freeze({
    canonicalId,
    canonicalName: nameRecord
      ? provenance(nameRecord.canonicalName, nameRecord.nameSource, canonicalId)
      : provenance(canonicalId, "derived", canonicalId),
    sourceNames: Object.freeze(sourceNames),
    aliases: Object.freeze(aliases),
    keywords: Object.freeze(keywords),
    shortcodes: Object.freeze(shortcodes),
    semanticRefs: Object.freeze([...identity.semanticRefs]),
    sourceMetadata: Object.freeze(sourceMetadata),
  });
}
