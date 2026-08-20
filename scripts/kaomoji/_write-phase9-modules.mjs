#!/usr/bin/env node
/** Writes Phase 9 source modules as UTF-8 (avoids OneDrive UTF-16 corruption from editor tools). */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..", "..");
const dir = join(root, "src/lib/kaomoji/processing/phase9");
mkdirSync(dir, { recursive: true });

function w(name, content) {
  const p = join(dir, name);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content, "utf8");
  console.log("wrote", name);
}

w("keywords.ts", `import type { TaxonomyCategory } from "./types";

export function buildSourceKeywords(sourceCategories: readonly string[]): string[] {
  return [...new Set(sourceCategories.map((c) => c.toLowerCase().trim()).filter(Boolean))].sort();
}

export function buildEmojiquickKeywords(
  content: string,
  categories: readonly TaxonomyCategory[],
  sourceKeywords: readonly string[],
): string[] {
  const keywords = new Set<string>();
  for (const c of categories) {
    keywords.add(c.slug);
    keywords.add(c.label.toLowerCase());
    keywords.add(c.group.toLowerCase().replace(/_/g, " "));
  }
  for (const sk of sourceKeywords) {
    if (sk.length >= 2 && sk.length <= 32 && !/^(slug|root|direct|null)$/i.test(sk)) keywords.add(sk);
  }
  if (/[♥♡❤]/u.test(content)) keywords.add("heart");
  if (/[｡◕‿◕｡]/u.test(content)) keywords.add("kawaii");
  if (/\\(.*?[_^].*?\\)/.test(content)) keywords.add("text face");
  keywords.add("kaomoji");
  return [...keywords].sort();
}

export const SEARCH_INTENT_TERMS = [
  "cute", "love", "kawaii", "happy", "sad", "angry", "crying", "laughing",
  "cat", "dog", "hug", "kiss", "sorry", "thank you", "friendship", "shy", "blush",
  "anime", "aesthetic", "funny", "beautiful", "girlfriend", "boyfriend",
  "instagram", "discord", "whatsapp",
] as const;

export function tokenizeForSearch(text: string): string[] {
  return text.toLowerCase().replace(/[^\\p{L}\\p{N}\\s+-]/gu, " ").split(/\\s+/).map((t) => t.trim()).filter((t) => t.length >= 2);
}
`);

w("editorial-priority.ts", `import type { CanonicalRecord } from "../phase8/types";
import type { EditorialPriority, EditorialTier, MeaningStatus } from "./types";
import type { TaxonomyCategory } from "./types";

export function isPublicCandidate(record: CanonicalRecord): boolean {
  return (
    record.curation_status === "KEEP_CANDIDATE" &&
    (record.publication_status === "PUBLISH_CANDIDATE" || record.publication_status === "PUBLISH_WITH_ATTRIBUTION")
  );
}

export function assignPriority(record: CanonicalRecord, categoryConfidence: "high" | "medium" | "low"): EditorialPriority {
  const sources = record.source_occurrences.length;
  const q = record.quality_score;
  if (!isPublicCandidate(record)) return "P3";
  if (q >= 80 && sources >= 3 && categoryConfidence === "high") return "P0";
  if (q >= 70 && sources >= 2) return "P1";
  if (q >= 60 || sources >= 2) return "P2";
  return "P3";
}

export function assignTier(priority: EditorialPriority, categoryConfidence: "high" | "medium" | "low"): EditorialTier {
  if (priority === "P0" && categoryConfidence === "high") return "TIER_1";
  if (priority === "P1" && categoryConfidence !== "low") return "TIER_2";
  return "TIER_3";
}

export function assignMeaning(
  tier: EditorialTier,
  categories: readonly TaxonomyCategory[],
  categoryConfidence: "high" | "medium" | "low",
): { meaning_status: MeaningStatus; meaning: string | null; common_usage: string | null } {
  const primary = categories[0];
  if (!primary || categoryConfidence === "low") {
    return { meaning_status: "NONE", meaning: null, common_usage: null };
  }
  if (tier === "TIER_1") {
    return {
      meaning_status: "CATEGORY_DERIVED",
      meaning: \`A \${primary.label.toLowerCase()} Japanese-style text face (kaomoji) in the \${primary.group.replace(/_/g, " ").toLowerCase()} category.\`,
      common_usage: \`Often used to express \${primary.label.toLowerCase()} feelings in messages and social posts.\`,
    };
  }
  if (tier === "TIER_2") {
    return {
      meaning_status: "CATEGORY_DERIVED",
      meaning: \`\${primary.label} kaomoji — category-derived editorial summary.\`,
      common_usage: null,
    };
  }
  return { meaning_status: "NONE", meaning: null, common_usage: null };
}
`);

w("beauty-score.ts", `export const BEAUTY_VERSION = "9.0.0-aesthetic-deterministic";

export function computeBeautyScore(content: string, qualityScore: number): number {
  let score = Math.min(qualityScore, 100) * 0.4;
  const len = content.length;
  if (len >= 3 && len <= 24) score += 15;
  else if (len <= 40) score += 8;
  if (/[♥♡❤✧✿☆★]/u.test(content)) score += 10;
  if (/[（(].*[）)]/u.test(content)) score += 8;
  if (/^[^\\x00-\\x7F]*[（(][^\\x00-\\x7F]*[）)][^\\x00-\\x7F]*$/u.test(content)) score += 6;
  const left = content.split("").reverse().join("");
  if (content === left && content.length >= 3) score += 12;
  if (/[｡◕‿◕｡]/u.test(content)) score += 8;
  return Math.round(Math.min(100, Math.max(0, score)));
}
`);

w("slug.ts", `export function canonicalIdToSlug(canonicalId: string): string {
  return canonicalId.replace(/^kao_/, "kao-");
}

export function slugToCanonicalId(slug: string): string {
  if (slug.startsWith("kao-")) return \`kao_\${slug.slice(4)}\`;
  if (slug.startsWith("kao_")) return slug;
  return \`kao_\${slug}\`;
}

const SLUG_RE = /^kao-[a-f0-9]{16}$/;

export function isValidKaomojiSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}
`);

console.log("Phase 9 module writer complete.");
