"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_NAME } from "@/lib/emoji/constants";
import { BrandLogo } from "@/components/layout/site-logo";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { SearchBar } from "@/components/search/search-bar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { getUiString } from "@/lib/content/localization/ui-strings";
import { usePageLocale } from "@/hooks/use-page-locale";

const NAV_KEYS = [
  { href: "/emoji", key: "nav.browse" as const },
  { href: "/popular", key: "nav.popular" as const },
  { href: "/explore", key: "nav.explore" as const },
  { href: "/new", key: "nav.new" as const },
  { href: "/favorites", key: "nav.favorites" as const },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const locale = usePageLocale();

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
            <LanguageSwitcher />
            <ThemeToggle />
            <nav
              aria-label="Primary"
              className="hidden items-center gap-0.5 md:flex"
            >
            {NAV_KEYS.map((item) => {
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
                  {getUiString(item.key, locale)}
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
