import Link from "next/link";
import { SiteLogoCompact } from "@/components/layout/site-logo";
import { isPublicMasterPlatformEnabled } from "@/lib/master/public/config";
import {
  OPENMOJI_LICENSE,
  OPENMOJI_LICENSE_URL,
  OPENMOJI_PROJECT_URL,
} from "@/lib/site/config";

const FOOTER_LINKS = [
  { href: "/emoji", label: "Browse Emojis" },
  { href: "/explore", label: "Explore" },
  { href: "/styles", label: "Styles" },
  { href: "/search", label: "Search" },
  { href: "/popular", label: "Popular" },
  { href: "/category/smileys-emotion", label: "Categories" },
  { href: "/about", label: "About" },
  { href: "/licenses", label: "Licenses" },
] as const;

export function SiteFooter() {
  const masterLinks = isPublicMasterPlatformEnabled()
    ? [
        { href: "/catalog", label: "Master Catalog" },
        { href: "/artwork", label: "Artwork" },
        { href: "/developers", label: "API" },
        { href: "/data", label: "Data" },
      ]
    : [];

  return (
    <footer className="mt-auto border-t border-border bg-surface/70">
      <div className="page-shell flex flex-col gap-6 py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <SiteLogoCompact />
            <p className="mt-3 max-w-xl text-sm text-muted">
              A fast, friendly emoji search experience built from Unicode and
              Emojibase data.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap gap-2">
            {FOOTER_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="pill-link">
                {link.label}
              </Link>
            ))}
            {masterLinks.map((link) => (
              <Link key={link.href} href={link.href} className="pill-link">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="space-y-2 text-xs text-muted">
          <p>
            Emoji names and keywords are provided by Unicode and CLDR via
            Emojibase.
          </p>
          <p>
            Emoji artwork and OpenMoji Extras provided by{" "}
            <Link href={OPENMOJI_PROJECT_URL} className="underline">
              OpenMoji
            </Link>{" "}
            —{" "}
            <Link href={OPENMOJI_LICENSE_URL} className="underline">
              {OPENMOJI_LICENSE}
            </Link>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
