import type { ShortcodeSourceIndexEntry } from "../metadata/types";
import type { CanonicalShortcodeEntry } from "./types";
import { normalizeShortcode } from "./normalize";

export function buildCanonicalShortcodes(
  canonicalId: string,
  shortcodeEntry: ShortcodeSourceIndexEntry | undefined,
): CanonicalShortcodeEntry {
  const shortcodes: CanonicalShortcodeEntry["shortcodes"] = [];
  const normalizedMap = new Map<string, CanonicalShortcodeEntry["shortcodes"][number]>();

  if (!shortcodeEntry) {
    return { canonicalId, shortcodes };
  }

  for (const [pack, values] of Object.entries(shortcodeEntry.shortcodes)) {
    const source = pack === "emojibaseRecord" ? "emojibase" : pack === "emojinet" ? "emojinet" : pack;
    for (const value of values) {
      const normalizedShortcode = normalizeShortcode(value);
      if (!normalizedShortcode) {
        continue;
      }

      const existing = normalizedMap.get(normalizedShortcode);
      if (existing) {
        existing.status = "duplicate-normalized";
        continue;
      }

      const entry = {
        shortcode: value,
        normalizedShortcode,
        source,
        shortcodePack: pack,
        status: "active" as const,
      };
      normalizedMap.set(normalizedShortcode, entry);
      shortcodes.push(entry);
    }
  }

  shortcodes.sort((left, right) => left.normalizedShortcode.localeCompare(right.normalizedShortcode));
  return { canonicalId, shortcodes };
}
