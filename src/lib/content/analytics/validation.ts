import type { AnalyticsEventKind } from "./events";

export const VALID_EVENT_KINDS: readonly AnalyticsEventKind[] = [
  "emoji_search",
  "emoji_view",
  "emoji_copy",
  "emoji_favorite",
  "emoji_unfavorite",
  "emoji_share",
  "related_click",
  "collection_view",
  "collection_click",
  "combination_view",
  "combination_copy",
  "generator_use",
] as const;

const CANONICAL_ID_RE = /^(?:unicode:[0-9A-F-]+(?:-[0-9A-F]+)*|kao_[a-f0-9]{16})$/i;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOCALE_RE = /^(en|es|fr|de|hi|ja|pt)$/;
const MAX_BATCH = 20;
const MAX_SLUG_LEN = 120;
const MAX_BODY_BYTES = 16_384;
const PII_FIELD_RE = /^(email|name|phone|ip|address|message|password|token)$/i;
const EMAIL_IN_VALUE_RE = /@[a-z0-9.-]+\.[a-z]{2,}/i;

export interface ValidationFailure {
  readonly code: "invalid_body" | "payload_too_large" | "pii_rejected" | "no_valid_events";
}

export function containsPiiFields(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsPiiFields);
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (PII_FIELD_RE.test(key)) return true;
    if (typeof nested === "string" && EMAIL_IN_VALUE_RE.test(nested)) return true;
    if (containsPiiFields(nested)) return true;
  }
  return false;
}

export function isPayloadTooLarge(bodyText: string): boolean {
  return new TextEncoder().encode(bodyText).length > MAX_BODY_BYTES;
}

export interface ValidatedAnalyticsEvent {
  readonly kind: AnalyticsEventKind;
  readonly canonicalId: string;
  readonly slug?: string;
  readonly timestamp: string;
  readonly locale?: string;
  readonly searchLanguage?: string;
}

export function isValidCanonicalId(id: string): boolean {
  return CANONICAL_ID_RE.test(id) && id.length <= 80;
}

export function validateAnalyticsBatch(body: unknown): ValidatedAnalyticsEvent[] {
  if (!body || typeof body !== "object") return [];
  const events = (body as { events?: unknown }).events;
  if (!Array.isArray(events)) return [];

  const valid: ValidatedAnalyticsEvent[] = [];
  for (const raw of events.slice(0, MAX_BATCH)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const kind = item.kind;
    const canonicalId = item.canonicalId;
    if (typeof kind !== "string" || !VALID_EVENT_KINDS.includes(kind as AnalyticsEventKind)) continue;
    if (typeof canonicalId !== "string" || !isValidCanonicalId(canonicalId)) continue;
    const slug = item.slug;
    if (slug !== undefined && (typeof slug !== "string" || !SLUG_RE.test(slug) || slug.length > MAX_SLUG_LEN)) {
      continue;
    }
    const timestamp = typeof item.timestamp === "string" ? item.timestamp : new Date().toISOString();
    const locale = item.locale;
    const searchLanguage = item.searchLanguage;
    if (locale !== undefined && (typeof locale !== "string" || !LOCALE_RE.test(locale))) continue;
    if (
      searchLanguage !== undefined &&
      (typeof searchLanguage !== "string" || !LOCALE_RE.test(searchLanguage))
    ) {
      continue;
    }
    valid.push({
      kind: kind as AnalyticsEventKind,
      canonicalId,
      slug,
      timestamp,
      locale,
      searchLanguage,
    });
  }
  return valid;
}

export function hexcodeToCanonicalId(hexcode: string): string {
  return `unicode:${hexcode.toUpperCase()}`;
}
