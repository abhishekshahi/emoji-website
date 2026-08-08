"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_NAME } from "@/lib/emoji/constants";
import { SearchBar } from "@/components/search/search-bar";

const NAV_ITEMS = [
  { href: "/emoji", label: "Browse" },
  { href: "/popular", label: "Popular" },
  { href: "/new", label: "New" },
  { href: "/favorites", label: "Favorites" },
  { href: "/recent", label: "Recent" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="page-shell flex flex-col gap-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl focus-visible:outline-offset-4"
            aria-label={`${SITE_NAME} home`}
          >
            <span
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-2xl"
            >
              😊
            </span>
            <span className="flex flex-col">
              <span className="text-lg font-bold tracking-tight">{SITE_NAME}</span>
              <span className="text-xs text-muted">Search. Copy. Smile.</span>
            </span>
          </Link>

          <nav
            aria-label="Primary"
            className="hidden items-center gap-1 md:flex"
          >
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-accent-soft text-accent-strong"
                      : "text-muted hover:bg-surface-muted hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <SearchBar size="compact" />
      </div>
    </header>
  );
}
