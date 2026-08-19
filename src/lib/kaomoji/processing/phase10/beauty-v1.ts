import type { ScoreComponents } from "./types";

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
  if (/[\u3000-\u303f]/.test(content)) s += 10;
  return Math.min(100, s);
}

function cuteFactor(content: string): number {
  let s = 45;
  if (/[｡◕‿◕｡]/u.test(content)) s += 35;
  if (/[♥♡]/u.test(content)) s += 15;
  if (/\^[_\-]?\^|\(\.\.\)/.test(content)) s += 10;
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
