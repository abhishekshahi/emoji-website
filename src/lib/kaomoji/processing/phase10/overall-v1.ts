import type { ScoreComponents } from "./types";

export const OVERALL_V1_VERSION = "10.0.0-overall-v1";

export function computeOverallV1(
  quality: number,
  beauty: number,
  uniqueness: number,
  expressiveness: number,
): { score: number; components: ScoreComponents } {
  const components: ScoreComponents = {
    quality: quality,
    beauty: beauty,
    uniqueness: uniqueness,
    expressiveness: expressiveness,
    popularity: 0,
    popularity_status: 0,
  };
  const score = Math.round(quality * 0.3 + beauty * 0.3 + uniqueness * 0.2 + expressiveness * 0.2);
  return { score: Math.min(100, Math.max(0, score)), components };
}

export function scoreDistribution(score: number): string {
  if (score >= 90) return "90-100";
  if (score >= 80) return "80-89";
  if (score >= 70) return "70-79";
  if (score >= 60) return "60-69";
  if (score >= 40) return "40-59";
  return "0-39";
}
