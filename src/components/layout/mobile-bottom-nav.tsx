"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Mobile primary nav — Favorites replaces Explore (Explore via homepage + header). */
const MOBILE_NAV = [
  { href: "/", label: "Home", icon: "\u{1F3E0}" },
  { href: "/search", label: "Search", icon: "\u{1F50E}" },
  { href: "/emoji", label: "Browse", icon: "\u{1F5C2}\uFE0F" },
  { href: "/favorites", label: "Saved", icon: "\u2B50" },
  { href: "/popular", label: "Popular", icon: "\u{1F525}" },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile"
      className="mobile-nav fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-2 pt-2 backdrop-blur-md md:hidden"
    >
      <ul className="grid grid-cols-5 gap-1">
        {MOBILE_NAV.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.href === "/favorites" ? "Favorites" : undefined}
                className={`mobile-nav__link ${
                  isActive ? "mobile-nav__link--active" : "text-muted"
                }`}
              >
                <span aria-hidden="true" className="mobile-nav__icon">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
