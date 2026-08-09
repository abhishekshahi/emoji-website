import { isPrivateUseSequence, toSourceCanonicalIdentity } from "./normalize";

export type UnmatchedClassification =
  | "legitimate-unicode-emoji"
  | "legitimate-source-specific-emoji"
  | "private-use"
  | "artwork-variant-asset"
  | "utility-support-file"
  | "metadata-only"
  | "invalid-non-emoji"
  | "unresolved";

export interface UnmatchedRecordClassification {
  source: string;
  sourceId: string;
  recordType: string;
  stagedPath: string | null;
  classification: UnmatchedClassification;
  canonicalIdentity: string;
  reason: string;
}

export interface UnmatchedRecordInput {
  source: string;
  sourceId: string;
  recordType: string;
  rawSequence: string;
  rawCodepoints: string[];
  rawArtworkReference: string | null;
  stagedPath?: string | null;
}

function isHexSequence(value: string): boolean {
  return /^[0-9A-F]{1,6}(?:-[0-9A-F]{1,6})*$/i.test(value);
}

export function classifyUnmatchedRecord(input: UnmatchedRecordInput): UnmatchedRecordClassification {
  const path = input.stagedPath ?? input.rawArtworkReference;
  const bareId = input.sourceId.split(":").slice(1).join(":");

  if (input.source === "noto" && (bareId === "noto.png:noto.png" || input.rawSequence === "noto.png")) {
    return {
      source: input.source,
      sourceId: input.sourceId,
      recordType: input.recordType,
      stagedPath: path,
      classification: "utility-support-file",
      canonicalIdentity: toSourceCanonicalIdentity(input.source, input.sourceId),
      reason: "Noto project logo/support asset, not a Unicode emoji identity.",
    };
  }

  if (
    input.source === "noto" &&
    (path?.includes("region-flags/") || /^[A-Z]{2}(-[A-Z]{3})?\.png/i.test(input.rawSequence))
  ) {
    return {
      source: input.source,
      sourceId: input.sourceId,
      recordType: input.recordType,
      stagedPath: path,
      classification: "artwork-variant-asset",
      canonicalIdentity: toSourceCanonicalIdentity(input.source, input.sourceId),
      reason:
        "Bundled ISO/subnational region-flag artwork asset without a Unicode emoji sequence in the Noto snapshot.",
    };
  }

  if (isPrivateUseSequence(input.rawSequence) || input.rawCodepoints.some((cp) => isPrivateUseSequence(cp))) {
    return {
      source: input.source,
      sourceId: input.sourceId,
      recordType: input.recordType,
      stagedPath: path,
      classification: "private-use",
      canonicalIdentity: toSourceCanonicalIdentity(input.source, input.sourceId),
      reason: "Private-use area codepoint sequence; retained as source-specific identity.",
    };
  }

  if (!isHexSequence(input.rawSequence) && input.recordType === "artwork-only") {
    return {
      source: input.source,
      sourceId: input.sourceId,
      recordType: input.recordType,
      stagedPath: path,
      classification: "artwork-variant-asset",
      canonicalIdentity: toSourceCanonicalIdentity(input.source, input.sourceId),
      reason: "Artwork asset without a Unicode sequence identifier in the staged snapshot.",
    };
  }

  if (input.recordType === "metadata") {
    return {
      source: input.source,
      sourceId: input.sourceId,
      recordType: input.recordType,
      stagedPath: path,
      classification: "metadata-only",
      canonicalIdentity: toSourceCanonicalIdentity(input.source, input.sourceId),
      reason: "Metadata record without a resolvable Unicode emoji sequence.",
    };
  }

  if (isHexSequence(input.rawSequence)) {
    return {
      source: input.source,
      sourceId: input.sourceId,
      recordType: input.recordType,
      stagedPath: path,
      classification: "legitimate-unicode-emoji",
      canonicalIdentity: `unicode:${input.rawSequence.toUpperCase()}`,
      reason: "Unicode sequence present but not previously mapped during identity build.",
    };
  }

  if (/\.(png|svg|jpg|jpeg|webp)$/i.test(input.rawSequence)) {
    return {
      source: input.source,
      sourceId: input.sourceId,
      recordType: input.recordType,
      stagedPath: path,
      classification: "invalid-non-emoji",
      canonicalIdentity: toSourceCanonicalIdentity(input.source, input.sourceId),
      reason: "Filename-based asset without Unicode emoji identity; retained in raw staging only.",
    };
  }

  return {
    source: input.source,
    sourceId: input.sourceId,
    recordType: input.recordType,
    stagedPath: path,
    classification: "unresolved",
    canonicalIdentity: toSourceCanonicalIdentity(input.source, input.sourceId),
    reason: "Could not determine a Unicode emoji identity from available staged fields.",
  };
}

export function buildUnmatchedClassification(
  records: UnmatchedRecordInput[],
): {
  total: number;
  byClassification: Record<UnmatchedClassification, number>;
  records: UnmatchedRecordClassification[];
} {
  const classified = records.map(classifyUnmatchedRecord);
  const byClassification = classified.reduce<Record<UnmatchedClassification, number>>(
    (counts, record) => {
      counts[record.classification] = (counts[record.classification] ?? 0) + 1;
      return counts;
    },
    {
      "legitimate-unicode-emoji": 0,
      "legitimate-source-specific-emoji": 0,
      "private-use": 0,
      "artwork-variant-asset": 0,
      "utility-support-file": 0,
      "metadata-only": 0,
      "invalid-non-emoji": 0,
      unresolved: 0,
    },
  );

  return {
    total: classified.length,
    byClassification,
    records: classified,
  };
}
