import { listPublishedLocalizedPages } from "./published-pages";
import type { PublishedLocalizedPage } from "./published-pages";
import { getLanguageCompletenessReport } from "./registry";
import { LOCALE_REGISTRY, PUBLISHED_LOCALE_CODES } from "./locales";
import { INDEXABLE_IDENTITY_COUNT } from "../knowledge/coverage";

export type TranslationCoverageStatus =
  | "TRANSLATED"
  | "PARTIAL"
  | "FALLBACK"
  | "MISSING"
  | "REVIEW_REQUIRED";

export interface LocaleCoverageReport {
  readonly code: string;
  readonly nativeName: string;
  readonly publishedPages: number;
  readonly registryRecords: number;
  readonly coveragePercent: number;
  readonly searchKeywordCoverage: number;
  readonly seoReadiness: number;
  readonly qualityScore: number;
  readonly status: TranslationCoverageStatus;
}

const ENGLISH_LEAKAGE_RE = /\b(the|and|for|with|emoji meaning)\b/i;

export function scoreLocalizedPageQuality(
  localizedTitle: string,
  localizedDescription: string,
): { score: number; status: TranslationCoverageStatus; englishLeakage: boolean } {
  let score = 40;
  if (localizedTitle.trim().length >= 3) score += 20;
  if (localizedDescription.trim().length >= 12) score += 20;
  const englishLeakage =
    ENGLISH_LEAKAGE_RE.test(localizedTitle) || ENGLISH_LEAKAGE_RE.test(localizedDescription);
  if (englishLeakage) score -= 25;
  if (/[\u0900-\u097F\u3040-\u30FF\u4E00-\u9FFF]/.test(localizedTitle + localizedDescription)) {
    score += 5;
  }
  score = Math.max(0, Math.min(100, score));
  const status: TranslationCoverageStatus =
    score >= 85
      ? "TRANSLATED"
      : score >= 65
        ? "PARTIAL"
        : englishLeakage
          ? "REVIEW_REQUIRED"
          : score >= 40
            ? "PARTIAL"
            : "MISSING";
  return { score, status, englishLeakage };
}

export function computeMultilingualCoverageReports(): readonly LocaleCoverageReport[] {
  const pages = listPublishedLocalizedPages();
  const registryReport = getLanguageCompletenessReport();
  const byLang = new Map<string, PublishedLocalizedPage[]>();

  for (const page of pages) {
    const list = byLang.get(page.language) ?? [];
    list.push(page);
    byLang.set(page.language, list);
  }

  return PUBLISHED_LOCALE_CODES.map((code) => {
    const langPages = byLang.get(code) ?? [];
    const qualityScores = langPages.map((p) =>
      scoreLocalizedPageQuality(p.localizedTitle, p.localizedDescription),
    );
    const avgQuality =
      qualityScores.length > 0
        ? Math.round(qualityScores.reduce((a, b) => a + b.score, 0) / qualityScores.length)
        : 0;
    const publishedPages = langPages.length;
    const registryRecords = registryReport[code]?.total ?? 0;
    const coveragePercent =
      Math.round((publishedPages / INDEXABLE_IDENTITY_COUNT) * 10000) / 100;
    const searchKeywordCoverage = Math.min(
      100,
      Math.round((registryRecords / Math.max(publishedPages, 1)) * 10),
    );
    const seoReadiness =
      qualityScores.filter((q) => q.score >= 70 && !q.englishLeakage).length > 0
        ? Math.round(
            (qualityScores.filter((q) => q.score >= 70 && !q.englishLeakage).length /
              Math.max(qualityScores.length, 1)) *
              100,
          )
        : 0;
    const status: TranslationCoverageStatus =
      publishedPages === 0
        ? "MISSING"
        : avgQuality >= 80
          ? "TRANSLATED"
          : avgQuality >= 60
            ? "PARTIAL"
            : "REVIEW_REQUIRED";

    return {
      code,
      nativeName: LOCALE_REGISTRY[code].nativeName,
      publishedPages,
      registryRecords,
      coveragePercent,
      searchKeywordCoverage,
      seoReadiness,
      qualityScore: avgQuality,
      status,
    };
  });
}

export function countEnglishLeakagePages(): number {
  return listPublishedLocalizedPages().filter((page) => {
    const { englishLeakage } = scoreLocalizedPageQuality(
      page.localizedTitle,
      page.localizedDescription,
    );
    return englishLeakage;
  }).length;
}
