"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import { SEARCH_UI_CONTRACT } from "@/lib/emoji/search-ui-contract";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

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
  const [query, setQuery] = useState(defaultValue);
  const debouncedQuery = useDebouncedValue(query, SEARCH_UI_CONTRACT.debounceMs);
  const isHero = size === "hero";
  const isLive = mode === "live";
  const hasQuery = query.trim().length > 0;

  useEffect(() => {
    setQuery(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    if (!isLive) {
      return;
    }

    const trimmed = debouncedQuery.trim();
    const nextUrl = trimmed
      ? `/search?q=${encodeURIComponent(trimmed)}`
      : "/search";

    router.replace(nextUrl, { scroll: false });
  }, [debouncedQuery, isLive, router]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLive) {
      return;
    }

    const trimmed = query.trim();

    if (!trimmed) {
      router.push("/search");
      return;
    }

    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const handleClear = () => {
    setQuery("");
    if (isLive) {
      router.replace("/search", { scroll: false });
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
        Search emojis
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
          placeholder={
            isHero
              ? "Search emojis by name, keyword, or Unicode..."
              : "Search by name, keyword, emoji, U+1F525, or 1F525"
          }
          autoFocus={autoFocus}
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
          <Link href="/search?q=fire" className="underline hover:text-accent-strong">
            fire
          </Link>
          ,{" "}
          <Link href="/search?q=heart" className="underline hover:text-accent-strong">
            heart
          </Link>
          , or{" "}
          <Link href="/search?q=U%2B1F525" className="underline hover:text-accent-strong">
            U+1F525
          </Link>
        </p>
      ) : null}
    </form>
  );
}
