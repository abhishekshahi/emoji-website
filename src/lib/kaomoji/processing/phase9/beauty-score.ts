export const BEAUTY_VERSION = "9.0.0-aesthetic-deterministic";

export function computeBeautyScore(content: string, qualityScore: number): number {
  let score = Math.min(qualityScore, 100) * 0.4;
  const len = content.length;
  if (len >= 3 && len <= 24) score += 15;
  else if (len <= 40) score += 8;
  if (/[♥♡❤✧✿☆★]/u.test(content)) score += 10;
  if (/[（(].*[）)]/u.test(content)) score += 8;
  if (/^[^\x00-\x7F]*[（(][^\x00-\x7F]*[）)][^\x00-\x7F]*$/u.test(content)) score += 6;
  const left = content.split("").reverse().join("");
  if (content === left && content.length >= 3) score += 12;
  if (/[｡◕‿◕｡]/u.test(content)) score += 8;
  return Math.round(Math.min(100, Math.max(0, score)));
}
