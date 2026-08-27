import type { SupportedLanguage } from "@/lib/content/localization/types";

const SCRIPT_LOCALE: readonly { test: RegExp; locale: SupportedLanguage }[] = [
  { test: /[\u0900-\u097F]/, locale: "hi" },
  { test: /[\u3040-\u30FF]/, locale: "ja" },
  { test: /[\uAC00-\uD7AF]/, locale: "ko" },
  { test: /[\u0600-\u06FF]/, locale: "ar" },
];

/** Detect dominant query language from Unicode script — no external API. */
export function detectQueryLanguage(query: string): SupportedLanguage | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  for (const { test, locale } of SCRIPT_LOCALE) {
    if (test.test(trimmed)) return locale;
  }

  return null;
}

export function isAutoLocale(value: string | null | undefined): boolean {
  return !value || value === "auto";
}
