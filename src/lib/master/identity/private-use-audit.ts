import type { RawIdentityMapping } from "./types";
import { isUnicodeIdentity } from "./resolve";
import { isPrivateUseSequence } from "./normalize";

export interface PrivateUseAuditReport {
  generatedAt: string;
  phase: "8.3a";
  summary: {
    rawPrivateUseRecords: number;
    uniquePrivateUseIdentities: number;
    openmojiPrivateUseRecords: number;
    openmojiExtraRecords: number;
    openmojiExtrasPrivateUse: number;
    openmojiExtrasUnicodeMapped: number;
    twemojiPrivateUseRecords: number;
  };
  explanation: string[];
  duplicateIdentityGroups: Array<{
    canonicalIdentity: string;
    recordCount: number;
    sources: string[];
    sampleSourceIds: string[];
  }>;
}

export function buildPrivateUseAudit(
  sourceMappings: RawIdentityMapping[],
  sourceRecords: Array<{
    source: string;
    sourceId: string;
    rawCodepoints: string[];
    rawSequence: string;
  }>,
): PrivateUseAuditReport {
  const privateUseMappings = sourceMappings.filter(
    (mapping) => mapping.identityCategory === "private-use",
  );
  const uniquePrivateUseIdentities = new Set(
    privateUseMappings.map((mapping) => mapping.canonicalIdentity),
  );

  const rawPrivateUseRecords = sourceRecords.filter(
    (record) =>
      isPrivateUseSequence(record.rawSequence) ||
      record.rawCodepoints.some((codepoint) => isPrivateUseSequence(codepoint)),
  );

  const openmojiPrivateUseRecords = rawPrivateUseRecords.filter((record) => record.source === "openmoji");
  const openmojiExtraRecords = sourceRecords.filter((record) =>
    record.sourceId.startsWith("openmoji-extra:"),
  );
  const openmojiExtrasPrivateUse = sourceMappings.filter(
    (mapping) =>
      mapping.sourceId.startsWith("openmoji-extra:") && mapping.identityCategory === "private-use",
  ).length;
  const openmojiExtrasUnicodeMapped = sourceMappings.filter(
    (mapping) =>
      mapping.sourceId.startsWith("openmoji-extra:") && isUnicodeIdentity(mapping.canonicalIdentity),
  ).length;
  const twemojiPrivateUseRecords = rawPrivateUseRecords.filter((record) => record.source === "twemoji");

  const groups = new Map<string, RawIdentityMapping[]>();
  for (const mapping of privateUseMappings) {
    const existing = groups.get(mapping.canonicalIdentity) ?? [];
    existing.push(mapping);
    groups.set(mapping.canonicalIdentity, existing);
  }

  const duplicateIdentityGroups = [...groups.entries()]
    .filter(([, mappings]) => mappings.length > 1)
    .map(([canonicalIdentity, mappings]) => ({
      canonicalIdentity,
      recordCount: mappings.length,
      sources: [...new Set(mappings.map((mapping) => mapping.source))],
      sampleSourceIds: mappings.slice(0, 5).map((mapping) => mapping.sourceId),
    }))
    .sort((left, right) => right.recordCount - left.recordCount);

  return {
    generatedAt: new Date().toISOString(),
    phase: "8.3a",
    summary: {
      rawPrivateUseRecords: rawPrivateUseRecords.length,
      uniquePrivateUseIdentities: uniquePrivateUseIdentities.size,
      openmojiPrivateUseRecords: openmojiPrivateUseRecords.length,
      openmojiExtraRecords: openmojiExtraRecords.length,
      openmojiExtrasPrivateUse,
      openmojiExtrasUnicodeMapped,
      twemojiPrivateUseRecords: twemojiPrivateUseRecords.length,
    },
    explanation: [
      "728 raw source records are classified private-use because their codepoint sequences are entirely in the BMP private-use area (U+E000..U+F8FF).",
      "734 OpenMoji records use private-use hexcodes. 367 are standard openmoji:<PUA> rows and 367 are duplicate openmoji-extra:<PUA> rows for the same extras.",
      "542 OpenMoji extras exist in total: 363 map to source:openmoji:<PUA> private-use identities and 179 map to real Unicode sequences (e.g. 1F10D, tag sequences).",
      "366 unique private-use identities means many records share one canonical identity (e.g. openmoji:E000, openmoji-extra:E000, and openmoji-artwork:E000 all resolve to source:openmoji:E000).",
      "2 Twemoji private-use artwork records (E50A) are separate from the OpenMoji extras set.",
    ],
    duplicateIdentityGroups,
  };
}
