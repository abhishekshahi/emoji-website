import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/layout/site-logo";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Page not found",
  description: "The requested emoji page could not be found.",
  path: "/404",
  noIndex: true,
});

export default function NotFound() {
  return (
    <div className="page-shell">
      <div className="empty-state mx-auto max-w-xl">
        <div className="flex justify-center">
          <BrandLogo variant="inline" />
        </div>
        <p className="empty-state__title mt-4">Page not found</p>
        <p className="empty-state__description">
          That emoji or page does not exist in this collection.
        </p>
        <div className="empty-state__actions">
          <Link href="/" className="btn btn--primary btn--md">
            Go home
          </Link>
          <Link href="/search" className="btn btn--secondary btn--md">
            Search emojis
          </Link>
        </div>
      </div>
    </div>
  );
}
