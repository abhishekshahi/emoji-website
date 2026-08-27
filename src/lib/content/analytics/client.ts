import { ANALYTICS_MATURITY, createAnalyticsEvent, type AnalyticsEventKind } from "./events";
import { appendStoredEvent } from "./store";

export type AnalyticsTrackKind = AnalyticsEventKind;

function resolveClientLocale(): { locale?: string; searchLanguage?: string } {
  if (typeof window === "undefined") return {};
  const pathname = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const searchLanguage = params.get("lang") ?? undefined;
  const pathMatch = pathname.match(/^\/(es|fr|hi|de|ja|pt)\/emoji\//);
  const locale = pathMatch?.[1] ?? (searchLanguage && searchLanguage !== "en" ? searchLanguage : "en");
  return {
    locale: locale !== "en" ? locale : undefined,
    searchLanguage: searchLanguage ?? undefined,
  };
}

function sendToServer(event: ReturnType<typeof createAnalyticsEvent>): void {
  if (!ANALYTICS_MATURITY.ingestEnabled || typeof window === "undefined") return;
  const payload = JSON.stringify({ events: [event] });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/event", payload);
      return;
    }
    void fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    });
  } catch {
    /* non-blocking — UX continues */
  }
}

const DEDUPE_MS = 30_000;
const recentEvents = new Map<string, number>();

function dedupeKey(kind: AnalyticsEventKind, canonicalId: string): string {
  return `${kind}:${canonicalId}`;
}

export function trackClientEvent(kind: AnalyticsEventKind, canonicalId: string, slug?: string): void {
  if (typeof window === "undefined") return;
  const key = dedupeKey(kind, canonicalId);
  const now = Date.now();
  const last = recentEvents.get(key);
  if (last !== undefined && now - last < DEDUPE_MS) return;
  recentEvents.set(key, now);

  const { locale, searchLanguage } = resolveClientLocale();
  const event = createAnalyticsEvent(kind, canonicalId, slug, locale, searchLanguage);
  appendStoredEvent(event);
  sendToServer(event);
}
