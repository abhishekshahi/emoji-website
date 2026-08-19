export const PHASE3_USER_AGENT = "EmojiQuick-Phase3/1.0 (research; local development)";

export interface FetchPageResult {
  readonly url: string;
  readonly status: number;
  readonly html: string;
  readonly error?: string;
}

/** Polite fetch with timeout and identifiable user agent. */
export async function fetchPage(
  url: string,
  fetchFn: typeof fetch = fetch,
  options: { delayMs?: number } = {},
): Promise<FetchPageResult> {
  if (options.delayMs) {
    await new Promise((r) => setTimeout(r, options.delayMs));
  }
  try {
    const response = await fetchFn(url, {
      headers: { "User-Agent": PHASE3_USER_AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
    });
    const html = await response.text();
    return { url: response.url, status: response.status, html };
  } catch (err) {
    return {
      url,
      status: 0,
      html: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function decodeBasicEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function stripHtmlTags(text: string): string {
  return decodeBasicEntities(text.replace(/<[^>]+>/g, ""));
}

export function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((v) => v.length > 0))];
}

export function isLikelyEmoticon(text: string): boolean {
  if (!text || text.length < 2 || text.length > 120) return false;
  if (/^https?:\/\//i.test(text)) return false;
  if (/<\/?[a-z]/i.test(text)) return false;
  if (/^(function|var |const |let |import )/.test(text)) return false;
  return /[^\w\s]/.test(text);
}
