import { emojiToSequence, isActualEmojiCharacter, normalizeHexSequence, sequenceFromCodepoints, toUnicodeCanonicalIdentity } from "./normalize";

export type VariationSelectorRelation =
  | "same"
  | "emoji-presentation-qualified"
  | "text-presentation-qualified"
  | "text-default-vs-emoji-qualified"
  | "genuinely-different";

export interface VariationSelectorCase {
  rawSequence: string;
  normalizedSequence: string;
  source: string;
  sourceId: string;
  candidateSequences: string[];
  unicodeStatus: string;
  emojiPresentationStatus: string;
  recommendedCanonicalIdentity: string;
  reason: string;
  relation: VariationSelectorRelation;
}

const FE0F = "FE0F";
const FE0E = "FE0E";

export function stripVariationSelector(sequence: string, selector: typeof FE0F | typeof FE0E): string | null {
  if (sequence.endsWith(`-${selector}`)) {
    return sequence.slice(0, -(selector.length + 1));
  }
  return null;
}

export function isVariationSelectorPair(left: string, right: string): boolean {
  if (left === right) {
    return true;
  }

  if (left + `-${FE0F}` === right || right + `-${FE0F}` === left) {
    return true;
  }

  if (left + `-${FE0E}` === right || right + `-${FE0E}` === left) {
    return true;
  }

  const leftWithoutFe0f = stripVariationSelector(left, FE0F);
  const rightWithoutFe0f = stripVariationSelector(right, FE0F);
  if (leftWithoutFe0f && (leftWithoutFe0f === right || leftWithoutFe0f === rightWithoutFe0f)) {
    return true;
  }

  const leftWithoutFe0e = stripVariationSelector(left, FE0E);
  const rightWithoutFe0e = stripVariationSelector(right, FE0E);
  if (leftWithoutFe0e && (leftWithoutFe0e === right || leftWithoutFe0e === rightWithoutFe0e)) {
    return true;
  }

  return false;
}

export function classifyVariationSelectorRelation(sequences: string[]): VariationSelectorRelation {
  const unique = [...new Set(sequences)];
  if (unique.length <= 1) {
    return "same";
  }

  if (!unique.every((left, _index, arr) => arr.every((right) => isVariationSelectorPair(left, right)))) {
    return "genuinely-different";
  }

  const hasFe0f = unique.some((sequence) => sequence.includes(FE0F));
  const hasFe0e = unique.some((sequence) => sequence.includes(FE0E));
  const hasUnqualified = unique.some(
    (sequence) => !sequence.includes(FE0F) && !sequence.includes(FE0E),
  );

  if (hasUnqualified && hasFe0f) {
    return "text-default-vs-emoji-qualified";
  }
  if (hasFe0f && !hasUnqualified) {
    return "emoji-presentation-qualified";
  }
  if (hasFe0e && !hasUnqualified) {
    return "text-presentation-qualified";
  }

  return "text-default-vs-emoji-qualified";
}

export function describeUnicodeStatus(relation: VariationSelectorRelation): string {
  switch (relation) {
    case "same":
      return "single-unambiguous-sequence";
    case "text-default-vs-emoji-qualified":
      return "text-default-or-unqualified-vs-explicit-emoji-presentation";
    case "emoji-presentation-qualified":
      return "explicit-emoji-presentation-only";
    case "text-presentation-qualified":
      return "explicit-text-presentation-only";
    case "genuinely-different":
      return "distinct-unicode-sequences";
  }
}

export function describeEmojiPresentationStatus(
  relation: VariationSelectorRelation,
  recommendedSequence: string,
): string {
  if (relation === "genuinely-different") {
    return "not-a-presentation-only-difference";
  }

  if (recommendedSequence.includes(FE0F)) {
    return "explicitly-emoji-qualified-sequence";
  }

  if (recommendedSequence.includes(FE0E)) {
    return "explicitly-text-qualified-sequence";
  }

  return "unqualified-base-character-sequence";
}

export function recommendSequenceFromCandidates(
  candidates: Array<{ sequence: string; method: string }>,
): string {
  const priority = [
    "rawCodepoints",
    "rawSequence",
    "fluent.metadata.unicode",
    "fluent.metadata.glyph",
    "fluent.artwork.metadata-index",
    "rawMetadata.unicode",
    "rawMetadata",
    "rawEmoji",
  ];

  for (const method of priority) {
    const match = candidates.find((candidate) => candidate.method === method);
    if (match) {
      return match.sequence;
    }
  }

  return candidates[0]?.sequence ?? "";
}

export interface VariationSelectorInput {
  source: string;
  sourceId: string;
  rawSequence: string;
  rawCodepoints: string[];
  rawEmoji: string | null;
  rawMetadata?: Record<string, unknown>;
}

function readMetadataHexcode(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) {
    return null;
  }

  for (const field of [metadata.hexcode, metadata.unicode]) {
    if (typeof field === "string") {
      const normalized = normalizeHexSequence(field);
      if (normalized) {
        return normalized;
      }
    }
  }

  return null;
}

export function collectVariationCandidates(input: VariationSelectorInput): Array<{
  sequence: string;
  method: string;
}> {
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

  const fromMetadata = readMetadataHexcode(input.rawMetadata);
  if (fromMetadata) {
    candidates.push({ sequence: fromMetadata, method: "rawMetadata" });
  }

  return candidates;
}

export function detectVariationSelectorCase(
  input: VariationSelectorInput,
): VariationSelectorCase | null {
  const candidates = collectVariationCandidates(input);
  const uniqueSequences = [...new Set(candidates.map((candidate) => candidate.sequence))];
  if (uniqueSequences.length <= 1) {
    return null;
  }

  const relation = classifyVariationSelectorRelation(uniqueSequences);
  if (relation === "genuinely-different") {
    return null;
  }

  const recommendedSequence = recommendSequenceFromCandidates(candidates);
  const normalizedSequence = normalizeHexSequence(recommendedSequence) ?? recommendedSequence;

  return {
    rawSequence: input.rawSequence,
    normalizedSequence,
    source: input.source,
    sourceId: input.sourceId,
    candidateSequences: uniqueSequences,
    unicodeStatus: describeUnicodeStatus(relation),
    emojiPresentationStatus: describeEmojiPresentationStatus(relation, normalizedSequence),
    recommendedCanonicalIdentity: toUnicodeCanonicalIdentity(normalizedSequence),
    reason:
      "Candidates differ only by variation-selector presentation (FE0F/FE0E). " +
      "Sequences are not merged; rawCodepoints is authoritative for this record.",
    relation,
  };
}

export function buildVariationSelectorAudit(
  records: VariationSelectorInput[],
): { totalCases: number; cases: VariationSelectorCase[] } {
  const cases: VariationSelectorCase[] = [];

  for (const record of records) {
    const detected = detectVariationSelectorCase(record);
    if (detected) {
      cases.push(detected);
    }
  }

  cases.sort((left, right) => {
    const sourceCompare = left.source.localeCompare(right.source);
    if (sourceCompare !== 0) {
      return sourceCompare;
    }
    return left.sourceId.localeCompare(right.sourceId);
  });

  return {
    totalCases: cases.length,
    cases,
  };
}
