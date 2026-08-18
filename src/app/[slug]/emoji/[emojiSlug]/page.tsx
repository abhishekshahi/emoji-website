import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { HubLayout } from "@/components/hub/hub-layout";
import {
  getLocalizedStaticParams,
  getPublishedLocalizedPage,
  getPublishedHreflangLanguages,
} from "@/lib/content/localization/published-pages";
import { getMeaningBySlug } from "@/lib/content/meaning/registry";
import { getLocalizedContentWithFallback } from "@/lib/content/localization/registry";
import { getUiString } from "@/lib/content/localization/ui-strings";
import { LOCALE_REGISTRY } from "@/lib/content/localization/locales";
import { localizedEmojiPath, PRIMARY_LANGUAGE, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/content/localization/types";
import { createPageMetadata, canonicalUrl } from "@/lib/seo/metadata";

interface LocalizedEmojiPageProps {
  params: Promise<{ slug: string; emojiSlug: string }>;
}

export function generateStaticParams() {
  return getLocalizedStaticParams().map(({ lang, slug }) => ({ slug: lang, emojiSlug: slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: LocalizedEmojiPageProps): Promise<Metadata> {
  const { slug: lang, emojiSlug } = await params;
  const page = getPublishedLocalizedPage(lang, emojiSlug);
  if (!page) return { title: "Not found" };
  const hrefLangs = getPublishedHreflangLanguages(emojiSlug);
  const languages: Record<string, string> = {
    "x-default": canonicalUrl(`/emoji/${emojiSlug}`),
  };
  for (const code of hrefLangs) {
    languages[code] = canonicalUrl(localizedEmojiPath(code, emojiSlug));
  }
  return {
    ...createPageMetadata({
      title: `${page.localizedTitle} Emoji — ${
        lang === "es"
          ? "Significado y Unicode"
          : lang === "fr"
            ? "Signification et Unicode"
            : lang === "de"
              ? "Bedeutung und Unicode"
              : lang === "ja"
                ? "意味とUnicode"
                : lang === "pt"
                  ? "Significado e Unicode"
                  : lang === "hi"
                    ? "अर्थ और Unicode"
                    : "Meaning and Unicode"
      } | EmojiQuick`,
      description: page.localizedDescription,
      path: localizedEmojiPath(lang as SupportedLanguage, emojiSlug),
    }),
    alternates: {
      canonical: canonicalUrl(`/emoji/${emojiSlug}`),
      languages,
    },
  };
}

export default async function LocalizedEmojiPage({ params }: LocalizedEmojiPageProps) {
  const { slug: lang, emojiSlug } = await params;
  if (!SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage)) notFound();
  const page = getPublishedLocalizedPage(lang, emojiSlug);
  if (!page) notFound();

  const meaning = getMeaningBySlug(emojiSlug, PRIMARY_LANGUAGE);
  const localized = getLocalizedContentWithFallback(page.canonicalId, lang as SupportedLanguage);

  return (
    <HubLayout
      path={localizedEmojiPath(lang as SupportedLanguage, emojiSlug)}
      title={page.localizedTitle}
      description={page.localizedDescription}
      eyebrow={`${LOCALE_REGISTRY[lang as SupportedLanguage]?.nativeName ?? lang} · Editorial`}
      links={[
        { href: `/emoji/${emojiSlug}`, label: getUiString("language.englishPage", lang) },
      ]}
    >
      <div className="flex flex-wrap items-center gap-4">
        <LanguageSwitcher />
      </div>
      <p className="text-sm text-muted">{getUiString("language.fallbackNotice", lang)}</p>
      <section className="card-surface space-y-3 p-6">
        <h2 className="text-xl font-semibold">{getUiString("emoji.meaning", lang)}</h2>
        <p className="text-sm text-muted">{localized?.shortDescription ?? page.localizedDescription}</p>
        {meaning ? (
          <p className="text-xs text-muted">{getUiString("language.fallbackNotice", lang)}</p>
        ) : null}
      </section>
      <p className="text-sm">
        <Link href={`/emoji/${emojiSlug}`} className="text-accent-strong underline">
          /emoji/{emojiSlug}
        </Link>
      </p>
    </HubLayout>
  );
}
