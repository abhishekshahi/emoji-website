import type { TaxonomyCategory } from "./types";

const KAOMOJI_LIKE = /[(){}[\]^_\-=~*<>|\\/|｡◕‿◕♥♡]/u;

export interface NameAssignment {
  readonly editorial_name: string | null;
  readonly name_confidence: "high" | "medium" | "low";
  readonly name_status: "ASSIGNED" | "REVIEW";
  readonly accessible_name: string;
}

function titleCase(label: string): string {
  return label
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function assignName(
  content: string,
  categories: readonly TaxonomyCategory[],
  categoryConfidence: "high" | "medium" | "low",
): NameAssignment {
  const looksLikeKaomoji = KAOMOJI_LIKE.test(content) && content.length <= 120;
  const primary = categories[0];

  if (!looksLikeKaomoji || !primary) {
    return {
      editorial_name: null,
      name_confidence: "low",
      name_status: "REVIEW",
      accessible_name: "kaomoji expression",
    };
  }

  if (categoryConfidence === "high" && categories.length >= 1) {
    const name = `${titleCase(primary.label)} Kaomoji`;
    return {
      editorial_name: name,
      name_confidence: "high",
      name_status: "ASSIGNED",
      accessible_name: `${primary.label.toLowerCase()} kaomoji`,
    };
  }

  if (categoryConfidence === "medium" && primary) {
    return {
      editorial_name: `${titleCase(primary.label)} Face`,
      name_confidence: "medium",
      name_status: "REVIEW",
      accessible_name: `${primary.label.toLowerCase()} kaomoji`,
    };
  }

  return {
    editorial_name: null,
    name_confidence: "low",
    name_status: "REVIEW",
    accessible_name: "kaomoji expression",
  };
}

export function buildSeoTitle(name: string | null, content: string): string {
  const display = content.length > 40 ? `${content.slice(0, 37)}…` : content;
  if (name) return `${name} ${display} — Meaning & Copy | EmojiQuick`;
  return `${display} Kaomoji — Copy & Meaning | EmojiQuick`;
}

export function buildSeoDescription(
  name: string | null,
  content: string,
  categories: readonly TaxonomyCategory[],
): string {
  const cat = categories[0]?.label?.toLowerCase() ?? "expressive";
  const label = name ?? "This kaomoji";
  const display = content.length > 60 ? `${content.slice(0, 57)}…` : content;
  return `Copy ${display}. ${label} — a ${cat} Japanese-style text face on EmojiQuick.`;
}
