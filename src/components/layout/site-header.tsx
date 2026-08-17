"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_NAME } from "@/lib/emoji/constants";
import { BrandLogo } from "@/components/layout/site-logo";
import { SearchBar } from "@/components/search/search-bar";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const NAV_ITEMS = [
  { href: "/emoji", label: "Browse" },
  { href: "/popular", label: "Popular" },
  { href: "/explore", label: "Explore" },
  { href: "/new", label: "New" },
  { href: "/favorites", label: "Favorites" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header sticky top-0 z-40">
      <div className="page-shell flex flex-col gap-3 py-3 sm:gap-4 sm:py-4">
        <div className="flex min-w-0 items-center justify-between gap-3 sm:gap-4">
          <Link
            href="/"
            className="brand-logo-link rounded-xl focus-visible:outline-offset-4"
            aria-label={`${SITE_NAME} home`}
          >
            <BrandLogo variant="header" decorative />
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <nav
              aria-label="Primary"
              className="hidden items-center gap-0.5 md:flex"
            >
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`site-nav__link ${
                    isActive ? "site-nav__link--active" : ""
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            </nav>
          </div>
        </div>

        <SearchBar size="compact" />
      </div>
    </header>
  );
}
