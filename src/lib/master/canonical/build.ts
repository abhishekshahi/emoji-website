import type {
  ArtworkProvider,
  CanonicalArtworkLinks,
  CanonicalArtworkRef,
  CanonicalEmojiRecord,
  CanonicalIdentityType,
  CanonicalMetadataRef,
  CanonicalSemanticRef,
  CanonicalSourceRecordRef,
  CrossSourceCoverageEntry,
  SourceOnlyRecordEntry,
} from "./types";
import { hexcodeToEmoji, isPrivateUseSequence } from "../identity/normalize";

const ARTWORK_PROVIDERS: ArtworkProvider[] = ["openmoji", "noto", "twemoji", "fluent"];

const COVERAGE_SOURCE_MAP: Record<string, keyof Omit<CrossSourceCoverageEntry, "canonicalId" | "unicodeSequence" | "sourceCount">> = {
  openmoji: "openmoji",
  noto: "noto",
  twemoji: "twemoji",
  fluent: "fluent",
  unicode: "unicode",
  "unicode-emoji-data": "unicode",
  emojibase: "emojibase",
  emojilib: "emojilib",
  emojinet: "emojinet",
  "emoji-time": "emojiTime",
};

export interface RawToCanonicalMapping {
  source: string;
  sourceId: string;
  canonicalIdentity: string;
  identityCategory: string;
  normalizedSequence: string | null;
  recordKind: "source" | "artwork" | "metadata";
}

export interface ArtworkIdentityMapping {
  provider: string;
  sourceId: string;
  canonicalIdentity: string;
  path: string;
}

export interface MetadataIdentityMapping {
  source: string;
  sourceId: string;
  canonicalIdentity: string;
}

export interface CanonicalSourceRef {
  source: string;
  sourceId: string;
  recordKind: "source" | "artwork" | "metadata";
  identityCategory: string;
}

export interface BuildCanonicalInput {
  canonicalToSource: Record<string, CanonicalSourceRef[]>;
  rawToCanonical: RawToCanonicalMapping[];
  artworkIndex: ArtworkIdentityMapping[];
  metadataIndex: MetadataIdentityMapping[];
  emojiBySourceKey: Map<string, string | null>;
  semanticSourceIds: Set<string>;
}

function emptyArtworkLinks(): CanonicalArtworkLinks {
  return {
    openmoji: [],
    noto: [],
    twemoji: [],
    fluent: [],
  };
}

function rawRecordRef(kind: "source" | "artwork" | "metadata", source: string, sourceId: string): string {
  const file =
    kind === "artwork"
      ? "master/raw/raw-artwork-records.json"
      : kind === "metadata"
        ? "master/raw/raw-metadata-records.json"
        : "master/raw/raw-source-records.json";
  return `${file}#${source}:${sourceId}`;
}

function identityTypeFor(canonicalId: string, identityCategory: string | null): CanonicalIdentityType {
  if (!canonicalId.startsWith("unicode:")) {
    if (identityCategory === "private-use") {
      return "private-use";
    }
    return "source-specific";
  }

  const sequence = canonicalId.slice("unicode:".length);
  if (isPrivateUseSequence(sequence)) {
    return "private-use";
  }

  return "unicode";
}

