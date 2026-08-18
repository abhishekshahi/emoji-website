"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { resolveDocumentLang, isPublishedLocale } from "@/lib/content/localization/document-lang";

/**
 * Search language precedence (Phase 17 Part 14):
 * 1. explicit ?lang= (published locale)
 * 2. URL pathname locale
 * 3. English fallback
 */
export function useSearchLanguage(): string {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramLang = searchParams.get("lang") ?? "";
  if (paramLang && isPublishedLocale(paramLang)) {
    return paramLang;
  }
  return resolveDocumentLang(pathname, null);
}
