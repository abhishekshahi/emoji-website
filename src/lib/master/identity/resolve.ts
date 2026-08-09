import type { IdentityCategory } from "./types";
import {
  emojiToSequence,
  extractBareSourceId,
  extractFluentAssetFolder,
  extractHexFromArtworkSourceId,
  extractHexFromNotoFilename,
  extractHexFromOpenmojiPath,
  extractHexFromTwemojiFilename,
  isActualEmojiCharacter,
  isPrivateUseSequence,
  normalizeHexSequence,
  resolvePrivateUseIdentity,
  resolveSourceSpecificIdentity,
  resolveUnicodeIdentity,
  resolveUnmatchedIdentity,
  sequenceFromCodepoints,
  type IdentityResolution,
} from "./normalize";
import {
  classifyVariationSelectorRelation,
  collectVariationCandidates,
  isVariationSelectorPair,
} from "./variation-selector";
import { classifyUnmatchedRecord } from "./unmatched";

export interface RawRecordIdentityInput {
  source: string;
  sourceId: string;
  rawEmoji: string | null;
  rawCodepoints: string[];
  rawSequence: string;
  rawMetadata?: Record<string, unknown>;
  rawArtworkReference?: string | null;
  recordType?: string;
}

export interface ArtworkIdentityInput {
  source: string;
  sourceId: string;
  sourceVersion: string;
  stagedPath: string;
  originalPath: string;
  rawLicense: string;
  checksum: string | null;
}

export interface IdentityConflictDetail {
  type: string;
  details: string;
  candidates: string[];
  category: "presentation-variation" | "source-field" | "genuine-identity" | "unresolved";
}

function readFluentMetadataUnicode(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) {
    return null;
  }

  if (typeof metadata.unicode === "string" && metadata.unicode.trim()) {
    const normalized = normalizeHexSequence(metadata.unicode);
    if (normalized) {
      return normalized;
    }
  }

  if (typeof metadata.glyph === "string" && isActualEmojiCharacter(metadata.glyph)) {
    return emojiToSequence(metadata.glyph);
  }

  return null;
}

function readMetadataUnicode(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) {
    return null;
  }

  const candidates = [metadata.unicode, metadata.hexcode];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      const normalized = normalizeHexSequence(candidate);
      if (normalized) {
        return normalized;
      }
    }
  }

  if (typeof metadata.glyph === "string" && isActualEmojiCharacter(metadata.glyph)) {
    return emojiToSequence(metadata.glyph);
  }

  return null;
}

function readMetadataEmojiUnicode(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) {
    return null;
  }

  if (typeof metadata.emoji === "string" && isActualEmojiCharacter(metadata.emoji)) {
    return emojiToSequence(metadata.emoji);
  }

  return readMetadataUnicode(metadata);
}

function collectFluentCandidates(
  input: RawRecordIdentityInput,
  fluentMetadataIndex?: Map<string, string>,
): Array<{ sequence: string; method: string }> {
  const candidates: Array<{ sequence: string; method: string }> = [];

  const fromMetadataUnicode = readFluentMetadataUnicode(input.rawMetadata);
  if (fromMetadataUnicode) {
    candidates.push({ sequence: fromMetadataUnicode, method: "fluent.metadata.unicode" });
  }

  if (input.rawArtworkReference) {
    const folder = extractFluentAssetFolder(input.rawArtworkReference);
    if (folder) {
      const unicode = fluentMetadataIndex?.get(folder);
      if (unicode) {
        candidates.push({ sequence: unicode, method: "fluent.artwork.metadata-index" });
      }
    }
  }

  return candidates;
}

function collectSequenceCandidates(
  input: RawRecordIdentityInput,
  fluentMetadataIndex?: Map<string, string>,
): Array<{
  sequence: string;
  method: string;
}> {
  if (input.source === "fluent") {
    return collectFluentCandidates(input, fluentMetadataIndex);
  }

  const candidates: Array<{ sequence: string; method: string }> = [];

  const fromCodepoints = sequenceFromCodepoints(input.rawCodepoints);
  if (fromCodepoints) {
    candidates.push({ sequence: fromCodepoints, method: "rawCodepoints" });
  }

  const fromSequence = normalizeHexSequence(input.rawSequence);
  if (fromSequence) {
    candidates.push({ sequence: fromSequence, method: "rawSequence" });
  }

  if (input.rawEmoji && isActualEmojiCharacter(input.rawEmoji)) {
    const fromEmoji = emojiToSequence(input.rawEmoji);
    if (fromEmoji) {
      candidates.push({ sequence: fromEmoji, method: "rawEmoji" });
    }
  }

  const fromMetadataEmoji = readMetadataEmojiUnicode(input.rawMetadata);
  if (fromMetadataEmoji) {
    candidates.push({ sequence: fromMetadataEmoji, method: "rawMetadata" });
  }

  const emojinetUnicode =
    typeof input.rawMetadata?.unicode === "string"
      ? normalizeHexSequence(input.rawMetadata.unicode)
      : null;
  if (emojinetUnicode) {
    candidates.push({ sequence: emojinetUnicode, method: "rawMetadata.unicode" });
  }

  return candidates;
}

