"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
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
  const debouncedQuery = useDebouncedValue(query, 150);
  const isHero = size === "hero";
  const isLive = mode === "live";

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

  return (
    <form onSubmit={handleSubmit} className="w-full" role="search">
      <label htmlFor="emoji-search" className="sr-only">
        Search emojis
      </label>
      <div
        className={`flex min-h-11 items-center gap-3 rounded-[1.25rem] border border-border bg-surface px-4 shadow-[var(--shadow)] ${
          isHero ? "min-h-16 px-5" : "min-h-12"
        }`}
      >
        <span aria-hidden="true" className={isHero ? "text-2xl" : "text-lg"}>
          🔎
        </span>
        <input
          id="emoji-search"
          name="q"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, keyword, emoji, U+1F525, or 1F525"
          autoFocus={autoFocus}
          autoComplete="off"
          enterKeyHint="search"
          className={`w-full bg-transparent text-foreground placeholder:text-muted focus:outline-none ${
            isHero ? "text-lg" : "text-base"
          }`}
        />
        {isLive ? (
          <span className="hidden text-xs font-medium text-muted sm:inline">
            Live
          </span>
        ) : (
          <button
            type="submit"
            className={`min-h-11 rounded-full bg-accent font-semibold text-white transition hover:bg-accent-strong ${
              isHero ? "px-5 py-3 text-sm" : "px-4 py-2 text-sm"
            }`}
          >
            Search
          </button>
        )}
      </div>
      {isHero ? (
        <p className="mt-3 text-sm text-muted">
          Try <Link href="/search?q=fire" className="underline">fire</Link>,{" "}
          <Link href="/search?q=heart" className="underline">heart</Link>, or{" "}
          <Link href="/search?q=U%2B1F525" className="underline">U+1F525</Link>
        </p>
      ) : null}
    </form>
  );
}
