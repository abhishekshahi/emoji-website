const ZERO_WIDTH = /[\u200B-\u200D\uFEFF\u00AD]/g;
const FULLWIDTH_ASCII = /[\uFF01-\uFF5E]/g;

export interface NormalizedQuery {
  readonly original: string;
  readonly normalized: string;
  readonly tokens: readonly string[];
  readonly is_kaomoji_like: boolean;
}

function toHalfWidth(ch: string): string {
  const code = ch.charCodeAt(0);
  if (code >= 0xff01 && code <= 0xff5e) return String.fromCharCode(code - 0xfee0);
  if (code === 0x3000) return " ";
  return ch;
}

export function normalizeKaomojiContent(text: string): string {
  return text.normalize("NFC").replace(ZERO_WIDTH, "").replace(FULLWIDTH_ASCII, toHalfWidth).trim();
}

export function isKaomojiLikeQuery(query: string): boolean {
  if (/[\(\[\{⟨（【]/.test(query)) return true;
  if (/[^\x00-\x7F]/.test(query) && /[◕‿♥｡・゛゜]/.test(query)) return true;
  if (/[_^][\s\S]*[_^]/.test(query)) return true;
  if (/[|;]/.test(query) && /[(){}[\]]/.test(query)) return true;
  return false;
}

export function normalizeSearchQuery(query: string): NormalizedQuery {
  const original = query.slice(0, 120);
  let normalized = original.normalize("NFC");
  normalized = normalized.replace(ZERO_WIDTH, "");
  normalized = normalized.replace(FULLWIDTH_ASCII, toHalfWidth);
  normalized = normalized.replace(/\s+/g, " ").trim().toLowerCase();
  const tokens = normalized
    .replace(/[^\p{L}\p{N}\s+-]/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  return {
    original,
    normalized,
    tokens,
    is_kaomoji_like: isKaomojiLikeQuery(original),
  };
}
