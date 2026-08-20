import { listMeanings } from "../meaning/registry";
import { averageMeaningQualityScore, auditAllMeanings } from "../meaning/quality-audit";
import { computeContentPriorities, getPriorityOpportunities } from "../meaning/priority-engine";
import { ANALYTICS_MATURITY } from "../analytics/events";
import { listPublishedLocalizedPages } from "../localization/published-pages";
import type { KnowledgeCoverageReport } from "./types";

export const CANONICAL_IDENTITY_COUNT = 6955 as const;
export const INDEXABLE_IDENTITY_COUNT = 6953 as const;

function isRichMeaning(record: ReturnType<typeof listMeanings>[number]): boolean {
  return Boolean(
    record.meaning &&
      record.summary &&
      (record.examples?.length ?? 0) >= 1 &&
      record.provenance.qualityStatus === "complete",
  );
}

function isMediumMeaning(record: ReturnType<typeof listMeanings>[number]): boolean {
  return Boolean(
    record.contentTier === "medium" ||
      (record.provenance.qualityStatus === "partial" &&
        record.summary &&
        record.meaning &&
        (record.examples?.length ?? 0) === 0),
  );
}

export function computeKnowledgeCoverage(): KnowledgeCoverageReport {
  const meanings = listMeanings();
  const richSlugs: string[] = [];
  const mediumSlugs: string[] = [];

  for (const record of meanings) {
    if (isRichMeaning(record)) {
      richSlugs.push(record.slug);
    } else if (isMediumMeaning(record)) {
      mediumSlugs.push(record.slug);
    }
  }

  const richContent = richSlugs.length;
  const mediumContent = mediumSlugs.length;
  const structuredOnlyContent = Math.max(
    0,
    INDEXABLE_IDENTITY_COUNT - richContent - mediumContent,
  );
  const missingContent = structuredOnlyContent;

  const priorityBandCounts = { P0: 0, P1: 0, P2: 0, P3: 0 } as Record<"P0" | "P1" | "P2" | "P3", number>;
  for (const entry of computeContentPriorities(500)) {
    priorityBandCounts[entry.band] += 1;
  }

  const weakRecordCount = auditAllMeanings().filter((r) => r.score < 70).length;

  return Object.freeze({
    totalIdentities: CANONICAL_IDENTITY_COUNT,
    indexableIdentities: INDEXABLE_IDENTITY_COUNT,
    richContent,
    mediumContent,
    structuredOnlyContent,
    partialContent: mediumContent,
    missingContent,
    richPercent: Math.round((richContent / INDEXABLE_IDENTITY_COUNT) * 1000) / 10,
    mediumPercent: Math.round((mediumContent / INDEXABLE_IDENTITY_COUNT) * 1000) / 10,
    averageQualityScore: averageMeaningQualityScore(),
    priorityOpportunities: getPriorityOpportunities(12).map((p) => p.slug),
    richSlugs: Object.freeze(richSlugs),
    mediumSlugs: Object.freeze(mediumSlugs),
    partialSlugs: Object.freeze(mediumSlugs),
    computedAt: new Date().toISOString(),
    priorityBandCounts: Object.freeze(priorityBandCounts),
    analyticsRankingLabel: ANALYTICS_MATURITY.rankingLabel,
    localizedPageCount: listPublishedLocalizedPages().length,
    weakRecordCount,
  });
}