function pickEmoji(
  canonicalId: string,
  sourceRecords: CanonicalSourceRecordRef[],
  emojiBySourceKey: Map<string, string | null>,
): string | null {
  for (const record of sourceRecords) {
    const emoji = emojiBySourceKey.get(`${record.source}:${record.sourceId}`);
    if (emoji) {
      return emoji;
    }
  }

  if (canonicalId.startsWith("unicode:")) {
    return hexcodeToEmoji(canonicalId.slice("unicode:".length));
  }

  return null;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

export function buildCanonicalEmojiRecords(input: BuildCanonicalInput): CanonicalEmojiRecord[] {
  const artworkByCanonical = new Map<string, CanonicalArtworkLinks>();
  for (const artwork of input.artworkIndex) {
    if (!artworkByCanonical.has(artwork.canonicalIdentity)) {
      artworkByCanonical.set(artwork.canonicalIdentity, emptyArtworkLinks());
    }
    const bucket = artworkByCanonical.get(artwork.canonicalIdentity)!;
    const provider = artwork.provider as ArtworkProvider;
    if (!ARTWORK_PROVIDERS.includes(provider)) {
      continue;
    }

    const ref: CanonicalArtworkRef = {
      provider,
      sourceId: artwork.sourceId,
      path: artwork.path,
      rawRecordRef: rawRecordRef("artwork", artwork.provider, artwork.sourceId),
    };
    bucket[provider].push(ref);
  }

  const metadataByCanonical = new Map<string, CanonicalMetadataRef[]>();
  for (const metadata of input.metadataIndex) {
    if (!metadataByCanonical.has(metadata.canonicalIdentity)) {
      metadataByCanonical.set(metadata.canonicalIdentity, []);
    }
    metadataByCanonical.get(metadata.canonicalIdentity)!.push({
      source: metadata.source,
      sourceId: metadata.sourceId,
      rawRecordRef: rawRecordRef("metadata", metadata.source, metadata.sourceId),
    });
  }

  const semanticByCanonical = new Map<string, CanonicalSemanticRef[]>();
  for (const mapping of input.rawToCanonical) {
    if (mapping.recordKind !== "source" || !input.semanticSourceIds.has(mapping.sourceId)) {
      continue;
    }

    if (!semanticByCanonical.has(mapping.canonicalIdentity)) {
      semanticByCanonical.set(mapping.canonicalIdentity, []);
    }

    semanticByCanonical.get(mapping.canonicalIdentity)!.push({
      source: mapping.source,
      sourceId: mapping.sourceId,
      rawRecordRef: rawRecordRef("source", mapping.source, mapping.sourceId),
    });
  }

  const identityCategoryByCanonical = new Map<string, string>();
  for (const mapping of input.rawToCanonical) {
    if (mapping.recordKind !== "source") {
      continue;
    }
    if (!identityCategoryByCanonical.has(mapping.canonicalIdentity)) {
      identityCategoryByCanonical.set(mapping.canonicalIdentity, mapping.identityCategory);
    }
  }

  const records: CanonicalEmojiRecord[] = [];

  for (const canonicalId of Object.keys(input.canonicalToSource).sort()) {
    const refs = input.canonicalToSource[canonicalId] ?? [];
    const sourceRecords: CanonicalSourceRecordRef[] = refs
      .filter((ref) => ref.recordKind === "source")
      .map((ref) => ({
        source: ref.source,
        sourceId: ref.sourceId,
        rawRecordRef: rawRecordRef("source", ref.source, ref.sourceId),
      }))
      .sort((left, right) => {
        const sourceCompare = left.source.localeCompare(right.source);
        if (sourceCompare !== 0) {
          return sourceCompare;
        }
        return left.sourceId.localeCompare(right.sourceId);
      });

    const metadataRefs = (metadataByCanonical.get(canonicalId) ?? []).sort((left, right) => {
      const sourceCompare = left.source.localeCompare(right.source);
      if (sourceCompare !== 0) {
        return sourceCompare;
      }
      return left.sourceId.localeCompare(right.sourceId);
    });

    const semanticRefs = (semanticByCanonical.get(canonicalId) ?? []).sort((left, right) => {
      const sourceCompare = left.source.localeCompare(right.source);
      if (sourceCompare !== 0) {
        return sourceCompare;
      }
      return left.sourceId.localeCompare(right.sourceId);
    });

    const artwork = artworkByCanonical.get(canonicalId) ?? emptyArtworkLinks();
    const isUnicode = canonicalId.startsWith("unicode:");
    const unicodeSequence = isUnicode ? canonicalId.slice("unicode:".length) : null;
    const identityCategory = identityCategoryByCanonical.get(canonicalId) ?? null;

    records.push({
      canonicalId,
      emoji: pickEmoji(canonicalId, sourceRecords, input.emojiBySourceKey),
      unicodeSequence,
      isUnicode,
      identityType: identityTypeFor(canonicalId, identityCategory),
      sourceRecords,
      sourceCount: sourceRecords.length,
      artwork,
      metadataSources: uniqueSorted(metadataRefs.map((ref) => ref.source)),
      metadataRefs,
      semanticSources: uniqueSorted(semanticRefs.map((ref) => ref.source)),
      semanticRefs,
    });
  }

  return records;
}

export function buildCrossSourceCoverage(records: CanonicalEmojiRecord[]): CrossSourceCoverageEntry[] {
  return records
    .filter((record) => record.isUnicode)
    .map((record) => {
      const coverage: CrossSourceCoverageEntry = {
        canonicalId: record.canonicalId,
        unicodeSequence: record.unicodeSequence,
        openmoji: false,
        noto: false,
        twemoji: false,
        fluent: false,
        unicode: false,
        emojibase: false,
        emojilib: false,
        emojinet: false,
        emojiTime: false,
        sourceCount: 0,
      };

      const contributingSources = new Set<string>();
      for (const ref of [
        ...record.sourceRecords,
        ...record.metadataRefs.map((metadata) => ({ source: metadata.source })),
        ...record.semanticRefs.map((semantic) => ({ source: semantic.source })),
      ]) {
        contributingSources.add(ref.source);
      }

      for (const artworkProvider of ARTWORK_PROVIDERS) {
        if (record.artwork[artworkProvider].length > 0) {
          contributingSources.add(artworkProvider);
        }
      }

      for (const source of contributingSources) {
        const key = COVERAGE_SOURCE_MAP[source];
        if (key) {
          coverage[key] = true;
        }
      }

      coverage.sourceCount = contributingSources.size;
      return coverage;
    })
    .sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));
}

