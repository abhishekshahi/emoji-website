"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getPublishedHreflangLanguages } from "@/lib/content/localization/published-pages";
import { getPublishedLocales } from "@/lib/content/localization/locales";
import { getUiString } from "@/lib/content/localization/ui-strings";
import { localizedEmojiPath, PRIMARY_LANGUAGE, type SupportedLanguage } from "@/lib/content/localization/types";
import { parseDocumentLangFromPathname } from "@/lib/content/localization/document-lang";

const EMOJI_PATH_RE = /^\/emoji\/([^/]+)\/?$/;
const LOCALIZED_EMOJI_PATH_RE = /^\/(es|fr|hi|de|ja|pt)\/emoji\/([^/]+)\/?$/;

function extractEmojiSlug(pathname: string): string | null {
  const localized = pathname.match(LOCALIZED_EMOJI_PATH_RE);
  if (localized) return localized[2] ?? null;
  const english = pathname.match(EMOJI_PATH_RE);
  return english?.[1] ?? null;
}

export function LanguageSwitcher() {
  const pathname = usePathname();
  const currentLang = parseDocumentLangFromPathname(pathname);
  const emojiSlug = extractEmojiSlug(pathname);
  const uiLang = currentLang !== PRIMARY_LANGUAGE ? currentLang : PRIMARY_LANGUAGE;
  const label = getUiString("language.label", uiLang);

  const locales = getPublishedLocales();
  const availableForSlug = emojiSlug
    ? getPublishedHreflangLanguages(emojiSlug)
    : ([PRIMARY_LANGUAGE, ...locales.map((l) => l.code)] as SupportedLanguage[]);

  return (
    <div className="relative">
      <label htmlFor="language-switcher" className="sr-only">
        {label}
      </label>
      <select
        id="language-switcher"
        className="min-h-11 rounded-lg border border-border bg-surface px-2 py-1 text-sm"
        value={currentLang}
        onChange={(event) => {
          const next = event.target.value;
          const href = emojiSlug
            ? localizedEmojiPath(next as SupportedLanguage, emojiSlug)
            : next === PRIMARY_LANGUAGE
              ? "/"
              : `/${next}/emoji/fire`;
          window.location.href = href;
        }}
        aria-label={label}
      >
        <option value={PRIMARY_LANGUAGE}>{getPublishedLocales().length ? "English" : "English"}</option>
        {locales.map((locale) => {
          const available = availableForSlug.includes(locale.code);
          return (
            <option key={locale.code} value={locale.code} disabled={emojiSlug ? !available : false}>
              {locale.nativeName}
              {emojiSlug && !available ? " (EN fallback)" : ""}
            </option>
          );
        })}
      </select>
      {emojiSlug && currentLang !== PRIMARY_LANGUAGE ? (
        <Link
          href={`/emoji/${emojiSlug}`}
          className="mt-1 block text-xs text-muted underline"
        >
          {getUiString("language.englishPage", currentLang)}
        </Link>
      ) : null}
    </div>
  );
}
