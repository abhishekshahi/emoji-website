import { isVariationSelectorPair } from "./variation-selector";

export type ConflictCategory =
  | "resolvable"
  | "presentation-variation"
  | "source-field"
  | "genuine-identity"
  | "unresolved";

export interface CategorizedConflict {
  category: ConflictCategory;
  type: string;
  source: string;
  sourceId: string;
  details: string;
  candidates: string[];
  resolution: string;
}

export interface ConflictReport {
  generatedAt: string;
  phase: "8.3a";
  originalConflictCount: number;
  totals: {
    all: number;
    resolvable: number;
    presentationVariation: number;
    sourceField: number;
    genuineIdentity: number;
    unresolved: number;
  };
  resolvable: CategorizedConflict[];
  presentationVariation: CategorizedConflict[];
  sourceField: CategorizedConflict[];
  genuineIdentity: CategorizedConflict[];
  unresolved: CategorizedConflict[];
}

function parseCandidateSequences(details: string): string[] {
  const match =
    details.match(/Conflicting Unicode candidates: (.+) from /) ??
    details.match(/Presentation-only Unicode candidates: (.+) from /);
  if (!match) {
    return [];
  }

  return [...new Set(match[1].split(", ").map((sequence) => sequence.trim()))];
}

function isFluentAsciiConflict(source: string, details: string): boolean {
  if (source !== "fluent") {
    return false;
  }

  const sequences = parseCandidateSequences(details);
  return sequences.some((sequence) => /^[0-9A-F]{1,6}(?:-[0-9A-F]{4}){2,}$/i.test(sequence));
}

function isPresentationVariationConflict(details: string): boolean {
  const sequences = parseCandidateSequences(details);
  if (sequences.length < 2) {
    return false;
  }

  return sequences.every((left) =>
    sequences.every((right) => isVariationSelectorPair(left, right)),
  );
}

export function categorizeConflict(conflict: {
  type: string;
  source: string;
  sourceId: string;
  details: string;
  candidates: string[];
  category?: string;
  resolution?: string;
}): CategorizedConflict {
  const candidates =
    conflict.candidates.length > 0 ? conflict.candidates : parseCandidateSequences(conflict.details);

  if (conflict.category === "presentation-variation" || conflict.type.includes("presentation-variation")) {
    return {
      type: conflict.type,
      source: conflict.source,
      sourceId: conflict.sourceId,
      details: conflict.details,
      candidates,
      category: "presentation-variation",
      resolution:
        conflict.resolution ??
        "Presentation-only FE0F/FE0E difference. Do not merge; keep the record's authoritative rawCodepoints identity.",
    };
  }

  if (conflict.category === "source-field") {
    return {
      type: conflict.type,
      source: conflict.source,
      sourceId: conflict.sourceId,
      details: conflict.details,
      candidates,
      category: "source-field",
      resolution: conflict.resolution ?? "Conflicting values across fields within the same source record.",
    };
  }

  if (isFluentAsciiConflict(conflict.source, conflict.details)) {
    return {
      ...conflict,
      candidates,
      category: "resolvable",
      resolution:
        "Fluent rawCodepoints/rawEmoji are ingestion artifacts; fluent.metadata.unicode and fluent.metadata.glyph are authoritative.",
    };
  }

  if (isPresentationVariationConflict(conflict.details) || conflict.details.includes("Presentation-only Unicode candidates")) {
    return {
      ...conflict,
      candidates,
      category: "presentation-variation",
      resolution:
        "Presentation-only FE0F/FE0E difference. Do not merge; keep the record's authoritative rawCodepoints identity.",
    };
  }

  if (conflict.type.includes("metadata") || conflict.type.includes("source-field")) {
    return {
      ...conflict,
      candidates,
      category: "source-field",
      resolution: "Conflicting values across fields within the same source record.",
    };
  }

  if (candidates.length >= 2) {
    return {
      ...conflict,
      candidates,
      category: "genuine-identity",
      resolution: "Distinct Unicode sequences; manual review required before canonicalization.",
    };
  }

  return {
    ...conflict,
    candidates,
    category: "unresolved",
    resolution: "Unable to classify automatically.",
  };
}

export function buildConflictReport(
  conflicts: Array<{
    type: string;
    source: string;
    sourceId: string;
    details: string;
    candidates: string[];
  }>,
  originalConflictCount = 5531,
): ConflictReport {
  const categorized = conflicts.map(categorizeConflict);

  const buckets: Record<ConflictCategory, CategorizedConflict[]> = {
    resolvable: [],
    "presentation-variation": [],
    "source-field": [],
    "genuine-identity": [],
    unresolved: [],
  };

  for (const conflict of categorized) {
    buckets[conflict.category].push(conflict);
  }

  return {
    generatedAt: new Date().toISOString(),
    phase: "8.3a",
    originalConflictCount,
    totals: {
      all: categorized.length,
      resolvable: buckets.resolvable.length,
      presentationVariation: buckets["presentation-variation"].length,
      sourceField: buckets["source-field"].length,
      genuineIdentity: buckets["genuine-identity"].length,
      unresolved: buckets.unresolved.length,
    },
    resolvable: buckets.resolvable,
    presentationVariation: buckets["presentation-variation"],
    sourceField: buckets["source-field"],
    genuineIdentity: buckets["genuine-identity"],
    unresolved: buckets.unresolved,
  };
}
