import Link from "next/link";
import { BrandLogo } from "@/components/layout/site-logo";
import { HubFooterNavigation } from "@/components/hub/hub-nav-sections";
import { isPublicMasterPlatformEnabled } from "@/lib/master/public/config";
import {
  OPENMOJI_LICENSE,
  OPENMOJI_LICENSE_URL,
  OPENMOJI_PROJECT_URL,
  SITE_NAME,
} from "@/lib/site/config";

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
      <div className="page-shell flex flex-col gap-8 py-10">
        <div className="flex flex-col gap-6">
          <div>
            <Link href="/" aria-label={`${SITE_NAME} home`} className="brand-logo-link inline-flex">
              <BrandLogo variant="footer" decorative />
            </Link>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
              {SITE_NAME} — the fastest way to discover, understand, and copy
              emojis. Built from Unicode and Emojibase data.
            </p>
          </div>

          <HubFooterNavigation />

          {masterLinks.length > 0 ? (
            <nav aria-label="Master platform" className="flex flex-wrap gap-2">
              {masterLinks.map((link) => (
                <Link key={link.href} href={link.href} className="pill-link">
                  {link.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>

        <div className="space-y-2 border-t border-border pt-6 text-xs text-muted">
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
