"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { trackClientEvent, type AnalyticsTrackKind } from "@/lib/content/analytics/client";

interface ContentPageTrackerProps {
  readonly kind: "collection_view" | "combination_view";
  readonly canonicalId: string;
  readonly slug: string;
}

export function ContentPageTracker({ kind, canonicalId, slug }: ContentPageTrackerProps) {
  useEffect(() => {
    trackClientEvent(kind, canonicalId, slug);
  }, [kind, canonicalId, slug]);
  return null;
}

interface TrackedContentLinkProps {
  readonly kind: AnalyticsTrackKind;
  readonly canonicalId: string;
  readonly slug?: string;
  readonly href: string;
  readonly className?: string;
  readonly children: ReactNode;
}

export function TrackedContentLink({
  kind,
  canonicalId,
  slug,
  href,
  className,
  children,
}: TrackedContentLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackClientEvent(kind, canonicalId, slug)}
    >
      {children}
    </Link>
  );
}
