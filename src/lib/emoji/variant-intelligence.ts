import type { EnrichmentVariantLink } from "./enrichment-types";
import type { BrowsableEmoji } from "./types";
import { isOpenMojiExtra } from "./types";

const SKIN_TONE_PARTS = new Set(["1F3FB", "1F3FC", "1F3FD", "1F3FE", "1F3FF"]);
const PERSON_CODES = new Set(["1F9D1", "1F468", "1F469"]);
const ZWJ = "200D";

const SKIN_TONE_LABELS: Record<string, string> = {
  "1F3FB": "Light skin tone",
  "1F3FC": "Medium-light skin tone",
  "1F3FD": "Medium skin tone",
  "1F3FE": "Medium-dark skin tone",
  "1F3FF": "Dark skin tone",
};

export function stripSkinTones(hexcode: string): string {
  return hexcode
    .split("-")
    .filter((part) => !SKIN_TONE_PARTS.has(part.toUpperCase()))
    .join("-");
}

export function getSkinToneLabel(hexcode: string): string | null {
  const part = hexcode.split("-").find((value) => SKIN_TONE_PARTS.has(value.toUpperCase()));
  return part ? (SKIN_TONE_LABELS[part.toUpperCase()] ?? null) : null;
}

export function normalizePersonHex(hexcode: string): string {
  return hexcode
    .split("-")
    .map((part) => (PERSON_CODES.has(part.toUpperCase()) && part.toUpperCase() !== "1F9D1" ? "1F9D1" : part))
    .join("-");
}

export function getVariantBaseKey(emoji: BrowsableEmoji): string {
  if (isOpenMojiExtra(emoji)) {
    return emoji.hexcode.toUpperCase();
  }

  let hex = stripSkinTones(emoji.hexcode).toUpperCase();
  if (emoji.sequence.hasZeroWidthJoiner || emoji.sequence.kind === "zwj") {
    hex = normalizePersonHex(hex);
  }
  return hex;
}

function personCode(hexcode: string): string | null {
  const part = stripSkinTones(hexcode)
    .split("-")
    .find((value) => PERSON_CODES.has(value.toUpperCase()));
  return part?.toUpperCase() ?? null;
}

function zwjSuffix(hexcode: string): string | null {
  const parts = stripSkinTones(hexcode).split("-");
  const zwjIndex = parts.indexOf(ZWJ);
  if (zwjIndex < 0) return null;
  return parts.slice(zwjIndex + 1).join("-");
}

function nameHints(name: string): {
  family: boolean;
  couple: boolean;
  profession: boolean;
} {
  const lower = name.toLowerCase();
  return {
    family: lower.includes("family"),
    couple:
      lower.includes("couple") ||
      lower.includes("kiss") ||
      (lower.includes("heart") && lower.includes("with")),
    profession:
      lower.includes("technologist") ||
      lower.includes("worker") ||
      lower.includes("scientist") ||
      lower.includes("judge") ||
      lower.includes("pilot") ||
      lower.includes("chef") ||
      lower.includes("teacher") ||
      lower.includes("officer") ||
      lower.includes("mechanic") ||
      lower.includes("artist") ||
      lower.includes("astronaut"),
  };
}

export function classifyVariantKind(
  source: BrowsableEmoji,
  target: BrowsableEmoji,
): EnrichmentVariantLink["kind"] {
  if (isOpenMojiExtra(source) || isOpenMojiExtra(target)) {
    return "related";
  }

  const targetTone = getSkinToneLabel(target.hexcode);
  if (targetTone || target.sequence.kind === "skin-tone" || target.skinTone) {
    return "skin-tone";
  }

  if (target.sequence.kind === "flag") {
    return "flag";
  }

  if (target.sequence.kind === "keycap") {
    return "keycap";
  }

  const targetHints = nameHints(target.name);
  if (targetHints.family) {
    return "family";
  }
  if (targetHints.couple) {
    return "couple";
  }

  if (source.sequence.hasZeroWidthJoiner || target.sequence.hasZeroWidthJoiner) {
    const sourcePerson = personCode(source.hexcode);
    const targetPerson = personCode(target.hexcode);
    const sourceSuffix = zwjSuffix(source.hexcode);
    const targetSuffix = zwjSuffix(target.hexcode);

    if (sourceSuffix && targetSuffix && sourceSuffix === targetSuffix) {
      if (sourcePerson && targetPerson && sourcePerson !== targetPerson) {
        return "gender";
      }
      if (targetHints.profession) {
        return "profession";
      }
    }

    if (target.name.toLowerCase().includes("hair")) {
      return "related";
    }

    return "zwj";
  }

  if (target.sequence.kind === "gender" || source.sequence.kind === "gender") {
    return "gender";
  }

  return "sequence";
}

export function buildVariantLabel(source: BrowsableEmoji, target: BrowsableEmoji): string {
  const tone = getSkinToneLabel(target.hexcode);
  if (tone) return tone;

  if (target.name.toLowerCase().startsWith("man ")) return "Man";
  if (target.name.toLowerCase().startsWith("woman ")) return "Woman";
  if (target.name.toLowerCase().startsWith("person ")) return "Person";

  if (target.name.length <= 48) return target.name;
  return target.name.slice(0, 45) + "...";
}

export function findVariantBaseSlug(
  emoji: BrowsableEmoji,
  group: readonly BrowsableEmoji[],
): string | null {
  if (!group.length) return null;

  const ranked = [...group].sort((left, right) => {
    const leftTone = getSkinToneLabel(left.hexcode) ? 1 : 0;
    const rightTone = getSkinToneLabel(right.hexcode) ? 1 : 0;
    if (leftTone !== rightTone) return leftTone - rightTone;

    const leftPerson = personCode(left.hexcode);
    const rightPerson = personCode(right.hexcode);
    const leftNeutral = leftPerson === "1F9D1" ? 0 : 1;
    const rightNeutral = rightPerson === "1F9D1" ? 0 : 1;
    if (leftNeutral !== rightNeutral) return leftNeutral - rightNeutral;

    return left.hexcode.length - right.hexcode.length;
  });

  return ranked[0]?.slug ?? null;
}

export function buildVariantGroupsMap(
  emojis: readonly BrowsableEmoji[],
): Map<string, BrowsableEmoji[]> {
  const groups = new Map<string, BrowsableEmoji[]>();
  for (const emoji of emojis) {
    const key = getVariantBaseKey(emoji);
    const bucket = groups.get(key) ?? [];
    bucket.push(emoji);
    groups.set(key, bucket);
  }
  return groups;
}

export const VARIANT_KIND_ORDER: readonly EnrichmentVariantLink["kind"][] = [
  "skin-tone",
  "gender",
  "profession",
  "family",
  "couple",
  "zwj",
  "flag",
  "keycap",
  "sequence",
  "related",
];

export function sortVariantLinks<T extends { kind: EnrichmentVariantLink["kind"]; label: string }>(
  links: readonly T[],
): T[] {
  return [...links].sort((left, right) => {
    const leftIndex = VARIANT_KIND_ORDER.indexOf(left.kind);
    const rightIndex = VARIANT_KIND_ORDER.indexOf(right.kind);
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    return left.label.localeCompare(right.label);
  });
}