function shouldUsePrivateUseIdentity(sequence: string): boolean {
  return isPrivateUseSequence(sequence);
}

function buildConflictDetails(
  input: RawRecordIdentityInput,
  candidates: Array<{ sequence: string; method: string }>,
): IdentityConflictDetail[] {
  const uniqueSequences = [...new Set(candidates.map((candidate) => candidate.sequence))];
  if (uniqueSequences.length <= 1) {
    return [];
  }

  const relation = classifyVariationSelectorRelation(uniqueSequences);
  if (relation !== "genuinely-different") {
    return [
      {
        type: "presentation-variation-conflict",
        details: `Presentation-only Unicode candidates: ${uniqueSequences.join(", ")} from ${candidates.map((candidate) => candidate.method).join(", ")}`,
        candidates: uniqueSequences,
        category: "presentation-variation",
      },
    ];
  }

  return [
    {
      type: "unicode-candidate-conflict",
      details: `Conflicting Unicode candidates: ${uniqueSequences.join(", ")} from ${candidates.map((candidate) => candidate.method).join(", ")}`,
      candidates: uniqueSequences,
      category: "source-field",
    },
  ];
}

function pickPreferredCandidate(
  input: RawRecordIdentityInput,
  candidates: Array<{ sequence: string; method: string }>,
): { sequence: string; method: string } | undefined {
  const priority =
    input.source === "fluent"
      ? ["fluent.metadata.unicode", "fluent.artwork.metadata-index"]
      : [
          "rawCodepoints",
          "rawSequence",
          "rawMetadata.unicode",
          "rawMetadata",
          "rawEmoji",
        ];

  for (const method of priority) {
    const match = candidates.find((candidate) => candidate.method === method);
    if (match) {
      return match;
    }
  }

  return candidates[0];
}

function resolveClassifiedNonUnicodeRecord(
  input: RawRecordIdentityInput,
): IdentityResolution | null {
  const classification = classifyUnmatchedRecord({
    source: input.source,
    sourceId: input.sourceId,
    recordType: input.recordType ?? "artwork-only",
    rawSequence: input.rawSequence,
    rawCodepoints: input.rawCodepoints,
    rawArtworkReference: input.rawArtworkReference ?? null,
    stagedPath: input.rawArtworkReference ?? null,
  });

  if (classification.classification === "utility-support-file") {
    return {
      canonicalIdentity: classification.canonicalIdentity,
      normalizedSequence: null,
      identityCategory: "source-specific",
      mappingMethod: "unmatched.utility-support-file",
    };
  }

  if (classification.classification === "artwork-variant-asset") {
    return {
      canonicalIdentity: classification.canonicalIdentity,
      normalizedSequence: null,
      identityCategory: "artwork-only",
      mappingMethod: "unmatched.artwork-variant-asset",
    };
  }

  if (classification.classification === "invalid-non-emoji") {
    return {
      canonicalIdentity: classification.canonicalIdentity,
      normalizedSequence: null,
      identityCategory: "source-specific",
      mappingMethod: "unmatched.invalid-non-emoji",
    };
  }

  return null;
}

export function resolveRawRecordIdentity(
  input: RawRecordIdentityInput,
  fluentMetadataIndex?: Map<string, string>,
): {
  resolution: IdentityResolution;
  conflicts: IdentityConflictDetail[];
} {
  const candidates = collectSequenceCandidates(input, fluentMetadataIndex);
  const conflicts = buildConflictDetails(input, candidates);

  const preferred = pickPreferredCandidate(input, candidates);

  if (!preferred) {
    const classified = resolveClassifiedNonUnicodeRecord(input);
    if (classified) {
      return { resolution: classified, conflicts };
    }

    if (input.recordType === "semantic") {
      return {
        resolution: {
          ...resolveSourceSpecificIdentity(input.source, input.sourceId, "semantic-record"),
          identityCategory: "semantic-only",
        },
        conflicts,
      };
    }

    return {
      resolution: resolveUnmatchedIdentity(input.source, input.sourceId, "no-unicode-candidate"),
      conflicts,
    };
  }

  if (shouldUsePrivateUseIdentity(preferred.sequence)) {
    return {
      resolution: resolvePrivateUseIdentity(
        input.source,
        input.sourceId,
        preferred.sequence,
        preferred.method,
      ),
      conflicts,
    };
  }

  if (input.recordType === "semantic") {
    return {
      resolution: {
        ...resolveUnicodeIdentity(preferred.sequence, preferred.method),
        identityCategory: "semantic-only",
      },
      conflicts,
    };
  }

  if (input.recordType === "metadata") {
    return {
      resolution: {
        ...resolveUnicodeIdentity(preferred.sequence, preferred.method),
        identityCategory: "metadata-only",
      },
      conflicts,
    };
  }

  if (input.recordType === "artwork-only") {
    return {
      resolution: {
        ...resolveUnicodeIdentity(preferred.sequence, preferred.method),
        identityCategory: "artwork-only",
      },
      conflicts,
    };
  }

  return {
    resolution: resolveUnicodeIdentity(preferred.sequence, preferred.method),
    conflicts,
  };
}

