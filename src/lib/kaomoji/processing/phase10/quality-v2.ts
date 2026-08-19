import type { KaomojiEditorialRecord } from "../phase9/types";
import type { QualityBucket, QualityStatusV2, ScoreComponents } from "./types";

export const QUALITY_V2_VERSION = "10.0.0-quality-v2";

const URL_RE = /https?:\/\/|\bwww\./i;
const HTML_RE = /<[^>]+>|&(?:lt|gt|amp|nbsp);/i;

export function detectLowQualitySignals(content: string): string[] {
  const reasons: string[] = [];
  if (!content || content.trim().length === 0) reasons.push("empty_content");
  if (URL_RE.test(content)) reasons.push("contains_url");
  if (HTML_RE.test(content)) reasons.push("html_fragment");
  if (/\b(click here|subscribe|cookie|tracking|advertisement)\b/i.test(content)) reasons.push("navigation_or_ad");
  if (/[\uFFFD\u0000]/.test(content)) reasons.push("corrupt_encoding");
  if (content.length > 200) reasons.push("excessive_length");
  if (/^[a-z0-9_-]+$/i.test(content) && !/[()^\u3000-\u303f\u3040-\u30ff\u2600-\u27bf]/.test(content)) reasons.push("slug_not_kaomoji");
  return reasons;
}

function unicodeIntegrity(content: string): number {
  if (/[\uFFFD\u0000]/.test(content)) return 0;
  let score = 100;
  const replacement = (content.match(/\uFFFD/g) ?? []).length;
  score -= replacement * 30;
  if (content.length === 0) return 0;
  return Math.max(0, Math.min(100, score));
}

function structuralCompleteness(content: string): number {
  const hasFace = /[()（）\[\]{}]|[_^\-~=]|\u3000|[\u3040-\u30ff\u4e00-\u9fff]|[\u2600-\u27bf\u1F300-\u1FAFF]/u.test(content);
  if (!hasFace && content.length < 3) return 20;
  if (/^[a-z0-9_-]+$/i.test(content)) return 15;
  let s = 60;
  if (/[()（）].*[()（）]/.test(content)) s += 25;
  if (content.length >= 2 && content.length <= 40) s += 15;
  return Math.min(100, s);
}

function readability(content: string): number {
  if (content.length === 0) return 0;
  if (content.length <= 30) return 90;
  if (content.length <= 60) return 70;
  if (content.length <= 120) return 50;
  return 30;
}

function expressivenessComponent(content: string): number {
  let s = 50;
  if (/[T^_\-~oO0]/.test(content)) s += 15;
  if (/[♥♡❤\u2665]/.test(content)) s += 10;
  if (/[\u3000-\u303f\u3040-\u30ff]/.test(content)) s += 10;
  if (/[\u0361\u035f\u0489]/.test(content)) s += 5;
  return Math.min(100, s);
}

function visualCoherence(content: string): number {
  const open = (content.match(/[\(\[\{（]/g) ?? []).length;
  const close = (content.match(/[\)\]\}）]/g) ?? []).length;
  let s = 70;
  if (open > 0 && close > 0 && Math.abs(open - close) <= 1) s += 20;
  else if (Math.abs(open - close) > 2) s -= 20;
  return Math.max(0, Math.min(100, s));
}

function characterHarmony(content: string): number {
  const unique = new Set(content).size;
  if (unique <= 1) return 30;
  if (unique / content.length > 0.8 && content.length > 10) return 60;
  return 75;
}

function extractionConfidence(editorial: KaomojiEditorialRecord): number {
  let s = 50;
  if (editorial.provenance_status === "COMPLETE") s += 30;
  else if (editorial.provenance_status === "PARTIAL") s += 15;
  if (editorial.source_occurrence_count >= 2) s += 15;
  if (editorial.curation_status === "KEEP_CANDIDATE") s += 5;
  return Math.min(100, s);
}

export function computeQualityV2(editorial: KaomojiEditorialRecord): {
  score: number;
  components: ScoreComponents;
  status: QualityStatusV2;
  bucket: QualityBucket;
  reasons: string[];
} {
  const content = editorial.canonical_content;
  const lowSignals = detectLowQualitySignals(content);
  const components: ScoreComponents = {
    unicode_integrity: unicodeIntegrity(content),
    structural_completeness: structuralCompleteness(content),
    readability: readability(content),
    expressiveness: expressivenessComponent(content),
    visual_coherence: visualCoherence(content),
    character_harmony: characterHarmony(content),
    extraction_confidence: extractionConfidence(editorial),
  };
  const score = Math.round(
    components.unicode_integrity * 0.2 +
    components.structural_completeness * 0.2 +
    components.readability * 0.15 +
    components.expressiveness * 0.15 +
    components.visual_coherence * 0.15 +
    components.character_harmony * 0.1 +
    components.extraction_confidence * 0.05,
  );
  const reasons = [...lowSignals];
  let status: QualityStatusV2 = "GOOD";
  let bucket: QualityBucket = "GOOD";
  if (lowSignals.length >= 2 || score < 40) { status = "REVIEW"; bucket = "INVALID_REVIEW"; }
  else if (score >= 90) { status = "HIGH"; bucket = "EXCELLENT"; }
  else if (score >= 80) { status = "HIGH"; bucket = "HIGH"; }
  else if (score >= 70) { status = "GOOD"; bucket = "GOOD"; }
  else if (score >= 60) { status = "MEDIUM"; bucket = "MEDIUM"; }
  else if (score >= 40) { status = "LOW"; bucket = "LOW"; }
  else { status = "REVIEW"; bucket = "INVALID_REVIEW"; }
  if (editorial.curation_status === "REMOVE_CANDIDATE") {
    status = "REVIEW";
    bucket = "INVALID_REVIEW";
    reasons.push("remove_candidate_flag");
  }
  return { score, components, status, bucket, reasons };
}
