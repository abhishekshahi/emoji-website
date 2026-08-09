import { getMasterReader } from "../master-reader";
import { getMetadata } from "../metadata-adapter";
import type { MasterMetadataSourceEntry } from "../types";
import type {
  MetadataAvailabilityKey,
  MetadataSourceKey,
  SourceMetadataRecord,
  UnavailableSourceMetadata,
} from "./types";

const METADATA_SOURCE_MAP: Record<MetadataSourceKey, keyof import("@/lib/master/metadata/types").CanonicalMetadataProviderRefs> = {
  unicode: "unicode",
  cldr: "cldr",
  openmoji: "openmoji",
  emojibase: "emojibase",
  emojilib: "emojilib",
  emojinet: "emojinet",
  fluent: "fluent",
  "emoji-time": "emojiTime",
};

export function getSourceMetadataAvailability(
  canonicalId: string,
  rootDir?: string,
): Readonly<Record<MetadataAvailabilityKey, boolean>> {
  const reader = getMasterReader(rootDir);
  const metadataIndex = reader.canonicalMetadataIndex.get(canonicalId);

  const availability: Record<MetadataAvailabilityKey, boolean> = {
    unicode: false,
    cldr: false,
    openmoji: false,
    emojibase: false,
    emojilib: false,
    emojinet: false,
    fluent: false,
    "emoji-time": false,
    noto: false,
    twemoji: false,
  };

  if (!metadataIndex) {
    return Object.freeze(availability);
  }

  for (const source of Object.keys(METADATA_SOURCE_MAP) as MetadataSourceKey[]) {
    const indexKey = METADATA_SOURCE_MAP[source];
    availability[source] = metadataIndex.sources[indexKey].length > 0;
  }

  return Object.freeze(availability);
}

function toSourceMetadataRecord(
  source: MetadataSourceKey,
  record: {
    sourceId: string;
    metadataRecordId: string;
    sourceVersion: string;
    fields: {
      name: string | null;
      keywords: string[];
      aliases: string[];
      shortcodes: string[];
      definition: string | null;
    };
    rawRecordRef: string;
  },
): SourceMetadataRecord {
  return Object.freeze({
    source,
    sourceId: record.sourceId,
    metadataRecordId: record.metadataRecordId,
    sourceVersion: record.sourceVersion,
    name: record.fields.name,
    keywords: Object.freeze([...record.fields.keywords]),
    aliases: Object.freeze([...record.fields.aliases]),
    shortcodes: Object.freeze([...record.fields.shortcodes]),
    definition: record.fields.definition,
    rawRecordRef: record.rawRecordRef,
    metadataAvailable: true,
  });
}

export function getSourceMetadata(
  canonicalId: string,
  source: MetadataSourceKey | "noto" | "twemoji",
  rootDir?: string,
): SourceMetadataRecord | UnavailableSourceMetadata | null {
  if (source === "noto" || source === "twemoji") {
    return Object.freeze({ source, metadataAvailable: false });
  }

  const reader = getMasterReader(rootDir);
  const metadataIndex = reader.canonicalMetadataIndex.get(canonicalId);
  if (!metadataIndex) {
    return null;
  }

  const indexKey = METADATA_SOURCE_MAP[source];
  const recordIds = metadataIndex.sources[indexKey];
  if (recordIds.length === 0) {
    return null;
  }

  const metadataRecordId = recordIds.find((id) => {
    const record = reader.metadataById.get(id);
    return record && record.recordType !== "semantic";
  }) ?? recordIds[0];

  const record = reader.metadataById.get(metadataRecordId);
  if (!record || record.recordType === "semantic") {
    return null;
  }

  return toSourceMetadataRecord(source, record);
}

export function listSourceMetadata(
  canonicalId: string,
  rootDir?: string,
): readonly (SourceMetadataRecord | MasterMetadataSourceEntry)[] {
  const metadata = getMetadata(canonicalId, rootDir);
  if (!metadata) {
    return Object.freeze([]);
  }
  return metadata.sourceMetadata;
}