function soleSourceForRecord(record: CanonicalEmojiRecord): string | null {
  const sources = new Set<string>();

  for (const ref of record.sourceRecords) {
    sources.add(ref.source);
  }
  for (const ref of record.metadataRefs) {
    sources.add(ref.source);
  }
  for (const ref of record.semanticRefs) {
    sources.add(ref.source);
  }
  for (const provider of ARTWORK_PROVIDERS) {
    if (record.artwork[provider].length > 0) {
      sources.add(provider);
    }
  }

  if (sources.size !== 1) {
    return null;
  }

  return [...sources][0];
}

export function buildSourceOnlyRecords(records: CanonicalEmojiRecord[]): SourceOnlyRecordEntry[] {
  return records
    .map((record) => {
      const soleSource = soleSourceForRecord(record);
      if (!soleSource) {
        return null;
      }

      const hasArtwork = ARTWORK_PROVIDERS.some((provider) => record.artwork[provider].length > 0);

      return {
        canonicalId: record.canonicalId,
        soleSource,
        identityType: record.identityType,
        sourceRecordCount: record.sourceCount,
        hasArtwork,
        hasMetadata: record.metadataRefs.length > 0,
        hasSemantic: record.semanticRefs.length > 0,
      };
    })
    .filter((entry): entry is SourceOnlyRecordEntry => entry !== null)
    .sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));
}

export function productionCanonicalIdForStandard(hexcode: string): string {
  return `unicode:${hexcode.toUpperCase()}`;
}

export function productionCanonicalIdForExtra(hexcode: string): string {
  const normalized = hexcode.toUpperCase();
  if (isPrivateUseSequence(normalized)) {
    return `source:openmoji:${normalized}`;
  }
  return `unicode:${normalized}`;
}

export function canonicalIdSet(records: CanonicalEmojiRecord[]): Set<string> {
  return new Set(records.map((record) => record.canonicalId));
}
