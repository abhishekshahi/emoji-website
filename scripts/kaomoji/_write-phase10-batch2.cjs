const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "..");
const dir = path.join(root, "src/lib/kaomoji/processing/phase10");
function w(name, content) {
  fs.writeFileSync(path.join(dir, name), content, "utf8");
  console.log("wrote", name);
}

w("beauty-v1.ts", `import type { ScoreComponents } from "./types";

export const BEAUTY_V1_VERSION = "10.0.0-aesthetic-v1";

function symmetryScore(content: string): number {
  const rev = content.split("").reverse().join("");
  if (content === rev && content.length >= 3) return 95;
  const half = Math.floor(content.length / 2);
  let matches = 0;
  for (let i = 0; i < half; i++) {
    if (content[i] === content[content.length - 1 - i]) matches++;
  }
  return half > 0 ? Math.round((matches / half) * 100) : 50;
}

function visualBalance(content: string): number {
  const left = content.slice(0, Math.ceil(content.length / 2));
  const right = content.slice(Math.ceil(content.length / 2));
  const diff = Math.abs(left.length - right.length);
  let s = 80 - diff * 5;
  if (/[♥♡❤✧✿☆★]/u.test(content)) s += 10;
  return Math.max(0, Math.min(100, s));
}

function decorativeQuality(content: string): number {
  let s = 40;
  const deco = (content.match(/[♥♡❤✧✿☆★~*]/gu) ?? []).length;
  s += Math.min(40, deco * 8);
  if (/[\\u3000-\\u303f]/.test(content)) s += 10;
  return Math.min(100, s);
}

function cuteFactor(content: string): number {
  let s = 45;
  if (/[｡◕‿◕｡]/u.test(content)) s += 35;
  if (/[♥♡]/u.test(content)) s += 15;
  if (/\\^[_\\-]?\\^|\\(\\.\\.\\)/.test(content)) s += 10;
  return Math.min(100, s);
}

function composition(content: string): number {
  if (content.length >= 3 && content.length <= 25) return 85;
  if (content.length <= 40) return 70;
  return 55;
}

export function computeBeautyV1(content: string): { score: number; components: ScoreComponents; features: ScoreComponents } {
  const components: ScoreComponents = {
    visual_balance: visualBalance(content),
    symmetry: symmetryScore(content),
    character_harmony: Math.min(100, 60 + (new Set(content).size > 1 ? 25 : 0)),
    decorative_quality: decorativeQuality(content),
    cute_factor: cuteFactor(content),
    expressiveness: Math.min(100, 50 + (/[T^_oO~]/i.test(content) ? 30 : 0)),
    composition: composition(content),
  };
  const score = Math.round(
    components.visual_balance * 0.2 +
    components.symmetry * 0.15 +
    components.character_harmony * 0.15 +
    components.decorative_quality * 0.15 +
    components.cute_factor * 0.15 +
    components.expressiveness * 0.1 +
    components.composition * 0.1,
  );
  const features: ScoreComponents = {
    symmetry_score: components.symmetry,
    balance_score: components.visual_balance,
    density_score: Math.min(100, content.length * 4),
    decorative_score: components.decorative_quality,
    cute_score: components.cute_factor,
    complexity_score: Math.min(100, new Set(content).size * 8),
    expression_score: components.expressiveness,
  };
  return { score, components, features };
}
`);

w("uniqueness-v1.ts", `import type { KaomojiEditorialRecord } from "../phase9/types";
import type { ScoreComponents } from "./types";

export const UNIQUENESS_V1_VERSION = "10.0.0-uniqueness-v1";

export function computeUniquenessV1(
  editorial: KaomojiEditorialRecord,
  normFrequency: Map<string, number>,
): { score: number; components: ScoreComponents } {
  const freq = normFrequency.get(editorial.normalized_content) ?? 1;
  const visualDistinct = Math.min(100, new Set(editorial.canonical_content).size * 10);
  const structuralDistinct = Math.min(100, editorial.canonical_content.length * 3);
  const comboUnique = Math.max(0, 100 - Math.log2(freq + 1) * 15);
  const variantDistinct = editorial.variant_group_id ? 70 : 85;
  const components: ScoreComponents = {
    visual_distinctiveness: visualDistinct,
    structural_distinctiveness: structuralDistinct,
    combination_uniqueness: Math.round(comboUnique),
    variant_distinctiveness: variantDistinct,
  };
  const score = Math.round(
    components.visual_distinctiveness * 0.3 +
    components.structural_distinctiveness * 0.25 +
    components.combination_uniqueness * 0.3 +
    components.variant_distinctiveness * 0.15,
  );
  return { score: Math.min(100, Math.max(0, score)), components };
}
`);

w("expressiveness-v1.ts", `import type { ScoreComponents } from "./types";

export const EXPRESSIVENESS_V1_VERSION = "10.0.0-expressiveness-v1";

export function computeExpressivenessV1(content: string): { score: number; components: ScoreComponents } {
  const facialClarity = /[T^_oO0\\.\\-~]/.test(content) ? 80 : 45;
  const emotionClarity = /[♥♡❤😀-🙏]|[\\u2600-\\u27bf]/u.test(content) ? 75 : 55;
  const gestureClarity = /[\\/\\\\|\\u256f\\u256d\\u252c\\u2534]/.test(content) ? 70 : 50;
  const visualEmphasis = Math.min(100, (content.match(/[!?~*]/g) ?? []).length * 15 + 50);
  const semanticRecognizability = /[()（）].*[()（）]/.test(content) ? 80 : 50;
  const components: ScoreComponents = {
    facial_clarity: facialClarity,
    emotion_clarity: emotionClarity,
    gesture_clarity: gestureClarity,
    visual_emphasis: visualEmphasis,
    semantic_recognizability: semanticRecognizability,
  };
  const score = Math.round(
    components.facial_clarity * 0.25 +
    components.emotion_clarity * 0.25 +
    components.gesture_clarity * 0.2 +
    components.visual_emphasis * 0.15 +
    components.semantic_recognizability * 0.15,
  );
  return { score: Math.min(100, Math.max(0, score)), components };
}
`);

w("overall-v1.ts", `import type { ScoreComponents } from "./types";

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
`);

console.log("phase10 batch2 done");
