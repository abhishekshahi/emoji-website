"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MOBILE_NAV = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/search", label: "Search", icon: "🔎" },
  { href: "/emoji", label: "Browse", icon: "🗂️" },
  { href: "/favorites", label: "Saved", icon: "★" },
  { href: "/recent", label: "Recent", icon: "🕘" },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-2 py-2 backdrop-blur md:hidden"
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
                className={`flex min-h-11 flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] font-semibold ${
                  isActive
                    ? "bg-accent-soft text-accent-strong"
                    : "text-muted"
                }`}
              >
                <span aria-hidden="true" className="text-base">
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
