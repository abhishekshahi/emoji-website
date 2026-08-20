"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { buildSearchHref, resolveDocumentLang } from "@/lib/content/localization/document-lang";
import { getUiString } from "@/lib/content/localization/ui-strings";
import { SEARCH_UI_CONTRACT } from "@/lib/emoji/search-ui-contract";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDesktopAutofocus } from "@/hooks/use-desktop-autofocus";
import { useSearchParams } from "next/navigation";

interface SearchBarProps {
  defaultValue?: string;
  size?: "compact" | "hero";
  autoFocus?: boolean;
  mode?: "submit" | "live";
}

export function SearchBar({
  defaultValue = "",
  size = "compact",
  autoFocus = false,
  mode = "submit",
}: SearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchLanguage = useMemo(
    () => resolveDocumentLang(pathname, searchParams.get("lang")),
    [pathname, searchParams],
  );
  const [query, setQuery] = useState(defaultValue);
  const debouncedQuery = useDebouncedValue(query, SEARCH_UI_CONTRACT.debounceMs);
  const desktopAutofocus = useDesktopAutofocus(autoFocus);
  const isHero = size === "hero";
  const isLive = mode === "live";
  const hasQuery = query.trim().length > 0;
  const placeholder = getUiString("search.placeholder", searchLanguage);

  useEffect(() => {
    setQuery(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    if (!isLive) {
      return;
    }

    const trimmed = debouncedQuery.trim();
    const nextUrl = buildSearchHref(trimmed, searchLanguage);

    router.replace(nextUrl, { scroll: false });
  }, [debouncedQuery, isLive, router, searchLanguage]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLive) {
      return;
    }

    const trimmed = query.trim();

    if (!trimmed) {
      router.push(buildSearchHref("", searchLanguage));
      return;
    }

    router.push(buildSearchHref(trimmed, searchLanguage));
  };

  const handleClear = () => {
    setQuery("");
    if (isLive) {
      router.replace(buildSearchHref("", searchLanguage), { scroll: false });
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && hasQuery) {
      event.preventDefault();
      handleClear();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full" role="search">
      <label htmlFor="emoji-search" className="sr-only">
        {placeholder}
      </label>
      <div className={`search-bar ${isHero ? "search-bar--hero" : ""}`}>
        <span aria-hidden="true" className={isHero ? "text-xl" : "text-lg"}>
          {"\u{1F50E}"}
        </span>
        <input
          id="emoji-search"
          name="q"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={desktopAutofocus}
          autoComplete="off"
          enterKeyHint="search"
          className={`search-bar__input ${isHero ? "text-lg" : "text-base"}`}
        />
        {hasQuery ? (
          <button
            type="button"
            onClick={handleClear}
            className="btn btn--ghost btn--sm"
            aria-label="Clear search"
          >
            Clear
          </button>
        ) : null}
        {isLive ? (
          <span className="search-bar__live-badge hidden sm:inline">Live</span>
        ) : (
          <button
            type="submit"
            className={`btn btn--primary ${isHero ? "btn--md" : "btn--sm"}`}
          >
            Search
          </button>
        )}
      </div>
      {isHero ? (
        <p className="mt-3 text-sm text-muted">
          Try{" "}
          <Link href={buildSearchHref("fire", searchLanguage)} className="underline hover:text-accent-strong">
            fire
          </Link>
          ,{" "}
          <Link href={buildSearchHref("heart", searchLanguage)} className="underline hover:text-accent-strong">
            heart
          </Link>
          , or{" "}
          <Link href={buildSearchHref("U+1F525", searchLanguage)} className="underline hover:text-accent-strong">
            U+1F525
          </Link>
        </p>
      ) : null}
    </form>
  );
}
