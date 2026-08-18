import { listMeanings } from "./registry";
import type { EmojiMeaningRecord } from "./types";

export interface MeaningQualityReport {
  readonly slug: string;
  readonly score: number;
  readonly issues: readonly string[];
}

const TEMPLATE_MARKERS = [
  "Context varies by platform",
  "Example with ",
  "Use when expressing",
];

export function scoreMeaningRecord(record: EmojiMeaningRecord): MeaningQualityReport {
  const issues: string[] = [];
  let score = 100;

  for (const marker of TEMPLATE_MARKERS) {
    if (record.meaning.includes(marker) || record.usage.includes(marker)) {
      issues.push("templated wording");
      score -= 15;
    }
  }

  if (!record.summary || record.summary.length < 8) {
    issues.push("weak summary");
    score -= 20;
  }

  if (record.provenance.qualityStatus === "complete" && (record.examples?.length ?? 0) < 1) {
    issues.push("rich tier missing examples");
    score -= 25;
  }

  if (record.contentTier === "medium" && record.meaning.length < 40) {
    issues.push("thin medium content");
    score -= 10;
  }

  return Object.freeze({
    slug: record.slug,
    score: Math.max(0, Math.min(100, score)),
    issues: Object.freeze([...new Set(issues)]),
  });
}

export function auditAllMeanings(): readonly MeaningQualityReport[] {
  return listMeanings().map(scoreMeaningRecord).sort((a, b) => a.score - b.score);
}

export function averageMeaningQualityScore(): number {
  const reports = auditAllMeanings();
  if (reports.length === 0) return 0;
  return Math.round(reports.reduce((sum, r) => sum + r.score, 0) / reports.length);
}
