import type { KaomojiEditorialRecord } from "../phase9/types";
import type { ContentValidationResult } from "./types";

const URL = /https?:\/\//i;
const HTML = /<\/?[a-z][\s\S]*?>/i;
const REPLACEMENT = /\uFFFD|\uFFFD/;

export function validatePublicContent(records: readonly KaomojiEditorialRecord[]): ContentValidationResult {
  const flags: Record<string, number> = {};
  let valid = 0, review = 0, invalid = 0;
  for (const r of records) {
    const c = r.canonical_content;
    let status: "VALID" | "REVIEW" | "INVALID" = "VALID";
    if (!c || c.trim().length === 0) { status = "INVALID"; flags.empty = (flags.empty ?? 0) + 1; }
    else if (URL.test(c)) { status = "INVALID"; flags.url = (flags.url ?? 0) + 1; }
    else if (HTML.test(c)) { status = "INVALID"; flags.html = (flags.html ?? 0) + 1; }
    else if (REPLACEMENT.test(c)) { status = "REVIEW"; flags.replacement_char = (flags.replacement_char ?? 0) + 1; }
    else if (c.length > 500) { status = "REVIEW"; flags.very_long = (flags.very_long ?? 0) + 1; }
    if (status === "VALID") valid++;
    else if (status === "REVIEW") review++;
    else invalid++;
  }
  return { valid, review, invalid, flags };
}