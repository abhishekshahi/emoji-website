"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { resolveDocumentLang } from "@/lib/content/localization/document-lang";

/** Resolve page locale from ?lang= or localized pathname. */
export function usePageLocale(): string {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return resolveDocumentLang(pathname, searchParams.get("lang"));
}
