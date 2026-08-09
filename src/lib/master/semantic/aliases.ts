import type { CanonicalKeywordEntry } from "../reconciliation/types";
import type { CanonicalNameRecord } from "../reconciliation/types";
import type { RawMetadataIndexRecord } from "../metadata/types";
import type { AliasAuditEntry, AliasSafetyClassification } from "./types";
import { normalizeForComparison } from "../reconciliation/normalize";
import { AMBIGUITY_THRESHOLD } from "./classify";

export function auditAlias(
  alias: CanonicalNameRecord["aliases"][number],
  canonicalName: string,
  globalAliasCounts: Map<string, number>,
): AliasAuditEntry {
  const normalized = normalizeForComparison(alias.value);
  const canonicalNorm = normalizeForComparison(canonicalName);
  const globalCount = globalAliasCounts.get(normalized) ?? 1;

  let classification: AliasSafetyClassification = "safe-canonical-alias";
  let publicAlias = true;
  let reason = "distinct-source-name-safe-for-public-alias";

  if (!normalized || normalized === canonicalNorm) {
    classification = "duplicate";
    publicAlias = false;
    reason = "duplicate-of-canonical-name";
  } else if (globalCount >= AMBIGUITY_THRESHOLD) {
    classification = "ambiguous";
    publicAlias = false;
    reason = `alias-appears-on-${globalCount}-identities`;
  } else if (alias.type === "semantic-label") {
    classification = "semantic-term";
    publicAlias = false;
    reason = "semantic-label-not-public-alias";
  } else if (alias.type === "source-specific") {
    classification = "source-only-alternate-name";
    publicAlias = false;
    reason = "source-specific-naming";
  } else if (alias.value.length > 60) {
    classification = "potentially-confusing";
    publicAlias = false;
    reason = "overlong-alternate-name";
  } else if (/https?:\/\//i.test(alias.value)) {
    classification = "potentially-confusing";
    publicAlias = false;
    reason = "contains-url";
  }

  return {
    value: alias.value,
    source: alias.source,
    type: alias.type,
    classification,
    publicAlias,
    reason,
  };
}

export function buildGlobalAliasCounts(nameRecords: CanonicalNameRecord[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const record of nameRecords) {
    for (const alias of record.aliases) {
      const key = normalizeForComparison(alias.value);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

export function collectKeywordTerms(
  keywordEntry: CanonicalKeywordEntry | undefined,
  records: RawMetadataIndexRecord[],
): Array<{ term: string; source: string; sourceRecord: string; sourceVersion: string; isTag: boolean; isSenseKeyword: boolean }> {
  const terms: Array<{
    term: string;
    source: string;
    sourceRecord: string;
    sourceVersion: string;
    isTag: boolean;
    isSenseKeyword: boolean;
  }> = [];

  if (keywordEntry) {
    for (const sourceSet of keywordEntry.sourceKeywords) {
      for (const keyword of sourceSet.keywords) {
        terms.push({
          term: keyword,
          source: sourceSet.source,
          sourceRecord: sourceSet.metadataRecordIds[0] ?? `${sourceSet.source}:keyword`,
          sourceVersion: records.find((record) => record.source === sourceSet.source)?.sourceVersion ?? "unknown",
          isTag: sourceSet.source === "openmoji" || sourceSet.source === "emojibase",
          isSenseKeyword: false,
        });
      }
    }
  }

  for (const record of records.filter((entry) => entry.recordType === "semantic")) {
    for (const keyword of record.fields.keywords) {
      terms.push({
        term: keyword,
        source: "emojinet",
        sourceRecord: record.metadataRecordId,
        sourceVersion: record.sourceVersion,
        isTag: false,
        isSenseKeyword: true,
      });
    }
  }

  return terms;
}
