"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { KaomojiCard, type KaomojiCardData } from "./kaomoji-card";
import {
  KAOMOJI_SEARCH_LOCALE_OPTIONS,
  type KaomojiSearchLocaleHint,
} from "@/lib/kaomoji/localization/search-terms";

interface SearchResponse {
  results: KaomojiCardData[];
  resolved_query?: string;
  detected_locale?: string | null;
  language_fallback?: boolean;
}

interface SuggestItem {
  term: string;
  locale: string;
  label: string;
}

const LOCALE_STORAGE_KEY = "kaomoji-search-locale";

const QUICK_SEARCHES: readonly { query: string; label: string }[] = [
  { query: "cute", label: "Cute" },
  { query: "happy", label: "Happy" },
  { query: "love", label: "Love" },
  { query: "hug", label: "Hug" },
  { query: "sad", label: "Sad" },
  { query: "cat", label: "Cat" },
];

function readStoredLocale(): KaomojiSearchLocaleHint {
  if (typeof window === "undefined") return "auto";
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === "auto" || !stored) return "auto";
  return KAOMOJI_SEARCH_LOCALE_OPTIONS.some((o) => o.value === stored) ? (stored as KaomojiSearchLocaleHint) : "auto";
}

export function KaomojiSearchPanel({
  initialQuery = "",
  initialLocale = "auto",
  ui,
}: {
  initialQuery?: string;
  initialLocale?: KaomojiSearchLocaleHint;
  ui?: {
    searchPlaceholder: string;
    searchButton: string;
    emptyResults: string;
    loading: string;
  };
}) {
  const copy = ui ?? {
    searchPlaceholder: "Search cute, love, cat, happy kaomoji…",
    searchButton: "Search",
    emptyResults: "No kaomoji matched your search. Try cute, love, or cat.",
    loading: "Searching…",
  };

  const [query, setQuery] = useState(initialQuery);
  const [locale, setLocale] = useState<KaomojiSearchLocaleHint>(initialLocale);
  const [results, setResults] = useState<KaomojiCardData[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{ resolved?: string; fallback?: boolean }>({});

  useEffect(() => {
    if (initialLocale === "auto") setLocale(readStoredLocale());
  }, [initialLocale]);

  const searchUrl = useCallback(
    (q: string) => {
      const params = new URLSearchParams({ q, limit: "24" });
      if (locale !== "auto") params.set("locale", locale);
      return `/api/kaomoji/search?${params.toString()}`;
    },
    [locale],
  );

  const suggestUrl = useCallback(
    (q: string) => {
      const params = new URLSearchParams({ q, limit: "8" });
      if (locale !== "auto") params.set("locale", locale);
      return `/api/kaomoji/search/suggest?${params.toString()}`;
    },
    [locale],
  );

  const search = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) {
        setResults([]);
        setMeta({});
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(searchUrl(trimmed));
        const data = (await res.json()) as SearchResponse;
        setResults(data.results ?? []);
        setMeta({
          resolved: data.resolved_query,
          fallback: data.language_fallback,
        });
      } finally {
        setLoading(false);
      }
    },
    [searchUrl],
  );

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(suggestUrl(trimmed));
        const data = (await res.json()) as { suggestions?: SuggestItem[] };
        setSuggestions(data.suggestions ?? []);
      } catch {
        setSuggestions([]);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query, suggestUrl]);

  useEffect(() => {
    if (initialQuery.trim()) void search(initialQuery);
  }, [initialQuery, search]);

  const localeLabel = useMemo(
    () => KAOMOJI_SEARCH_LOCALE_OPTIONS.find((o) => o.value === locale)?.label ?? "Auto",
    [locale],
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search(query);
        }}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="flex-1 space-y-2">
          <label htmlFor="kaomoji-search-input" className="sr-only">
            Search kaomoji
          </label>
          <input
            id="kaomoji-search-input"
            className="input w-full min-h-11"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={copy.searchPlaceholder}
            aria-label="Search kaomoji"
            autoComplete="off"
            spellCheck={false}
          />
          {suggestions.length > 0 ? (
            <ul className="flex flex-wrap gap-2" aria-label="Search suggestions">
              {suggestions.map((s) => (
                <li key={`${s.locale}:${s.term}`}>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => {
                      setQuery(s.term);
                      void search(s.term);
                    }}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="kaomoji-search-locale">
            Search language
          </label>
          <select
            id="kaomoji-search-locale"
            className="input min-h-11"
            value={locale}
            onChange={(e) => {
              const next = e.target.value as KaomojiSearchLocaleHint;
              setLocale(next);
              window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
            }}
            aria-label={`Search language (${localeLabel})`}
          >
            {KAOMOJI_SEARCH_LOCALE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn--primary min-h-11">
            {copy.searchButton}
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2" aria-label="Quick searches">
        {QUICK_SEARCHES.map((item) => (
          <button
            key={item.query}
            type="button"
            className="chip"
            onClick={() => {
              setQuery(item.query);
              void search(item.query);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-sm text-muted">{copy.loading}</p> : null}
      {!loading && meta.fallback ? (
        <p className="text-xs text-muted">
          No verified translation mapping for this query — showing closest English taxonomy matches.
        </p>
      ) : null}
      {!loading && meta.resolved && meta.resolved !== query.trim().toLowerCase() ? (
        <p className="text-xs text-muted">Resolved search: {meta.resolved}</p>
      ) : null}
      {!loading && query.trim() && results.length === 0 ? (
        <p className="text-sm text-muted">{copy.emptyResults}</p>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {results.map((r) => (
          <KaomojiCard key={r.canonical_id} item={r} />
        ))}
      </div>

      <p className="text-xs text-muted">
        Meanings shown on detail pages are editorial (Step 2). Multilingual search maps verified terms to the English taxonomy — not machine-translated meanings.
      </p>
      <p className="text-sm">
        <Link href="/kaomoji/search" className="text-link">
          Open full search page
        </Link>
      </p>
    </div>
  );
}
