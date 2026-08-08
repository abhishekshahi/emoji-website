import { getEmojiByHexcode, getEmojiById } from "@/lib/emoji/data";

/**
 * Resolves a stored legacy id or canonical hexcode to the dataset hexcode.
 */
export function resolveStoredHexcode(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const byHexcode = getEmojiByHexcode(trimmed);
  if (byHexcode) {
    return byHexcode.hexcode;
  }

  const byId = getEmojiById(trimmed);
  if (byId) {
    return byId.hexcode;
  }

  return null;
}

/**
 * Normalizes legacy stored values (emoji ids) to canonical hexcodes.
 * Invalid entries are dropped. Order is preserved; duplicates removed.
 */
export function normalizeStoredHexcodes(
  values: readonly string[],
  maxItems?: number,
): string[] {
  if (values.length === 0) {
    return [];
  }

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const hexcode = resolveStoredHexcode(value);
    if (!hexcode || seen.has(hexcode)) {
      continue;
    }

    seen.add(hexcode);
    normalized.push(hexcode);
  }

  return maxItems ? normalized.slice(0, maxItems) : normalized;
}