export function buildFluentMetadataIndex(
  metadataRecords: Array<{
    sourceId: string;
    rawName: string | null;
    rawMetadata: Record<string, unknown>;
  }>,
): Map<string, string> {
  const index = new Map<string, string>();

  for (const record of metadataRecords) {
    const unicode = readFluentMetadataUnicode(record.rawMetadata);
    if (!unicode) {
      continue;
    }

    const folderFromId = record.sourceId.replace(/^fluent-metadata:/, "");
    index.set(folderFromId, unicode);

    if (record.rawName) {
      index.set(record.rawName, unicode);
    }
  }

  return index;
}

export function resolveArtworkIdentity(
  input: ArtworkIdentityInput,
  fluentMetadataIndex: Map<string, string>,
): IdentityResolution {
  const fromSourceId = extractHexFromArtworkSourceId(input.sourceId);
  if (fromSourceId && !isPrivateUseSequence(fromSourceId)) {
    return resolveUnicodeIdentity(fromSourceId, "artwork.sourceId");
  }

  if (fromSourceId && isPrivateUseSequence(fromSourceId)) {
    return resolvePrivateUseIdentity(
      input.source,
      input.sourceId,
      fromSourceId,
      "artwork.sourceId.private-use",
    );
  }

  if (input.source === "noto") {
    const fromFilename = extractHexFromNotoFilename(input.originalPath);
    if (fromFilename) {
      return resolveUnicodeIdentity(fromFilename, "artwork.noto.filename");
    }

    return resolveSourceSpecificIdentity(input.source, input.sourceId, "artwork.noto.non-emoji-asset");
  }

  if (input.source === "twemoji") {
    const fromFilename = extractHexFromTwemojiFilename(input.originalPath);
    if (fromFilename && !isPrivateUseSequence(fromFilename)) {
      return resolveUnicodeIdentity(fromFilename, "artwork.twemoji.filename");
    }
    if (fromFilename && isPrivateUseSequence(fromFilename)) {
      return resolvePrivateUseIdentity(
        input.source,
        input.sourceId,
        fromFilename,
        "artwork.twemoji.filename.private-use",
      );
    }
  }

  if (input.source === "openmoji") {
    const fromPath = extractHexFromOpenmojiPath(input.stagedPath);
    if (fromPath && !isPrivateUseSequence(fromPath)) {
      return resolveUnicodeIdentity(fromPath, "artwork.openmoji.path");
    }
    if (fromPath && isPrivateUseSequence(fromPath)) {
      return resolvePrivateUseIdentity(
        input.source,
        input.sourceId,
        fromPath,
        "artwork.openmoji.path.private-use",
      );
    }
  }

  if (input.source === "fluent") {
    const folder = extractFluentAssetFolder(input.stagedPath);
    if (folder) {
      const unicode = fluentMetadataIndex.get(folder);
      if (unicode) {
        return resolveUnicodeIdentity(unicode, "artwork.fluent.metadata-index");
      }
    }
  }

  return resolveSourceSpecificIdentity(input.source, input.sourceId, "artwork.unmapped");
}

export function resolveMetadataIdentity(
  input: RawRecordIdentityInput,
  fluentMetadataIndex?: Map<string, string>,
): {
  resolution: IdentityResolution;
  conflicts: IdentityConflictDetail[];
} {
  const result = resolveRawRecordIdentity(
    {
      ...input,
      recordType: input.recordType ?? "metadata",
    },
    fluentMetadataIndex,
  );

  if (
    result.resolution.identityCategory === "unicode-canonical" ||
    result.resolution.identityCategory === "unicode-sequence"
  ) {
    return {
      resolution: {
        ...result.resolution,
        identityCategory: "metadata-only",
      },
      conflicts: result.conflicts,
    };
  }

  if (result.resolution.identityCategory === "semantic-only") {
    return {
      resolution: {
        ...result.resolution,
        identityCategory: "metadata-only",
      },
      conflicts: result.conflicts,
    };
  }

  return result;
}

export function identityCategoryForArtwork(resolution: IdentityResolution): IdentityCategory {
  if (resolution.identityCategory === "private-use") {
    return "private-use";
  }
  if (
    resolution.identityCategory === "unmatched" ||
    resolution.identityCategory === "source-specific"
  ) {
    return "artwork-only";
  }
  return "artwork-only";
}

export function isUnicodeIdentity(canonicalIdentity: string): boolean {
  return canonicalIdentity.startsWith("unicode:");
}

export function bareSourceKey(source: string, sourceId: string): string {
  return `${source}:${extractBareSourceId(source, sourceId)}`;
}

export function hasOnlyVariationSelectorDifference(sequences: string[]): boolean {
  if (sequences.length < 2) {
    return false;
  }

  return sequences.every((left) => sequences.every((right) => isVariationSelectorPair(left, right)));
}

export { collectVariationCandidates };
